import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class LFDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;
    this.target.item = this.target.item || 'select item';
    this.target.property = this.target.property || 'select property';

    if (!this.target.scale) {
      this.target.scale = 1;
    }
  }


  getOptionsItems(query) {
    // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
    return this.datasource.itemFindQuery(query || '')
      .then(this.uiSegmentSrv.transformToSegments(true));
  //
  }


getOptionsProperties(query){
  return this.datasource.propertyFindQuery(this.target.item, query || '')//item  is filtering the properties
    .then(this.uiSegmentSrv.transformToSegments(false));
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }

}

LFDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
