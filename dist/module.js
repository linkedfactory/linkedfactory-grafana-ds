'use strict';

System.register(['./datasource', './query_ctrl'], function (_export, _context) {
  "use strict";

  var LFDatasource, LFDatasourceQueryCtrl, LFConfigCtrl, LFQueryOptionsCtrl, LFAnnotationsQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_datasource) {
      LFDatasource = _datasource.LFDatasource;
    }, function (_query_ctrl) {
      LFDatasourceQueryCtrl = _query_ctrl.LFDatasourceQueryCtrl;
    }],
    execute: function () {
      _export('ConfigCtrl', LFConfigCtrl = function LFConfigCtrl() {
        _classCallCheck(this, LFConfigCtrl);
      });

      LFConfigCtrl.templateUrl = 'partials/config.html';

      _export('QueryOptionsCtrl', LFQueryOptionsCtrl = function LFQueryOptionsCtrl() {
        _classCallCheck(this, LFQueryOptionsCtrl);
      });

      LFQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

      _export('AnnotationsQueryCtrl', LFAnnotationsQueryCtrl = function LFAnnotationsQueryCtrl() {
        _classCallCheck(this, LFAnnotationsQueryCtrl);
      });

      LFAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

      _export('Datasource', LFDatasource);

      _export('QueryCtrl', LFDatasourceQueryCtrl);

      _export('ConfigCtrl', LFConfigCtrl);

      _export('QueryOptionsCtrl', LFQueryOptionsCtrl);

      _export('AnnotationsQueryCtrl', LFAnnotationsQueryCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
