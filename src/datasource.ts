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
import { map, mergeMap } from 'rxjs/operators';

import { MyQuery, MyDataSourceOptions } from './types';

interface LFData {
  [key: string]: Record<string, any>
}

interface PropertyValue {
  time: number;
  value: any;
}

interface ItemData {
  item: string,
  properties: Record<string, PropertyValue[]>
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  settings?: any;
  templateSrv: TemplateSrv;
  maxDataPoints: number;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.settings = instanceSettings;
    this.templateSrv = getTemplateSrv();
    this.maxDataPoints = 10000;
  }

  loadData(options: DataQueryRequest<MyQuery>, item: string, properties: string[], fromTime: number, toTime: number): Observable<ItemData> {
    let limit = options.maxDataPoints || this.maxDataPoints;
    // let interval = options.intervalMs
    let self = this;

    const requestOptions: BackendSrvRequest = {
      url: this.url + '/values',
      params: {
        item: item,
        properties: properties.join(' '),
        from: fromTime,
        to: toTime,
        limit: limit,
        //interval: interval,
        // FIXME: use setting from config (target.downsampling, maybe?)
       // op: 'avg'
      },
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }

    if (this.settings.jsonData.user) {
      requestOptions.headers!['Authorization'] = 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password);
    }

    return getBackendSrv()
      .fetch<LFData>(requestOptions)
      .pipe(mergeMap((response, index) => {
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
              if (propertyData.length === limit) {
                // limit reached, fetch earlier blocks, keep from
                // but stop at earliest time already read - 1
                let localTo = propertyData[propertyData.length - 1].time - 1;
                observables.push(self.loadData(options, item, [property], fromTime, localTo));
              }
            });
          });
          return merge(...observables);
        }
        return EMPTY;
      }));
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
    let targets = options.targets.filter(target => {
      return target.item !== 'select item' && target.property.find(e => e === 'select property') === undefined;
    }).filter(t => { return !t.hide; });

    if (targets.length <= 0) {
      return from([{ data: [] }]);
    }

    let itemProperties = new Map<string, Set<string>>();
    let itemPropertyToTarget = new Map<string, MyQuery>();

    targets.forEach(t => {
      if (t.property !== undefined) {
        let key = t.item.toString()
        itemProperties.set(key, (itemProperties.get(key) || new Set<string>(t.property)));
        if (!t.scale) {
          t.scale = 1;
        }
        t.property.forEach(p => {
          itemPropertyToTarget.set([t.item, p].join(' '), t);
        });
      }
    });

    const all: Array<Observable<ItemData>> = [];
    let that = this;
    for (let [item, properties] of itemProperties) {
      all.push(that.loadData(options, item, Array.from(properties), options.range.from.valueOf(), options.range.to.valueOf()));
    }

    return merge(...all).pipe(map(data => {
      let dataFrames = Object.keys(data.properties).map(property => {
        let propertyData = data.properties[property];
        let target: MyQuery = itemPropertyToTarget.get([data.item, property].join(' '))!;
        return new MutableDataFrame({
          refId: target.refId,
          fields: [
            { name: 'Time', type: FieldType.time, values: propertyData.map(d => d.time) },
            { name: this.compoundName(data.item, property), type: FieldType.number, values: propertyData.map(d => d.value) },
          ]
        });
      });
      return { data: dataFrames }
    }))
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
