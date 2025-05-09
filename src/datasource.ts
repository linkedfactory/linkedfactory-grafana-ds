import * as _ from 'lodash';
import { BackendSrvRequest, FetchResponse, TemplateSrv, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  createDataFrame,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  Field,
  FieldDTO,
  FieldType
} from '@grafana/data';
import { EMPTY, concat, merge, from, Observable, firstValueFrom, fromEvent } from 'rxjs';
import { map, reduce, mergeMap, toArray, concatMap, zipWith, takeUntil } from 'rxjs/operators';

import { LFQuery, LFDataSourceOptions, PropertySpec } from './types';

import { SparqlEndpointFetcher } from "fetch-sparql-endpoint";

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

interface QueryOptions {
  limit?: number;
  op?: string;
  interval?: number;
}

export class DataSource extends DataSourceApi<LFQuery, LFDataSourceOptions> {
  url?: string;
  settings?: any;
  templateSrv: TemplateSrv;
  limitPerRequest: number;

  constructor(instanceSettings: DataSourceInstanceSettings<LFDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.settings = instanceSettings;
    this.templateSrv = getTemplateSrv();
    this.limitPerRequest = 10000;
  }

  executeSparql(sparql: string, refId: string, options: DataQueryRequest<LFQuery>): Observable<DataFrame> {
    const fromTime = options.range.from.valueOf();
    const toTime = options.range.to.valueOf();

    sparql = sparql.replace(/[?$]_from/g, fromTime.toString());
    sparql = sparql.replace(/[?$]_to/g, toTime.toString());

    sparql = this.templateSrv.replace(sparql);

    console.log("final query", sparql);

    const fetchFunc = async (input: Request | string, init?: RequestInit): Promise<Response> => {
      let request: Request;
      if (!(input as any).body) {
        request = { url: input.toString(), ...init } as Request;
      } else {
        request = input as Request;
      }

      // convert headers to record
      const headers: Record<string, any> = {};
      for (const header of request.headers.entries()) {
        headers[header[0]] = header[1];
      }

      if (this.settings.jsonData.user) {
        headers['Authorization'] = 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password);
      }

      let requestOptions: BackendSrvRequest = {
        url: request.url,
        data: request.body,
        method: request.method,
        headers: headers,
        responseType: 'blob'
      }

      const response = await firstValueFrom(getBackendSrv().fetch(requestOptions));
      return {
        body: (response.data as any | undefined)?.stream(),
        headers: response.headers,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      } as Response;
    }
    const fetcher = new SparqlEndpointFetcher({
      method: 'POST',                           // A custom HTTP method for issuing (non-update) queries, defaults to POST. Update queries are always issued via POST.
      fetch: fetchFunc,                             // A custom fetch-API-supporting function
      prefixVariableQuestionMark: false,        // If variable names in bindings should be prefixed with '?', defaults to false
      timeout: 5000                             // Timeout for setting up server connection (Once a connection has been made, and the response is being parsed, the timeout does not apply anymore).
    });

    const endpoint = this.url!.replace(/linkedfactory\/?/, "") + "sparql";
    const results = from(fetcher.fetchBindings(endpoint + "?model=http://linkedfactory.github.io/data/", sparql))
      .pipe(concatMap(stream => {
        const end = fromEvent(stream, 'end');
        return (fromEvent(stream, 'variables') as Observable<any>)
          .pipe(takeUntil(end), toArray(), zipWith((fromEvent(stream, 'data') as Observable<any>).pipe(takeUntil(end), toArray())));
      }))
      .pipe(map(varsAndRows => {
        // only one element for variables
        const variables = varsAndRows[0][0];
        // multiple elements for rows
        const rows = varsAndRows[1];

        const fields: Array<FieldDTO | Field> = [];
        for (let v of variables) {
          const varName: string = v.value;
          let field: FieldDTO<any>;
          // if variable is named 'time' or 'Time' the values need to be converted into Number, otherwise Grafana identify as NaN
          if (varName === 'time' || varName === 'Time') {
            field = { name: varName, type: FieldType.time, values: rows.map(row => Number(row[varName].value)), labels: {} };
          } else {
            field = {
              name: varName, /*type: FieldType.number,*/ values: rows.map(row => {
                // try to convert value to number
                const value = row[varName].value;
                const valueAsNumber = Number(value);
                return Number.isNaN(valueAsNumber) ? value : valueAsNumber;
              }), labels: {}
            };
          }
          fields.push(field);
        }
        return createDataFrame({
          refId: refId,
          fields: fields
        });
      }));
    return results;
  }

  loadData(item: string, propertyPath: PropertySpec[], options: QueryOptions, fromTime?: number, toTime?: number): Observable<ItemData> {
    console.log("load ", item, " ", propertyPath)

    let self = this;
    const limit = options.limit || this.limitPerRequest;
    const params: Record<string, any> = {
      item: item,
      limit: limit,
      op: options.op,
      interval: options.interval
    };

    const queryProperties = propertyPath[0]
    if (queryProperties.length && queryProperties[0] !== "*") {
      params["properties"] = queryProperties.join(' ');
    }

    if (fromTime !== undefined) {
      params["from"] = fromTime;
    }
    if (toTime !== undefined) {
      params["to"] = toTime;
    }

    const requestOptions: BackendSrvRequest = {
      url: this.url!.replace(/\/$/, '') + '/values',
      params: params,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }

    if (this.settings.jsonData.user) {
      requestOptions.headers!['Authorization'] = 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password);
    }

    let results = getBackendSrv()
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
                observables.push(self.loadData(item, [[property]], { limit: options.limit }, fromTime, localTo));
              }
            });
          });
          return merge(...observables);
        }
        return EMPTY;
      }));

    if (propertyPath.length > 1) {
      results = results.pipe(mergeMap((data, index) => {
        // use concat here to have stable behavior in case of duplicate timestamps
        return concat(...propertyPath[1].flatMap(p => {
          return Object.keys(data.properties).flatMap(property => {
            const propertyData = data.properties[property];
            return propertyData.map(d => {
              if (d.value[p]) {
                // TODO unfold property path further if required
                const newProperties: Record<string, PropertyValue[]> = {};
                newProperties[p] = [{ time: d.time, value: d.value[p] }];
                return from([{ item: item, properties: newProperties } as ItemData]);
              } else if (d.value['@id']) {
                const pathRest = propertyPath.length > 2 ? propertyPath.slice(2) : [];
                return self.loadData(d.value['@id'], [[p]].concat(pathRest), { limit: 1 }).pipe(map(data => {
                  Object.entries(data.properties).forEach(([p, v]) => {
                    if (v.length > 0) {
                      // use time of source value
                      v[0].time = d.time;
                    }
                  });
                  return data;
                }));
              } else if (p === '*') {
                const newProperties: Record<string, PropertyValue[]> = {};
                Object.entries(d.value).forEach(([k, v]) => {
                  newProperties[k] = [{ time: d.time, value: v }];
                });
                return from([{ item: item, properties: newProperties } as ItemData]);
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

  // get properties for a given item
  queryProperties(item: string, propertyPath?: PropertySpec[]): Observable<string[]> {
    if (propertyPath !== undefined && propertyPath.length) {
      // fetch properties via example value
      return this.loadData(item, propertyPath, { limit: 1 }).pipe(map(data => {
        return Object.keys(data.properties);
      }));
    }

    // use /properties endpoint
    const params: Record<string, any> = {
      item: item
    };

    const requestOptions: BackendSrvRequest = {
      url: this.url + '/properties',
      params: params,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }

    if (this.settings.jsonData.user) {
      requestOptions.headers!['Authorization'] = 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password);
    }

    return getBackendSrv().fetch<any>(requestOptions).pipe(map(response => {
      return response.data.map((e: any) => {
        return e['@id'];
      });
    }));
  }

  override query(options: DataQueryRequest<LFQuery>): Observable<DataQueryResponse> {
    let targets = options.targets.filter(t => { return !t.hide; });

    if (targets.length <= 0) {
      return from([{ data: [] }]);
    }

    let that = this;
    const all = targets.map(t => {
      if (t.sparql) {
        return that.executeSparql(t.sparql, t.refId, options);
      }
      const op = t.operator && t.operator === '-' ? undefined : 'avg';
      return that.loadData(t.item, t.propertyPath, {
        limit: options.maxDataPoints,
        interval: op ? options.intervalMs : undefined,
        op: op
      }, options.range.from.valueOf(), options.range.to.valueOf()).pipe(
        reduce((acc, data) => {
          Object.keys(data.properties).forEach(property => {
            const properties = acc.properties[property] || [];
            properties.push(...data.properties[property]);
            acc.properties[property] = properties;
          });
          return acc;
        }, { item: t.item, properties: {} } as ItemData),
        map(data => {
          const propertyNames = Object.keys(data.properties);
          if (propertyNames.length === 1) {
            // the simple case, just return one column
            return propertyNames.map(property => {
              let propertyData = data.properties[property];
              return createDataFrame({
                refId: t.refId,
                fields: [
                  { name: 'Time', type: FieldType.time, values: propertyData.map(d => d.time) },
                  { name: this.compoundName(data.item, property), values: propertyData.map(d => d.value), labels: {} },
                ]
              });
            });
          }

          // combine all columns into one data frame
          const propertyValues = new Array<PropertyValue[]>(propertyNames.length);
          const maxTimeCount = new Map<number, number>();
          propertyNames.map((property, propertyIndex) => {
            let propertyData = data.properties[property];
            // sort data
            propertyData.sort((a, b) => a.time - b.time);
            propertyValues[propertyIndex] = propertyData;

            let lastTime: number | undefined = undefined;
            let count = 0;
            propertyData.forEach(d => {
              if (lastTime === d.time) {
                count++;
              } else if (lastTime !== undefined) {
                maxTimeCount.set(lastTime!, Math.max(maxTimeCount.get(lastTime!) || 0, count + 1));
                count = 0;
              }
              lastTime = d.time;
            });
            // set count for last element
            if (lastTime !== undefined) {
              maxTimeCount.set(lastTime!, Math.max(maxTimeCount.get(lastTime!) || 0, count + 1));
            }
          });
          let nrOfValues = 0
          for (const count of maxTimeCount.values()) {
            nrOfValues += count
          }
          let timeValues = new Array<number>(nrOfValues);
          let keys = Array.from(maxTimeCount.keys());
          keys.sort();
          let index = 0;

          for (const time of keys) {
            for (let count = maxTimeCount.get(time)!; count > 0; count--) {
              timeValues[index++] = time;
            }
          }

          let columnValues = new Array<any[]>(propertyNames.length);
          for (let propertyNr = 0; propertyNr < propertyNames.length; propertyNr++) {
            columnValues[propertyNr] = new Array<any>(nrOfValues);
          }

          let propertyIndexes = new Array<number>(propertyNames.length).fill(0);
          for (index = 0; index < timeValues.length; index++) {
            const time = timeValues[index];
            for (let propertyNr = 0; propertyNr < propertyNames.length; propertyNr++) {
              const propertyData = propertyValues[propertyNr];
              const propertyIndex = propertyIndexes[propertyNr];
              if (propertyData && propertyData[propertyIndex] && time === propertyData[propertyIndex].time) {
                columnValues[propertyNr][index] = propertyData[propertyIndex].value;
                propertyIndexes[propertyNr]++;
              }
            }
          }

          const fields: Array<FieldDTO | Field> = [];
          fields.push({ name: 'Time', type: FieldType.time, values: timeValues });
          for (let propertyNr = 0; propertyNr < propertyNames.length; propertyNr++) {
            const property = propertyNames[propertyNr];
            fields.push({ name: this.compoundName(data.item, property), /*type: FieldType.number,*/ values: columnValues[propertyNr], labels: {} });
          }
          return createDataFrame({
            refId: t.refId,
            fields: fields
          });
        }));
    });

    return merge(...all).pipe(toArray(), map(dataFrames => { return { data: dataFrames.flat() } }));
  }

  override async testDatasource() {
    const requestOptions: BackendSrvRequest = {
      url: this.url!.replace(/\/$/, '') + '/values',
      method: 'GET'
    }
    // add header for Basic auth
    if (this.settings.jsonData.user) {
      requestOptions.headers = {
        ...(requestOptions.headers || {}),
        Authorization: 'Basic ' + btoa(this.settings.jsonData.user + ":" + this.settings.jsonData.password)};
    }

    return firstValueFrom(getBackendSrv().fetch(requestOptions)).then((r: FetchResponse<any>) => {
      if (r.status === 200) {
        return { status: "success", message: "LinkedFactory enpoint online" }
      }
      throw { status: "error", message: r.statusText ? r.statusText : "Connection failed" };
    });
  }
}
