define([
  './datasource',
  './query_ctrl'
],
function(LFDatasource, LFQueryCtrl) {
	'use strict';

	var LFConfigCtrl = function() { };
	LFConfigCtrl.templateUrl = "partials/config.html";

	var LFQueryOptionsCtrl = function() { };
	LFQueryOptionsCtrl.templateUrl = "partials/query.options.html";

	var LFAnnotationsQueryCtrl = function() { };
	LFAnnotationsQueryCtrl.templateUrl = "partials/annotations.editor.html";

	return {
		'Datasource' : LFDatasource,
		'QueryCtrl' : LFQueryCtrl,
		'ConfigCtrl' : LFConfigCtrl,
		'QueryOptionsCtrl' : LFQueryOptionsCtrl,
		'AnnotationsQueryCtrl' : LFAnnotationsQueryCtrl
	};
});
