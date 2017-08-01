import _ from "lodash";

export class LFDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.buckets = 2; // FIXME! calculate this value
    this.maxDataPoints = 10000; // FIXME! calculate this value
  }

  query (options) {
    var self = this;
    var query = this.buildQueryParameters(options);
    //query.targets = query.targets.filter(t => !t.hide);
    query.targets = query.targets.filter(t => { return !t.hide; });

    if (query.targets.length <= 0) {
      return this.q.when({ data : [] });
    }


    var items = [];
    var properties = [];

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
    var propertyVal = undefined;
    if (properties.length > 0) {
      propertyVal = properties.join(' ');
    }

    return this
        .loadData(itemVal, propertyVal,
            options.range.from.valueOf(),
            options.range.to.valueOf())
        //.then(results => {
        .then((results) => {
          //var data = results.map(v => {
          var data = results.map((v) => {
            var targetName = self.displayName("http://linkedfactory.iwu.fraunhofer.de/linkedfactory/", "lf:", v.item, v.property);
            var values = v.values;

            // get the config entry to access scale etc.
            //var target = _.filter(query.targets, target => {
            var target = _.filter(query.targets, target => {
              // FIXME: change handling of item/property
              var _item = target.item.split(/[ ]+/)[1];
              var _property = target.property.split(/[ ]+/)[1];
              return (v.item === _item && v.property === _property);
            })[0];
            var scale = (target && target.scale ? target.scale : 1);

            if (typeof scale === 'undefined') {
              scale = 1;
            }

            //var datapoints = values.map(d => {
            var datapoints = values.map(d => {
              return [ d.value * scale, d.time ];
            });
            return { target : targetName, datapoints : datapoints };
          });
          return { data : data };
        });
  };

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/values',
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      };
      return {
        status : "failure",
        message : "The server returned status " + response.status + " '" + response.statusText + "'",
        title : "Failure"
      };
    }, (failure) => {
      return {
        status : "failure",
        message : failure.message,
        title : "Failure"
      };
    });
  }
//
loadData(items, properties, from, to) {
  var interval = Math.round((to - from) / this.maxDataPoints);
  var limit = this.maxDataPoints / this.buckets;
  var self = this;
  return this.backendSrv
      .datasourceRequest({
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
          var loadOlderData = false;
          var promises = [];
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
                        return { item : item, property : property, values : d[0].values.concat(newPropertyData) };
                      }));
              } else {
                promises.push({ item : item, property : property, values : newPropertyData });
              }
            });
          });
          // see below
          //return Promise.all(promises);
          return self.promiseAll(promises);
        }
      });
};
//



  annotationQuery(options) {
    return this.q.when({ data : [] });
  }

//this function gets the query for the item
itemFindQuery(query) {
  if (! this.items) {
    this.items = this.backendSrv.datasourceRequest({
      url: this.url + '/**',
      method: 'GET'
    }).then(response => {
      console.log(response);
      if (response.status === 200) {
        return response.data;
      };
      return [];
    }, (failure) => {
      return [];
    });
  }
  return this.items.then((items) => {
    return items.map((bindUrl,itemUrl,itemUrlUp,strShort) => {
      itemUrl= bindUrl['@id'];
      itemUrlUp= itemUrl.toUpperCase();
      strShort= this.localPart(itemUrlUp);
      return { text: strShort +":  "+itemUrl, value: itemUrl};
    });
  });
};


propertyFindQuery(item, query) {
  if (this.properties) {
    this.properties = this.backendSrv.datasourceRequest({
      url: this.url + '/properties?item=',
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return response.data;
      };
      return [];
    }, (failure) => {
      return [];
    });
  }
  if (item) {
    this.properties = this.backendSrv.datasourceRequest({
      url: this.url + '/properties?item=' + this.localPart2(item),
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return response.data;
      };
      return [];
    }, (failure) => {
      return [];
    });
  }
  return this.properties.then((properties) => {
    return properties.map((bindUrl,propertyUrl,propertyUrlUp,result) => {
      propertyUrl= bindUrl['@id'];
      propertyUrlUp= propertyUrl.toUpperCase();
      result = propertyUrlUp;
      return  { text: this.localPart(result) +": "+ propertyUrl, value: propertyUrl};
    });
  });
};


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
        // LF-specific fields
        item : target.item,
        property : target.property,
        scale : target.scale
      };
    });

    options.targets = targets;

    return options;
  }
  //
  // helper to construct a short display name for item + property
	displayName(prefixStr, prefix, item, property) {
		return item.replace(prefixStr, prefix) + '@' + this.localPart(property);
	}
  // helper to get the localPart of an URI (used to display short properties)
	localPart(uriString) {
		var separator = (uriString.lastIndexOf('#') > 0 ? '#' : '/');
		return uriString.substring(uriString.lastIndexOf(separator) + 1);
	}

// helper to shorten the item string for propertyFindQuery
localPart2(uriString) {
  var separator = (uriString.lastIndexOf('#') > 0 ? '#' : ':');
  return uriString.substring(uriString.lastIndexOf(separator) + -4);
}



	// instead of Promise.all(), which isn't supported by some browsers,
	// use this version, courtesy of https://www.promisejs.org/patterns/
promiseAll(promises) {
		var accumulator = [];
		var ready = Promise.resolve({});

		promises.forEach((promise) => {
			ready = ready.then(()=> {
				return promise;
			}).then((value) => {
				accumulator.push(value);
			});
		});

		return ready.then(() => {
			return accumulator;
		});
	}

}
