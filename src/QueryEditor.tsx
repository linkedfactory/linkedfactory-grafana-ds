import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { Checkbox, Select, HorizontalGroup } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';
import { getBackendSrv } from '@grafana/runtime';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {

  myFactoryOptions: Array<{}> = [];
  myMachineOptions: Array<{}> = [];
  mySensorOptions: Array<{}> = [];

  allOptions: Array<Array<{}>> = [
    this.myFactoryOptions, 
    this.myMachineOptions, 
    this.mySensorOptions
  ];

  //TODO: how to get instancesettings from DataSource object?
  lfUrl = "http://localhost:8080/linkedfactory";

  //build url for getData
  urlBuilder(options){
    var buildUrl;
    if(options[0] == 0){
      buildUrl = this.lfUrl + '/**'
    }
    else if(options[0] == 1){
      buildUrl = this.lfUrl + '/**?item=' + this.lfUrl + '/' + options[1]
    }
    else if(options[0] == 2){
      buildUrl = this.lfUrl + '/**?item=' + this.lfUrl + '/' + options[1] + '/' + options[2]
    }
    else{
      throw console.error('[urlBuilder] wrong option settings');
    }
    return buildUrl;
  }

  //get data from lf server
  getData(options){
    var that = this;
    const url = this.urlBuilder(options);
    const promise = getBackendSrv().datasourceRequest({
      method: 'GET',
      url: url
    });
    promise.then(function(r){
      that.setData(r, options)
    })
  }

  //set options data for html query editor
  setData(data, options){
    const stringData: string[] = [];
    var op = this.allOptions[options[0]];
    op.length = 0;
    const splitIndex = options[0] + 4;
    data.data.forEach(e => {
      let element = e['@id'].split('/')[splitIndex];
      if(!stringData.includes(element)) stringData.push(element);
    });
    stringData.forEach(e => {
      if(!op.includes({label: e, value: e})) op.push({label: e, value: e});
    })
    this.allOptions[options[0]] = op;
  }


  onFactoryChange = (value: SelectableValue<String>) => {
    const options = [1, value.value];
    this.getData(options);
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, factory: value.value! });
    onRunQuery();
  };

  onMachineChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = this.props;
    const options = [2, query.factory, value.value];
    this.getData(options);
    onChange({ ...query, machine: value.value! });
    onRunQuery();
  };

  onSensorChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, sensor: value.value! });
    onRunQuery();
  };

  onValueChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, valueSelect: evt.target.checked! });
    onRunQuery();
  }

  onFlagChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, flagSelect: evt.target.checked! });
    onRunQuery();
  }

  onAChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, aSelect: evt.target.checked! });
    onRunQuery();
  }

  shouldComponentUpdate(){
    return false;
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const {} = query;
    const options = [0];

    this.getData(options);

    return (
      <div className="gf-form">
        <label className="gf-form-label">Value Selection</label>
        <div className="gf-form width-10">
        <HorizontalGroup>
          <Checkbox
            defaultChecked={false}
            label="Value"
            onChange={this.onValueChange}
          />
          <Checkbox
            defaultChecked={false}
            label="Flag"
            onChange={this.onFlagChange}
          />
          <Checkbox
            defaultChecked={false}
            label="A"
            onChange={this.onAChange}
          />
        </HorizontalGroup>
        </div>
        <label className="gf-form-label">Sensor Selection</label>
        <div className="gf-form width-40">
          <Select options={this.myFactoryOptions} onChange={this.onFactoryChange} placeholder="Factory"></Select>
          <Select options={this.myMachineOptions} onChange={this.onMachineChange} placeholder="Machine"></Select>
          <Select options={this.mySensorOptions} onChange={this.onSensorChange} placeholder="Sensor"></Select>
        </div>
      </div>
    );
  }
}
