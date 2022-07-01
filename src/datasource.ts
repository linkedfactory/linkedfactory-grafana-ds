import * as _ from 'lodash';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataQueryResponse,
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
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.jsonData.url;
    this.currentUrl = '';
    this.settings = instanceSettings;
    this.q = '';
    this.templateSrv = getTemplateSrv();
    this.maxDataPoints = 10000;
    this.buckets = 2;
  }

  buildQueryParameters(options) {
    // remove placeholder targets
    //options.targets = _.filter(options.targets, target => {

    options.targets = _.filter(options.targets, target => {
      return ((target.item !== 'select item') && (target.property !== 'select property'));
    });

    //var targets = _.map(options.targets, target => {
    var targets = _.map(options.targets, target => {
      return {
        // default fields
        target : this.templateSrv.replace(target.target),
        refId : target.refId,
        hide : target.hide,
        // LF-specific fields -> URL??
        item : this.url + '/demofactory' + target.item,
        property: target.property,
        scale : target.scale
      };
    });
    options.targets = targets;
    return options;
  }

  loadData(items, properties, from, to) {
    var interval = Math.round((to - from) / this.maxDataPoints);
    var limit = this.maxDataPoints / this.buckets;
    var self = this;

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
            //var loadOlderData = false;
            var promises: Array<any> = [];
            //Object.keys(response.data).forEach(item => {
            if (!response.data) {
              console.log("Oops! No response data?!");
              console.log(response);
            }

            Object.keys(response.data).forEach((item) => {
              var newItemData = response.data[item];
              //Object.keys(newItemData).forEach(property => {
              Object.keys(newItemData).forEach((property) => {
                var newPropertyData = newItemData[property];
                if (!newPropertyData || newPropertyData.length == 0) {
                  return;
                } else {
                  // LF returns data in latest-first order
                  // .sort() nach zeit 
                  newPropertyData.reverse();
                }
  
                if (newPropertyData.length == limit) {
                  // limit reached, fetch earlier blocks, keep from
                  // but stop at earliest time already read - 1
                  var localTo = newPropertyData[0].time - 1;
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
		var separator = (uriString.lastIndexOf('#') > 0 ? '#' : '/');
		return uriString.substring(uriString.lastIndexOf(separator) + 1);
	}

    
  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    var self = this;

    var query = this.buildQueryParameters(options);

    //query.targets = query.targets.filter(t => !t.hide);
    query.targets = query.targets.filter(t => { return !t.hide; });

    if (query.targets.length <= 0) {
      return this.q.when({ data : [] });
    }

    var items: string[] = [];
    var properties: string[] = [];

    var itemProperties = new Map<string, Set<string>>();
    _.forEach(query.targets, t => {
      itemProperties.set(t.item, (itemProperties.get(t.item) || new Set<string>()).add(t.property));
    });

    var propertiesToItems = new Map<string, Set<string>>();
    for (let [item, properties] of itemProperties){
      let propertiesKey = Array.from(properties.values()).sort().join(' ');
      propertiesToItems.set(propertiesKey, (propertiesToItems.get(propertiesKey) || new Set<string>()).add(item));
    }
    
    _.forEach(query.targets, target => {
      if (target.item && !_.includes(items, target.item)) {
        items.push(target.item);
      }
      if (target.property && !_.includes(properties, target.property)) {
        properties.push(target.property);
      }
    });
    if (items.length <= 0) {
      return this.q.when({ data : [] });
    }
    var itemVal = items.join(' ');
    // if not set, keep undefined to load all properties
    var propertyVal: string = '';
    if (properties.length > 0) {
      propertyVal = properties.join(' ');
    }

    var allPromises: Array<any> = []; 
    var that = this;

    var fillPromiseArrayPromise = new Promise((resolve, reject) => {
      for(let [property, items] of propertiesToItems){
        items.forEach(function(i){
          that.loadData(i, property, options.range.from.valueOf(), options.range.to.valueOf())
              .then((res) =>{
                allPromises.push(res);
              });
        });
      }
      resolve(allPromises);
    });
    fillPromiseArrayPromise.then((promises) =>{
      if(Array.isArray(promises)){
        console.log(promises); // gibt richtiges objekt aus -> "Array"

        // funktioniert nicht
        promises.forEach(function(){
          // hier Daten auseinandernehmen, scale einberechnen
        })
      }
    }).catch((e) =>{
      console.error(e);
    });
    
    return this
        .loadData(itemVal, propertyVal,
            options.range.from.valueOf(),
            options.range.to.valueOf())
        //.then(results => {
        .then((results) => {
          //var data = results.map(v => {
          var data = results!.map((v) => {
            var targetName = self.prefixName(self.url, "lf:", v.item, v.property);
            var values = v.values;

            // get the config entry to access scale etc.
            //var target = _.filter(query.targets, target => {
            var target = _.filter(query.targets, target => {
              // FIXME: change handling of item/property
              /*var _item = target.item.split(/[ ]+/)[1];
              var _property = target.property.split(/[ ]+/)[1];
              return (v.item === _item && v.property === _property);*/
              return (target)
            })[0];

            var scale = (target && target.scale ? target.scale : 1);

            //var datapoints = values.map(d => {
            var datapoints = values.map(d => {
              return [ d.value * scale, d.time ];
            });
            return { target : targetName, datapoints : datapoints };
          });
          return { data : data };
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
        if(r.status == 200) {
          return {status: "success", message: "LinkedFactory Online!", title: "Success"}
        }
      });
  }
}
