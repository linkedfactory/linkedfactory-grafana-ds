define([
  'angular',
  'lodash',
  'app/plugins/sdk'
],
function(angular, _, sdk) {
	'use strict';

	var LFQueryCtrl = (function(_super) {
		var self;

		function LFQueryCtrl($scope, $injector) {
			_super.call(this, $scope, $injector);

			this.scope = $scope;

			if (!this.target.scale) {
				this.target.scale = 1;
			}

			// sampling operation, not yet used
			if (!this.target.downsampling) {
				this.target.downsampling = 'avg';
			}
			self = this;
		}

		LFQueryCtrl.prototype = Object.create(_super.prototype);
		LFQueryCtrl.prototype.constructor = LFQueryCtrl;

		LFQueryCtrl.templateUrl = 'partials/query.editor.html';

//		// FIXME: needed?
//		LFQueryCtrl.prototype.getOptions = function() {
//			/*
//			 * return this.datasource.metricFindQuery(this.target)
//			 * .then(this.uiSegmentSrv.transformToSegments(false)); // Options
//			 * have to be transformed by uiSegmentSrv to be usable by
//			 * metric-segment-model directive
//			 */
//		}
//
		LFQueryCtrl.prototype.toggleEditorMode = function() {
			this.target.rawQuery = !this.target.rawQuery;
		}

		LFQueryCtrl.prototype.onChangeInternal = function() {
			this.panelCtrl.refresh(); // Asks the panel to refresh data.
		}

		return LFQueryCtrl;

	})(sdk.QueryCtrl);

	return LFQueryCtrl;
});
