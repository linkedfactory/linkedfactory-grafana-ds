import {LFDatasource} from './datasource';
import {LFDatasourceQueryCtrl} from './query_ctrl';

class LFConfigCtrl {}
LFConfigCtrl.templateUrl = 'partials/config.html';

class LFQueryOptionsCtrl {}
LFQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class LFAnnotationsQueryCtrl {}
LFAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html'

export {
  LFDatasource as Datasource,
  LFDatasourceQueryCtrl as QueryCtrl,
  LFConfigCtrl as ConfigCtrl,
  LFQueryOptionsCtrl as QueryOptionsCtrl,
  LFAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
