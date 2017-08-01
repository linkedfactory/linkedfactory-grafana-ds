'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, LFDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('LFDatasource', LFDatasource = function () {
        function LFDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, LFDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.buckets = 2; // FIXME! calculate this value
          this.maxDataPoints = 10000; // FIXME! calculate this value
        }

        _createClass(LFDatasource, [{
          key: 'query',
          value: function query(options) {
            var self = this;
            var query = this.buildQueryParameters(options);
            //query.targets = query.targets.filter(t => !t.hide);
            query.targets = query.targets.filter(function (t) {
              return !t.hide;
            });

            if (query.targets.length <= 0) {
              return this.q.when({ data: [] });
            }

            var items = [];
            var properties = [];

            _.forEach(query.targets, function (target) {
              if (target.item && !_.includes(items, target.item)) {
                items.push(target.item);
              }
              if (target.property && !_.includes(properties, target.property)) {
                properties.push(target.property);
              }
            });
            if (items.length <= 0) {
              return this.q.when({ data: [] });
            }
            var itemVal = items.join(' ');
            // if not set, keep undefined to load all properties
            var propertyVal = undefined;
            if (properties.length > 0) {
              propertyVal = properties.join(' ');
            }

            return this.loadData(itemVal, propertyVal, options.range.from.valueOf(), options.range.to.valueOf())
            //.then(results => {
            .then(function (results) {
              //var data = results.map(v => {
              var data = results.map(function (v) {
                var targetName = self.displayName("http://linkedfactory.iwu.fraunhofer.de/linkedfactory/", "lf:", v.item, v.property);
                var values = v.values;

                // get the config entry to access scale etc.
                //var target = _.filter(query.targets, target => {
                var target = _.filter(query.targets, function (target) {
                  // FIXME: change handling of item/property
                  var _item = target.item.split(/[ ]+/)[1];
                  var _property = target.property.split(/[ ]+/)[1];
                  return v.item === _item && v.property === _property;
                })[0];
                var scale = target && target.scale ? target.scale : 1;

                if (typeof scale === 'undefined') {
                  scale = 1;
                }

                //var datapoints = values.map(d => {
                var datapoints = values.map(function (d) {
                  return [d.value * scale, d.time];
                });
                return { target: targetName, datapoints: datapoints };
              });
              return { data: data };
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/values',
              method: 'GET'
            }).then(function (response) {
              if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
              };
              return {
                status: "failure",
                message: "The server returned status " + response.status + " '" + response.statusText + "'",
                title: "Failure"
              };
            }, function (failure) {
              return {
                status: "failure",
                message: failure.message,
                title: "Failure"
              };
            });
          }
        }, {
          key: 'loadData',
          value: function loadData(items, properties, from, to) {
            var interval = Math.round((to - from) / this.maxDataPoints);
            var limit = this.maxDataPoints / this.buckets;
            var self = this;
            return this.backendSrv.datasourceRequest({
              url: this.url + '/values',
              params: {
                items: items,
                properties: properties,
                from: from,
                to: to,
                limit: limit,
                interval: interval,
                // FIXME: use setting from config (target.downsampling, maybe?)
                op: 'avg'
              },
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            })
            //.then(response => {
            .then(function (response) {
              if (response.status === 200) {
                var loadOlderData = false;
                var promises = [];
                //Object.keys(response.data).forEach(item => {
                if (!response.data) {
                  console.log("Oops! No response data?!");
                  console.log(response);
                }
                Object.keys(response.data).forEach(function (item) {
                  var newItemData = response.data[item];
                  //Object.keys(newItemData).forEach(property => {
                  Object.keys(newItemData).forEach(function (property) {
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
                      promises.push(self.loadData(item, property, from, localTo)
                      //.then(d => {
                      .then(function (d) {
                        // FIXME: d is an array! handle appropriately
                        return { item: item, property: property, values: d[0].values.concat(newPropertyData) };
                      }));
                    } else {
                      promises.push({ item: item, property: property, values: newPropertyData });
                    }
                  });
                });
                // see below
                //return Promise.all(promises);
                return self.promiseAll(promises);
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            return this.q.when({ data: [] });
          }
        }, {
          key: 'itemFindQuery',
          value: function itemFindQuery(query) {
            var _this = this;

            if (!this.items) {
              this.items = this.backendSrv.datasourceRequest({
                url: this.url + '/**',
                method: 'GET'
              }).then(function (response) {
                console.log(response);
                if (response.status === 200) {
                  return response.data;
                };
                return [];
              }, function (failure) {
                return [];
              });
            }
            return this.items.then(function (items) {
              return items.map(function (bindUrl, itemUrl, itemUrlUp, strShort) {
                itemUrl = bindUrl['@id'];
                itemUrlUp = itemUrl.toUpperCase();
                strShort = _this.localPart(itemUrlUp);
                return { text: strShort + ":  " + itemUrl, value: itemUrl };
              });
            });
          }
        }, {
          key: 'propertyFindQuery',
          value: function propertyFindQuery(item, query) {
            var _this2 = this;

            if (this.properties) {
              this.properties = this.backendSrv.datasourceRequest({
                url: this.url + '/properties?item=',
                method: 'GET'
              }).then(function (response) {
                if (response.status === 200) {
                  return response.data;
                };
                return [];
              }, function (failure) {
                return [];
              });
            }
            if (item) {
              this.properties = this.backendSrv.datasourceRequest({
                url: this.url + '/properties?item=' + this.localPart2(item),
                method: 'GET'
              }).then(function (response) {
                if (response.status === 200) {
                  return response.data;
                };
                return [];
              }, function (failure) {
                return [];
              });
            }
            return this.properties.then(function (properties) {
              return properties.map(function (bindUrl, propertyUrl, propertyUrlUp, result) {
                propertyUrl = bindUrl['@id'];
                propertyUrlUp = propertyUrl.toUpperCase();
                result = propertyUrlUp;
                return { text: _this2.localPart(result) + ": " + propertyUrl, value: propertyUrl };
              });
            });
          }
        }, {
          key: 'buildQueryParameters',
          value: function buildQueryParameters(options) {
            var _this3 = this;

            // remove placeholder targets
            //options.targets = _.filter(options.targets, target => {
            options.targets = _.filter(options.targets, function (target) {
              return target.item !== 'select item' && target.property !== 'select property';
            });

            //var targets = _.map(options.targets, target => {
            var targets = _.map(options.targets, function (target) {
              return {
                // default fields
                target: _this3.templateSrv.replace(target.target),
                refId: target.refId,
                hide: target.hide,
                // LF-specific fields
                item: target.item,
                property: target.property,
                scale: target.scale
              };
            });

            options.targets = targets;

            return options;
          }
        }, {
          key: 'displayName',
          value: function displayName(prefixStr, prefix, item, property) {
            return item.replace(prefixStr, prefix) + '@' + this.localPart(property);
          }
        }, {
          key: 'localPart',
          value: function localPart(uriString) {
            var separator = uriString.lastIndexOf('#') > 0 ? '#' : '/';
            return uriString.substring(uriString.lastIndexOf(separator) + 1);
          }
        }, {
          key: 'localPart2',
          value: function localPart2(uriString) {
            var separator = uriString.lastIndexOf('#') > 0 ? '#' : ':';
            return uriString.substring(uriString.lastIndexOf(separator) + -4);
          }
        }, {
          key: 'promiseAll',
          value: function promiseAll(promises) {
            var accumulator = [];
            var ready = Promise.resolve({});

            promises.forEach(function (promise) {
              ready = ready.then(function () {
                return promise;
              }).then(function (value) {
                accumulator.push(value);
              });
            });

            return ready.then(function () {
              return accumulator;
            });
          }
        }]);

        return LFDatasource;
      }());

      _export('LFDatasource', LFDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
