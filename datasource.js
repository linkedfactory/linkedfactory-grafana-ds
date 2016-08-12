define([
	'angular',
	'lodash',
	'app/plugins/sdk',
	'app/core/utils/datemath',
	'app/core/utils/kbn',
	'./query_ctrl'
],
function (angular, _, sdk, dateMath, kbn) {
	'use strict';

	var self;

	function LFDatasource(instanceSettings, $q, backendSrv, templateSrv) {
		this.type = instanceSettings.type;
		this.url = instanceSettings.url;
		this.name = instanceSettings.name;
		this.supportMetrics = true;
		this.q = $q;
		this.backendSrv = backendSrv;
		this.templateSrv = templateSrv;

		// FIXME! add these to the ds config, and maybe metric config
		this.limit = 1000;
		this.intervalSteps = 10000;

		self = this;
	}

	// required, for testing datasource on ds configuration page
	LFDatasource.prototype.testDatasource = function() {
		return self.backendSrv.datasourceRequest({
			url : self.url + '/values',
			method : 'GET'
		})
		//.then(response => {
		.then(function(response) {
			if (response.status === 200) {
				return {
					status : "success",
					message : "Data source is working",
					title : "Success"
				};
			}
			return {
				status : "failure",
				message : "The server returned status " + response.status + " '" + response.statusText + "'",
				title : "Failure"
			};
		}, function(failure) {
			return {
				status : "failure",
				message : failure.message,
				title : "Failure"
			};
		});
	};

	// required, for getting data for configured metrics
	// called once per panel (graph)
	LFDatasource.prototype.query = function(options) {
		var query = buildQueryParameters(options);
		//query.targets = query.targets.filter(t => !t.hide);
		query.targets = query.targets.filter(function(t) { return !t.hide; });

		if (query.targets.length <= 0) {
			return self.q.when({ data : [] });
		}

		// FIXME! use individual queries
		var items = [];
		var properties = [];

		_.forEach(query.targets, function(target) {
			if (target.item && !_.contains(items, target.item)) {
				items.push(target.item);
			}
			if (target.property && !_.contains(properties, target.property)) {
				properties.push(target.property);
			}
		});
		if (items.length <= 0) {
			return self.q.when({ data : [] });
		}
		var itemVal = items.join(' ');
		// if not set, keep undefined to load all properties
		var propertyVal = undefined;
		if (properties.length > 0) {
			propertyVal = properties.join(' ');
		}

		return self
				.loadData(itemVal, propertyVal,
						options.range.from.valueOf(),
						options.range.to.valueOf())
				//.then(results => {
				.then(function(results) {
					//var data = results.map(v => {
					var data = results.map(function(v) {
						var targetName = displayName("http://linkedfactory.iwu.fraunhofer.de/linkedfactory/", "lf:", v.item, v.property);
						var values = v.values;

						// get the config entry to access scale etc.
						//var target = _.filter(query.targets, target => {
						var target = _.filter(query.targets, function(target) {
							return (v.item === target.item && v.property === target.property);
						})[0];
						var scale = (target ? target.scale : 1);
						if (typeof scale === 'undefined') {
							scale = 1;
						}

						//var datapoints = values.map(d => {
						var datapoints = values.map(function(d) {
							return [ d.value * scale, d.time ];
						});
						return { target : targetName, datapoints : datapoints };
					});
					return { data : data };
				});
	};

	// optional, for annotation support
	// TODO: IMPLEMENT, just returns an empty result
	LFDatasource.prototype.annotationQuery = function(options) {
		return self.q.when({ data : [] });
	};

	// optional, for templating support
	// TODO: IMPLEMENT, just returns an empty result
	LFDatasource.prototype.metricFindQuery = function(options) {
		return self.q.when({ data : [] });
	};

	// actual loading from the LinkedFactory back-end
	// returns a list of promises with the data blocks
	LFDatasource.prototype.loadData = function(items, properties, from, to) {
		var interval = Math.round((to - from) / self.intervalSteps);
		return self.backendSrv
				.datasourceRequest({
					url : self.url + '/values',
					params : {
						items : items,
						properties : properties,
						from : from,
						to : to,
						limit : self.limit,
						interval : interval,
						// FIXME: use setting from config (target.downsampling, maybe?)
						op : 'avg'
					},
					method : 'GET',
					headers : { 'Content-Type' : 'application/json'	}
				})
				//.then(response => {
				.then(function(response) {
					if (response.status === 200) {
						var loadOlderData = false;
						var promises = [];
						//Object.keys(response.data).forEach(item => {
						if (!response.data) {
							console.log("Oops! No response data?!");
							console.log(response);
						}
						Object.keys(response.data).forEach(function(item) {
							var newItemData = response.data[item];
							//Object.keys(newItemData).forEach(property => {
							Object.keys(newItemData).forEach(function(property) {
								var newPropertyData = newItemData[property];
								if (!newPropertyData || newPropertyData.length == 0) {
									return;
								} else {
									// LF returns data in latest-first order
									newPropertyData.reverse();
								}

								if (newPropertyData.length == self.limit) {
									// limit reached, fetch earlier blocks, keep from
									// but stop at earliest time already read - 1
									var localTo = newPropertyData[0].time - 1;
									promises.push(
											self.loadData(item, property, from, localTo)
												//.then(d => {
												.then(function(d) {
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
						return promiseAll(promises);
					}
				});
	};

	function buildQueryParameters(options) {
		// remove placeholder targets
		//options.targets = _.filter(options.targets, target => {
		options.targets = _.filter(options.targets, function(target) {
			return ((target.item !== 'select item') && (target.property !== 'select property'));
		});

		//var targets = _.map(options.targets, target => {
		var targets = _.map(options.targets, function(target) {
			return {
				// default fields
				target : self.templateSrv.replace(target.target),
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

	// helper to construct a short display name for item + property
	function displayName(prefixStr, prefix, item, property) {
		return item.replace(prefixStr, prefix) + '@' + localPart(property);
	}

	// helper to get the localPart of an URI (used to display short properties)
	function localPart(uriString) {
		var separator = (uriString.lastIndexOf('#') > 0 ? '#' : '/');
		return uriString.substring(uriString.lastIndexOf(separator) + 1);
	}

	// instead of Promise.all(), which isn't supported by some browsers,
	// use this version, courtesy of https://www.promisejs.org/patterns/
	function promiseAll(promises) {
		var accumulator = [];
		var ready = Promise.resolve({});

		promises.forEach(function(promise) {
			ready = ready.then(function() {
				return promise;
			}).then(function(value) {
				accumulator.push(value);
			});
		});

		return ready.then(function() {
			return accumulator;
		});
	}

	return LFDatasource;
});
