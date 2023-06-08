import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  queryText?: string;
  constant: number;
  value: number;
  flag: number;
  a: number

  valueSelect: boolean;
  flagSelect: boolean;
  aSelect: boolean;

  item: string;
  property: string[];
  scale: number;
}

export const defaultQuery: Partial<MyQuery> = {
  
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
  user?: string;
  password?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
