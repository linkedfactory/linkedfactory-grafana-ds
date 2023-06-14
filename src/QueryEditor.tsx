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
  properties: Array<Array<SelectableValue<string>>>;

  constructor(props: Props | Readonly<Props>) {
    super(props);
    const propertyPath = props.query.propertyPath;
    this.properties = Array(propertyPath && propertyPath.length ? propertyPath.length : 1).fill([])
    this.loadItems();
    if (props.query.item) {
      const item = props.query.item;
      this.items.push({ label: item, value: item });

      if (propertyPath && propertyPath.length) {
        propertyPath.forEach((value, index) => {
          this.properties[index] = value.map(p => {
            return { label: p.toString(), value: p.toString() };
          });
        });
      }
      this.loadProperties(0);
      if (propertyPath && propertyPath.length) {
        for (let i = 1; i < propertyPath.length; i++) {
          this.loadProperties(i);
        }
      }
    }
  }

  // get all items
  loadItems() {
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
  loadProperties(index: number) {
    const self = this;
    const propertyPath = index === 0 ? undefined : this.props.query.propertyPath.slice(0, index)
    if (propertyPath) {
      // signal that we want any property
      propertyPath.push(["*"])
    }
    this.props.datasource.queryProperties(this.props.query.item, propertyPath).subscribe(properties => {
      // sort the properties first
      properties.sort();
      properties.forEach(p => {
        let option = { label: p, value: p };
        if (!self.properties[index].includes(option)) {
          self.properties[index].push(option);
        }
      });
      self.forceUpdate();
    });
  }

  onItemChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, item: value.value!.toString() });
    this.properties = [[]];
    this.loadProperties(0);
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
    this.properties.push([]);
    this.loadProperties(this.properties.length - 1);
    onChange({ ...query });
  }

  popPath = () => {
    const { onChange, query } = this.props;
    query.propertyPath.pop();
    this.properties.pop();
    onChange({ ...query });
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { } = query;

    return (
      <div className="gf-form gf-form--offset-1">
        <Select className="gf-form-input" options={this.items} onChange={this.onItemChange} placeholder="Item" value={query.item}></Select>
        {query.propertyPath.map((p, pathIndex) => {
          return <>{pathIndex > 0 ? <span>&nbsp;/&nbsp;</span> : <span></span>}
            <MultiSelect key={pathIndex} className="gf-form-input" options={this.properties[pathIndex]} onChange={this.onPropertyChange(pathIndex)}
              placeholder="Property" value={p} allowCustomValue={true}></MultiSelect>
          </>
        })}
        {query.propertyPath.length > 1 ? <Button className="gf-form-btn" onClick={this.popPath} icon='trash-alt'></Button> : null}
        <Button className="gf-form-btn" onClick={this.pushPath}>/</Button>
        <Slider step={0.1} value={1} min={0.1} max={10} marks={{ "1": 1, "2": 2, "10": 10 }} onChange={this.onScaleChange}></Slider>
      </div>
    );
  }
}
