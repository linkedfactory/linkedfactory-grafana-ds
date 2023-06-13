import * as _ from 'lodash';
import { BackendSrvRequest, FetchResponse, TemplateSrv, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame
} from '@grafana/data';
import { EMPTY, merge, from, Observable } from 'rxjs';
import { map, mergeMap, concatMap, reduce } from 'rxjs/operators';

import { MyQuery, MyDataSourceOptions, PropertySpec } from './types';

interface LFData {
  [key: string]: Record<string, any>
}

interface PropertyValue {
  time: number;
  value: any;
}

interface ItemData {
  refId: string,
  item: string,
  properties: Record<string, PropertyValue[]>
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  settings?: any;
  templateSrv: TemplateSrv;
  limitPerRequest: number;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.settings = instanceSettings;
    this.templateSrv = getTemplateSrv();
    this.limitPerRequest = 10000;
  }

  loadData(item: string, propertyPath: PropertySpec[], limit?: number, fromTime?: number, toTime?: number): Observable<ItemData> {
    let self = this;
    const params: Record<string, any> = {
      item: item,
      properties: propertyPath[0].join(' '),
      limit: limit ? limit : this.limitPerRequest
      //interval: interval,
      // FIXME: use setting from config (target.downsampling, maybe?)
      // op: 'avg'
    };

    if (fromTime !== undefined) {
      params["from"] = fromTime;
    }
    if (toTime !== undefined) {
      params["to"] = toTime;
    }

    const requestOptions: BackendSrvRequest = {
      url: this.url + '/values',
      params: params,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }

    if (this.settings.jsonData.user) {
      requestOptions.headers!['Authorization'] = 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password);
    }

    let results = getBackendSrv()
      .fetch<LFData>(requestOptions)
      .pipe(concatMap((response, index) => {
        if (response.status === 200) {
          let observables: Array<Observable<ItemData>> = [];
          Object.keys(response.data || {}).forEach(item => {
            let propertyValues = response.data[item];

            // the data for one individual item
            observables.push(from([{ item: item, properties: propertyValues } as ItemData]));

            Object.keys(propertyValues).forEach(property => {
              let propertyData = propertyValues[property];
              if (!propertyData || propertyData.length === 0) {
                return;
              }
              if (propertyData.length === self.limitPerRequest) {
                // limit reached, fetch earlier blocks, keep from
                // but stop at earliest time already read - 1
                let localTo = propertyData[propertyData.length - 1].time - 1;
                observables.push(self.loadData(item, [[property]], limit, fromTime, localTo));
              }
            });
          });
          return merge(...observables);
        }
        return EMPTY;
      }));

    if (propertyPath.length > 1) {
      results = results.pipe(mergeMap((data, index) => {
        return merge(...propertyPath[1].flatMap(p => {
          return Object.keys(data.properties).flatMap(property => {
            let propertyData = data.properties[property];
            return propertyData.map(d => {
              if (d.value[p]) {
                let newProperties: Record<string, PropertyValue[]> = {};
                newProperties[p] = [{ time: d.time, value: d.value[p] }];
                return from([{ item: item, properties: newProperties } as ItemData]);
              } else if (d.value['@id']) {
                const pathRest = propertyPath.length > 2 ? propertyPath.slice(2) : [];
                return self.loadData(d.value['@id'], [[p]].concat(pathRest), 1).pipe(map(data => {
                  Object.entries(data.properties).forEach(([p, v]) => {
                    if (v.length > 0) {
                      // use time of source value
                      v[0].time = d.time;
                    }
                  });
                  return data;
                }));
              } else {
                return EMPTY;
              }
            });
          });
        }));
      }));
    }
    return results;
  };

  // helper to construct a short display name for item + property
  compoundName(item: string, property: string) {
    return item + '@' + this.localPart(property);
  }

  // helper to get the localPart of an URI (used to display short properties)
  localPart(uriString: string) {
    let separator = ['#', '/'].find(sep => uriString.lastIndexOf(sep) > 0);
    return uriString.substring(uriString.lastIndexOf(separator ? separator : ':') + 1);
  }

  override query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
    let targets = options.targets.filter(t => { return !t.hide; });

    if (targets.length <= 0) {
      return from([{ data: [] }]);
    }

    let that = this;
    const all = targets.map(t => {
      return that.loadData(t.item, t.propertyPath, options.maxDataPoints, options.range.from.valueOf(), options.range.to.valueOf()).pipe(
        reduce((acc, data) => {
          Object.keys(data.properties).forEach(property => {
            const properties = acc.properties[property] || [];
            properties.push(...data.properties[property]);
            acc.properties[property] = properties;
          });
          return acc;
        }, { item: t.item, refId: t.refId, properties: {} } as ItemData),
        map(data => {
          let dataFrames = Object.keys(data.properties).map(property => {
            let propertyData = data.properties[property];
            return new MutableDataFrame({
              refId: data.refId,
              fields: [
                { name: 'Time', type: FieldType.time, values: propertyData.map(d => d.time) },
                { name: this.compoundName(data.item, property), /*type: FieldType.number,*/ values: propertyData.map(d => d.value) },
              ]
            });
          });
          return { data: dataFrames };
        }));
    });

    return merge(...all);
  }

  override async testDatasource() {
    return getBackendSrv()
      .datasourceRequest({
        url: this.url!,
        method: 'GET',
      })
      .catch((err: any) => {
        if (err.data) {
          const msg = err.data.error?.reason ?? err.data.message ?? 'Unknown Error';
          throw {
            message: 'LinkedFactory Error: ' + msg + ' ' + this.url,
            error: err.data.error,
          };
        }
        throw err;
      }).then((r: FetchResponse<any>) => {
        if (r.status === 200) {
          return { status: "success", message: "LinkedFactory enpoint online", title: "Success" }
        }
        return null;
      });
  }
}
