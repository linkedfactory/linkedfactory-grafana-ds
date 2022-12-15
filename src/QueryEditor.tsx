import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { Select, Slider, MultiSelect } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';
import { getBackendSrv } from '@grafana/runtime';
//import { takeRightWhile, values } from 'lodash';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {

  myFactoryOptions: Array<{}> = [];
  myMachineOptions: Array<{}> = [];
  mySensorOptions: Array<{}> = [];

  myItemOptions: Array<{}> = [];
  myPropertyOptions: Array<{}> = [];

  allOptions: Array<Array<{}>> = [
    this.myFactoryOptions, 
    this.myMachineOptions, 
    this.mySensorOptions
  ];

  //TODO: how to get instancesettings from DataSource object?
  lfUrl = "http://localhost:8080/linkedfactory";

  //get all items
  getItems(){
    let that = this;
    const url = this.lfUrl + '/**';
    const promise = getBackendSrv().datasourceRequest({
      method: 'GET',
      url: url
    });
    promise.then(function(r){
      r.data.forEach(e => {
        let el = e['@id'].split(that.lfUrl + '/demofactory')[1];
        let element = {label: el, value: el}
        if(!that.myItemOptions.includes(element)) {
          that.myItemOptions.push(element);
        }
      });
    });
  }

  //get property if item is set
  getProperties(item){
    let that = this;
    const url = this.lfUrl + '/properties?item=' + this.lfUrl + '/demofactory' + item;
    const promise = getBackendSrv().datasourceRequest({
      method: 'GET',
      url: url
    });
    promise.then(function(r){
      r.data.forEach(e => {
        let el = {label: e['@id'], value: e['@id']};
        if(!that.myPropertyOptions.includes(el)) {
          that.myPropertyOptions.push(el);
        }
      });
    })
  }

  onItemChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, item: value.value! });
    this.getProperties(value.value);
    onRunQuery();
  }

  onPropertyChange = (value: Array<SelectableValue<string>>) => {
    const { onChange, query, onRunQuery } = this.props;
    let props: string[] = [];
    value.forEach(v=>{
      props.push(v.value!)
    });
    onChange({ ...query, property: props });
    onRunQuery();
  }

  onScaleChange = (value: number) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, scale: value! });
    onRunQuery();
  }

  shouldComponentUpdate(){
    return false;
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const {} = query;
    this.getItems();

    return (
      <div className="gf-form-inline id=form">
        <div className="gf-form" style={{width: '70%', display: 'flex', alignItems: 'flex-end'}}>
            <Select options={this.myItemOptions} onChange={this.onItemChange} placeholder="Item"></Select>
            <MultiSelect options={this.myPropertyOptions} onChange={this.onPropertyChange} placeholder="Property"></MultiSelect>
            <Slider 
              step={0.1} 
              value={1} 
              min={0.1} 
              max={10} 
              marks={{ 
                      "2" : 2,
                      "4" : 4,
                      "6" : 6,
                      "8" : 8,
                      "10" : 10
                    }} 
              onChange={this.onScaleChange}></Slider>
          
        </div>
      </div>
    );
  }
}
