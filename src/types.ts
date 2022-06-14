import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  constant: number;
  value: number;
  flag: number;
  a: number

  valueSelect: boolean;
  flagSelect: boolean;
  aSelect: boolean;

  factory: String;
  machine: String;
  sensor: String;
}

export const defaultQuery: Partial<MyQuery> = {
  constant: 6.5,

  value: 3, 
  flag: 4, 
  a: 5
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
