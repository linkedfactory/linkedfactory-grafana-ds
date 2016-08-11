define([
	'angular',
	'lodash',
	'app/plugins/sdk',
	'app/core/utils/datemath',
	'app/core/utils/kbn',
	'./query_ctrl'
],
function phoo(angular, _, sdk, dateMath, kbn) {
	'use strict';

	var self;

	function LFDatasource(instanceSettings, $q, backendSrv, templateSrv) {
		this.type = instanceSettings.type;
		this.url = instanceSettings.url;
		this.name = instanceSettings.name;
		this.limit = 1000; // FIXME! add to config
		this.intervalSteps = 10000; // FIXME! add to config
		this.supportMetrics = true;
		this.q = $q;
		this.backendSrv = backendSrv;
		this.templateSrv = templateSrv;

		self = this;
	}

	// Called once per panel (graph)
	LFDatasource.prototype.query = function(options) {
		var query = buildQueryParameters(options);
		query.targets = query.targets.filter(t => !t.hide);

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
				.then(results => {
					var data = results.map(v => {
						var targetName = displayName("http://linkedfactory.iwu.fraunhofer.de/linkedfactory/", "lf:", v.item, v.property);
						var values = v.values;

						// get the config entry to access scale etc.
						var target = _.filter(query.targets, target => {
							return (v.item === target.item && v.property === target.property);
						})[0];
						var scale = (target ? target.scale : 1);
						if (typeof scale === 'undefined') {
							scale = 1;
						}

						var datapoints = values.map(d => {
							return [ d.value * scale, d.time ];
						});
						return { target : targetName, datapoints : datapoints };
					});
					return { data : data };
				});
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
				.then(response => {
					if (response.status === 200) {
						var loadOlderData = false;
						var promises = [];
						Object.keys(response.data).forEach(item => {
							var newItemData = response.data[item];
							Object.keys(newItemData).forEach(property => {
								var newPropertyData = newItemData[property];
								if (!newPropertyData
										|| newPropertyData.length == 0) {
									return;
								} else {
									newPropertyData
											.reverse();
								}

								if (newPropertyData.length == self.limit) {
									// fetch until time (to - 1)
									var localTo = newPropertyData[0].time - 1;
									promises.push(
											self.loadData(item, property, from, localTo)
												.then(d => {
													// FIXME: d is an array! handle appropriately
													return { item : item, property : property, values : d[0].values.concat(newPropertyData) };
												}));
								} else {
									promises.push({ item : item, property : property, values : newPropertyData });
								}
							});
						});
						return Promise.all(promises);
					}
				});
	};

	// helper to construct a short display name for item + property
	function displayName(prefixStr, prefix, item, property) {
		return item.replace(prefixStr, prefix) + '@' + localPart(property);
	}

	// helper to get the localPart of an URI (used to display short properties)
	function localPart(uriString) {
		var separator = (uriString.contains('#') ? '#' : '/');
		return uriString.substring(uriString.lastIndexOf(separator) + 1);
	}

	// Required
	// Used for testing datasource in datasource configuration pange
	LFDatasource.prototype.testDatasource = function() {
		return self.backendSrv.datasourceRequest({
			url : self.url + '/values',
			method : 'GET'
		})
		// FIXME ES6:
		// .then(response => {
		.then(function(response) {
			if (response.status === 200) {
				return {
					status : "success",
					message : "Data source is working",
					title : "Success"
				};
			}
		});
	};

	// TODO: IMPLEMENT, just returns an empty result
	LFDatasource.prototype.annotationQuery = function(options) {
		return self.q.when({ data : [] });
	};

	// Optional
	// Required for templating
	// TODO: IMPLEMENT, just returns an empty result
	LFDatasource.prototype.metricFindQuery = function(options) {
		return self.q.when({ data : [] });
	};

	function mapToTextValue(result) {
		return _.map(result.data, (d, i) => {
			return { text : d, value : i };
		});
	}

	function buildQueryParameters(options) {
		// remove placeholder targets
		options.targets = _.filter(options.targets, target => {
			return ((target.item !== 'select item') && (target.property !== 'select property'));
		});

		var targets = _.map(options.targets, target => {
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

	return LFDatasource;
});
