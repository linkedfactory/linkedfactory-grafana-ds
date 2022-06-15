import defaults from 'lodash/defaults';
import { getBackendSrv } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  settings?: any;
  currentUrl: string;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.currentUrl = '';
    this.settings = instanceSettings;
  }

  urlBuilder(query){
    var factory = '';
    var machine = '';
    var sensor = '';

    if(query.factory) factory = query.factory;
    if(query.machine) machine = query.machine;
    if(query.sensor) sensor = query.sensor;

    var buildUrl = this.url + '/values?item=' + this.url + '/' + factory + '/' + machine + '/' + sensor;
    this.currentUrl = this.url + '/' + factory + '/' + machine + '/' + sensor;
    return buildUrl
  }

  async doRequest(query: MyQuery) {
    const result = await getBackendSrv().datasourceRequest({
      method: 'GET',
      url: this.urlBuilder(query)
    });
    return result;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();

    const data = options.targets.map((target) => {
      const query = defaults(target, defaultQuery);

      this.doRequest(query).then((res) => {
        //TODO: set values from result
        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: [
            { name: "Time", type: FieldType.time },
            { name: "Value", type: FieldType.number },
            { name: "Flag", type: FieldType.number },
            { name: "A", type: FieldType.number }
          ]
        });
        console.log(res.data[this.currentUrl]);

        const result = res.data[this.currentUrl]
        for(let key in result){

          //access values like this
          console.log(result['a'][0]['value']);
          frame.appendRow([result['a']['time'], result['value']['value'], result['flag']['value'], result['a']['value']]);
        }

        console.log(frame);

        return frame;
      });

      /*
      const dataFrame: MutableDataFrame = new MutableDataFrame();
      dataFrame.refId = query.refId;
      
      dataFrame.addField({ name: 'Time', values: [from, to], type: FieldType.time });
      if(query.valueSelect) dataFrame.addField({ name: 'Value', values: [query.value, query.value], type: FieldType.number });
      if(query.flagSelect) dataFrame.addField({ name: 'Flag', values: [query.flag, query.flag], type: FieldType.number });
      if(query.aSelect) dataFrame.addField({ name: 'A', values: [query.a, query.a], type: FieldType.number });


      return dataFrame*/
    });
    return Promise.all(data).then((data) => ({ data }));
  }

  async testDatasource() {
    // WIP: test not working properly
    const routePath = "/linkedfactory";
    return getBackendSrv()
      .datasourceRequest({
        url: this.url! + routePath,
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
      }).then(r => {
        if(r.status == 200) {
          return {status: "success", message: "LinkedFactory Online!", title: "Success"}
        }
      });
  }
}
