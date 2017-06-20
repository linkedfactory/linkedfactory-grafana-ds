'use strict';

System.register(['app/plugins/sdk', './css/query-editor.css!'], function (_export, _context) {
  "use strict";

  var QueryCtrl, _createClass, LFDatasourceQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  return {
    setters: [function (_appPluginsSdk) {
      QueryCtrl = _appPluginsSdk.QueryCtrl;
    }, function (_cssQueryEditorCss) {}],
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

      _export('LFDatasourceQueryCtrl', LFDatasourceQueryCtrl = function (_QueryCtrl) {
        _inherits(LFDatasourceQueryCtrl, _QueryCtrl);

        function LFDatasourceQueryCtrl($scope, $injector, uiSegmentSrv) {
          _classCallCheck(this, LFDatasourceQueryCtrl);

          var _this = _possibleConstructorReturn(this, (LFDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(LFDatasourceQueryCtrl)).call(this, $scope, $injector));

          _this.scope = $scope;
          _this.uiSegmentSrv = uiSegmentSrv;
          _this.target.item = _this.target.item || 'select item';
          _this.target.property = _this.target.property || 'select property';

          if (!_this.target.scale) {
            _this.target.scale = 1;
          }
          return _this;
        }

        _createClass(LFDatasourceQueryCtrl, [{
          key: 'getOptionsItems',
          value: function getOptionsItems(query) {
            // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
            return this.datasource.itemFindQuery(query || '').then(this.uiSegmentSrv.transformToSegments(true));
            //
          }
        }, {
          key: 'getOptionsProperties',
          value: function getOptionsProperties(query) {
            return this.datasource.propertyFindQuery(this.target.item, query || '') //item  is filtering the properties
            .then(this.uiSegmentSrv.transformToSegments(false));
          }
        }, {
          key: 'toggleEditorMode',
          value: function toggleEditorMode() {
            this.target.rawQuery = !this.target.rawQuery;
          }
        }, {
          key: 'onChangeInternal',
          value: function onChangeInternal() {
            this.panelCtrl.refresh(); // Asks the panel to refresh data.
          }
        }]);

        return LFDatasourceQueryCtrl;
      }(QueryCtrl));

      _export('LFDatasourceQueryCtrl', LFDatasourceQueryCtrl);

      LFDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
    }
  };
});
//# sourceMappingURL=query_ctrl.js.map
