import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { Select, Slider, MultiSelect, Button } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './Datasource';
import { defaultQuery, LFDataSourceOptions, LFQuery } from './types';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

type Props = QueryEditorProps<DataSource, LFQuery, LFDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  items: Array<SelectableValue<string>> = [];
  properties: Array<SelectableValue<string>> = [];

  constructor(props: Props | Readonly<Props>) {
    super(props);
    this.getItems();
    if (props.query.item) {
      const item = props.query.item;
      this.items.push({ label: item, value: item });

      const propertyPath = props.query.propertyPath;
      if (propertyPath && propertyPath.length) {
        this.properties = propertyPath[0].map(p => {
          return { label: p.toString(), value: p.toString() };
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
      options.headers = { 'Authorization': 'Basic ' + btoa(settings.jsonData.user + ":" + settings.jsonData.password) }
    }

    let self = this;
    return getBackendSrv().fetch<any>(options).subscribe(response => {
      response.data.forEach((e: any) => {
        let el = e['@id'];
        let option = { label: el, value: el };
        if (!self.items.includes(option)) {
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
      options.headers = { 'Authorization': 'Basic ' + btoa(settings.jsonData.user + ":" + settings.jsonData.password) }
    }

    let self = this;
    return getBackendSrv().fetch<any>(options).subscribe(response => {
      response.data.forEach((e: any) => {
        let el = e['@id'];
        let option = { label: el, value: el };
        if (!self.properties.includes(option)) {
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

  onPropertyChange(index: number) {
    return (value: Array<SelectableValue<string>>) => {
      const { onChange, query, onRunQuery } = this.props;
      let props: string[] = [];
      value.forEach(v => {
        props.push(v.value!)
      });
      query.propertyPath[index] = props
      onChange({ ...query });
      onRunQuery();
    };
  }

  onScaleChange = (value: number) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, scale: value! });
    onRunQuery();
  }

  pushPath = () => {
    const { onChange, query } = this.props;
    query.propertyPath.push([]);
    onChange({ ...query });
  }

  popPath = () => {
    const { onChange, query } = this.props;
    query.propertyPath.pop();
    onChange({ ...query });
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { } = query;

    return (
      <div className="gf-form gf-form--offset-1">
        <Select className="gf-form-input" options={this.items} onChange={this.onItemChange} placeholder="Item" value={query.item}></Select>
        {query.propertyPath.map((p, pathIndex) => {
          return <MultiSelect key={pathIndex} className="gf-form-input" options={this.properties} onChange={this.onPropertyChange(pathIndex)}
            placeholder="Property" value={p} allowCustomValue={true}></MultiSelect>
        })}
        {query.propertyPath.length > 1 ? <Button className="gf-form-btn" onClick={this.popPath} icon='trash-alt'></Button> : null}
        <Button className="gf-form-btn" onClick={this.pushPath}>/</Button>
        <Slider step={0.1} value={1} min={0.1} max={10} marks={{ "1": 1, "2": 2, "10": 10 }} onChange={this.onScaleChange}></Slider>
      </div>
    );
  }
}
