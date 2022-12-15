import * as _ from 'lodash';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceInstanceSettings
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions} from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  settings?: any;
  currentUrl: string;
  q: any;
  templateSrv: any;
  maxDataPoints: number;
  buckets: number;
  returnData: DataQueryResponseData[];
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.currentUrl = '';
    this.settings = instanceSettings;
    this.q = '';
    this.templateSrv = getTemplateSrv();
    this.maxDataPoints = 10000;
    this.buckets = 2;
    this.returnData = [];
  }

  buildQueryParameters(options) {
    // remove placeholder targets
    //options.targets = _.filter(options.targets, target => {

    options.targets = _.filter(options.targets, target => {
      return ((target.item !== 'select item') && (target.property !== 'select property'));
    });

    let targets = _.map(options.targets, target => {
      return {
        // default fields
        target : this.templateSrv.replace(target.target),
        refId : target.refId,
        hide : target.hide,
        item : this.url + '/demofactory' + target.item,
        property: target.property,
        scale : target.scale
      };
    });
    options.targets = targets;
    return options;
  }

  loadData(items, properties, from, to) {
    let interval = Math.round((to - from) / this.maxDataPoints);
    let limit = this.maxDataPoints / this.buckets;
    let self = this;

    return getBackendSrv().datasourceRequest({
          url : this.url + '/values',
          params : {
            items : items,
            properties : properties,
            from : from,
            to : to,
            limit : limit,
            interval : interval,
            // FIXME: use setting from config (target.downsampling, maybe?)
            op : 'avg'
          },
          method : 'GET',
          headers : { 'Content-Type' : 'application/json'	}
        })
        //.then(response => {
        .then(response => {
          if (response.status === 200) {
            //let loadOlderData = false;
            let promises: any[] = [];
            //Object.keys(response.data).forEach(item => {
            if (!response.data) {
              console.log("Oops! No response data?!");
              console.log(response);
            }

            Object.keys(response.data).forEach((item) => {
              let newItemData = response.data[item];
              //Object.keys(newItemData).forEach(property => {
              Object.keys(newItemData).forEach((property) => {
                let newPropertyData = newItemData[property];
                if (!newPropertyData || newPropertyData.length === 0) {
                  return;
                } else {
                  // LF returns data in latest-first order
                  // .sort() nach zeit 
                  newPropertyData.reverse();
                }
  
                if (newPropertyData.length === limit) {
                  // limit reached, fetch earlier blocks, keep from
                  // but stop at earliest time already read - 1
                  let localTo = newPropertyData[0].time - 1;
                  promises.push(
                      self.loadData(item, property, from, localTo)
                        //.then(d => {
                        .then(d => {
                          
                          // FIXME: d is an array! handle appropriately
                          return { item : item, property : property, values : d![0].values.concat(newPropertyData) };
                        }));
                } else {
                  
                  promises.push({ item : item, property : property, values : newPropertyData });
                }
              });
            });
            // see below
            return Promise.all(promises);
            //return self.promiseAll(promises);
          }
        });
  };
  
  // helper to construct a short display name for item + property
	prefixName(prefixStr, prefix, item, property) {
    //    if (item.indexOf(prefixStr) > -1) {
          return item.replace(prefixStr, prefix) + '@' + this.localPart(property);
    //    } else {
    //      return item.replace(prefixStr.replace("https://", "http://"), prefix) + '@' + this.localPart(property);
    //    }
  }

  // helper to get the localPart of an URI (used to display short properties)
	localPart(uriString) {
		let separator = (uriString.lastIndexOf('#') > 0 ? '#' : '/');
		return uriString.substring(uriString.lastIndexOf(separator) + 1);
	}

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    let self = this;
    let query = this.buildQueryParameters(options);

    //query.targets = query.targets.filter(t => !t.hide);
    query.targets = query.targets.filter(t => { return !t.hide; });

    if (query.targets.length <= 0) {
      return this.q.when({ data : [] });
    }

    let itemProperties = new Map<string, Set<string>>();
    let itemPropertyToScale = new Map<string, number>();

    _.forEach(query.targets, t => {
      if(t.property !== undefined){
        itemProperties.set(t.item, (itemProperties.get(t.item) || new Set<string>(t.property)));
        if(!t.scale) {
          t.scale = 1;
        }
        t.property.forEach(p => {
          itemPropertyToScale.set([t.item, p].join(' '), t.scale);
        });
      }
    });

    let propertiesToItems = new Map<string, Set<string>>();
    for (let [item, properties] of itemProperties){
      let propertiesKey = Array.from(properties.values()).sort().join(' ');
      propertiesToItems.set(propertiesKey, (propertiesToItems.get(propertiesKey) || new Set<string>()).add(item));
    }

    let allPromises: any[] = []; 
    let that = this;

      for(let [property, items] of propertiesToItems){
        items.forEach(function(i){
          property.split(' ').forEach(function(p){
            allPromises.push(that.loadData(i, p, options.range.from.valueOf(), options.range.to.valueOf()));
          });
        });
      }
    
    return Promise.all(allPromises).then(function(p){
      let returnData: DataQueryResponseData[] = [];
      p.forEach(value =>{
        let data = value!.map(v =>{
          let targetName = self.prefixName(self.url, "lf:", v.item, v.property);
            let scale = itemPropertyToScale.get([v.item, v.property].join(' '));
            let datapoints = v.values.map(d => {
              return [ d.value * scale!, d.time ];
            });
            return { target : targetName, datapoints : datapoints };
        });
        if (data[0]) {
          returnData.push(data[0]);
        }
        return { data : data };
      });
      return { data : returnData }  
    });
  }
  async testDatasource() {

    return getBackendSrv()
      .datasourceRequest({
        url: this.url! + '/linkedfactory',
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
        if(r.status === 200) {
          return {status: "success", message: "LinkedFactory Online!", title: "Success"}
        }
      });
  }
}
