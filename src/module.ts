import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './Datasource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { LFQuery, LFDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, LFQuery, LFDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
