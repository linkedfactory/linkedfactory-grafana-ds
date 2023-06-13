import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export type PropertySpec = string[]

export interface MyQuery extends DataQuery {
  item: string;
  propertyPath: PropertySpec[];
  scale: number;
}

export const defaultQuery: Partial<MyQuery> = {
  propertyPath: [[]]
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
