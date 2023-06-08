import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { Select, Slider, MultiSelect } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  items: Array<SelectableValue<string>> = [];
  properties: Array<SelectableValue<string>> = [];

  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.getItems();
    if (props.query.item) {
      const item = props.query.item;
      this.items.push({ label: item, value: item });

      const properties = props.query.property;
      if (properties && properties.length) {
        this.properties = properties.map(p => {
          return {label: p, value: p };
        });
      }
      this.getProperties(props.query.item);
    } 
  }

  // get all items
  getItems() {
    const settings = this.props.datasource.settings;
    const url = this.props.datasource.url + '/**?item=';
    const options: BackendSrvRequest = {
      url: url,
      method: 'GET'
    }

    if (settings.jsonData.user) {
      options.headers = { 'Authorization' : 'Basic ' + btoa(settings.jsonData.user + ":" + settings.jsonData.password) }
    }

    let self = this;
    return getBackendSrv().fetch<any>(options).subscribe(response => {
      response.data.forEach((e: any) => {
        let el = e['@id'];
        let option = { label: el, value: el };
        if (! self.items.includes(option)) {
          self.items.push(option);
        }
      });
      self.forceUpdate();
    });
  }

  // get properties for a given item
  getProperties(item: string) {
    const settings = this.props.datasource.settings;
    const url = this.props.datasource.url + '/properties?item=' + item;
    const options: BackendSrvRequest = {
      url: url,
      method: 'GET'
    }

    if (settings.jsonData.user) {
      options.headers = { 'Authorization' : 'Basic ' + btoa(settings.jsonData.user + ":" + settings.jsonData.password) }
    }

    let self = this;
    return getBackendSrv().fetch<any>(options).subscribe(response => {
      response.data.forEach((e: any) => {
        let el = e['@id'];
        let option = { label: el, value: el };
        if (! self.properties.includes(option)) {
          self.properties.push(option);
        }
      });
      self.forceUpdate();
    });
  }

  onItemChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, item: value.value!.toString() });
    this.properties = [];
    this.getProperties(value.value!.toString());
    onRunQuery();
  }

  onPropertyChange = (value: Array<SelectableValue<string>>) => {
    const { onChange, query, onRunQuery } = this.props;
    let props: string[] = [];
    value.forEach(v => {
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

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { } = query;

    return (
      <div className="gf-form-inline id=form">
        <div className="gf-form" style={{ width: '70%', display: 'flex', alignItems: 'flex-end' }}>
          <Select options={this.items} onChange={this.onItemChange} placeholder="Item" value={query.item}></Select>
          <MultiSelect options={this.properties} onChange={this.onPropertyChange} placeholder="Property" value={query.property}></MultiSelect>
          <Slider
            step={0.1}
            value={1}
            min={0.1}
            max={10}
            marks={{
              "2": 2,
              "4": 4,
              "6": 6,
              "8": 8,
              "10": 10
            }}
            onChange={this.onScaleChange}></Slider>
        </div>
      </div>
    );
  }
}
