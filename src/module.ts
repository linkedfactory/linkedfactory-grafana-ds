import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from '../../grafana-ds-2/src/components/ConfigEditor';
import { DataSource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { LFQuery, LFDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, LFQuery, LFDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
