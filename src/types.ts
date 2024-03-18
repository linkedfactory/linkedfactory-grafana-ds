import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import Parser from "@triply/yasr/build/ts/src/parsers";

export type PropertySpec = string[]

export interface LFQuery extends DataQuery {
  item: string;
  propertyPath: PropertySpec[];
  operator: string;
  scale: number;
  sparql: Parser.SparqlResults;
  yasguiUI: boolean;
  table: Array<Object>;
}

export interface KvinQuery extends LFQuery {
  item: string;
  propertyPath: PropertySpec[];
  operator: string;
  scale: number;
}
 
export interface SparqlQuery extends LFQuery {
  sparql: Parser.SparqlResults;
  yasguiUI: boolean;
  table: Array<Object>;
}

export const defaultQuery: Partial<KvinQuery> = {
  propertyPath: [[]]
};

/**
 * These are options configured for each DataSource instance
 */
export interface LFDataSourceOptions extends DataSourceJsonData {
  url?: string;
  user?: string;
  password?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface LFSecureJsonData {
  apiKey?: string;
}
