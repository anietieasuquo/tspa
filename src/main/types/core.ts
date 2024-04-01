import mongoose, { ConnectOptions } from 'mongoose';
import { Optional } from '@src/main';

export interface Entity {
  id?: string;
  deleted?: boolean;
  dateCreated?: number;
  dateUpdated?: number;
  dateDeleted?: number;
  version?: number;
}

export type EntityMap<T extends Entity> = { [key: string]: T[] };

export type EntityDefinitionList<T extends Entity> = { [key: string]: T }[];

export enum SortOrder {
  ASC,
  DESC
}

export enum ConditionalOperator {
  EQ,
  NE,
  GT,
  GTE,
  LT,
  LTE,
  IN,
  NIN
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOR = 'nor'
}

export type Locking = 'pessimistic' | 'optimistic';

export interface MongoQueryOptions {
  session?: mongoose.ClientSession;
}

export interface QueryOptions<T extends Entity> {
  logicalOperator?: LogicalOperator;
  deletionOptions?: RemovalOptions;
  limit?: number;
  offset?: number;
  sortBy?: { [key in keyof T]: SortOrder };
  locking?: Locking;
  mongoOptions?: MongoQueryOptions;
}

export interface EntityWithAdditionalId extends Entity {
  _id?: string;
}

export type MongoSchemaBody<T extends Entity> = {
  [K in keyof T]: { type: string; required: boolean };
};

export interface EventfulRepository<T extends Entity> {
  addListenerById(
    listener: (change?: T, ...args: any) => void,
    id?: string
  ): Promise<() => void>;

  addListener(
    listener: (change?: T, ...args: any) => void,
    filter?: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<() => void>;
}

export interface CrudRepository<T extends Entity> {
  findById(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>>;

  findOneBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>>;

  findAll(
    filter?: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]>;

  create(payload: T, queryOptions?: QueryOptions<T> | undefined): Promise<T>;

  createAll(
    payload: T[],
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]>;

  update(
    id: string,
    payload: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean>;

  remove(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean>;

  createId(): string;

  getDatabase(): any;
}

export type MongoSession = mongoose.mongo.ClientSession;

export interface TransactionExecution<R> {
  mongoExecutor?: (session: MongoSession) => Promise<R>;
}

export interface TransactionalCrudRepository<T extends Entity>
  extends CrudRepository<T> {
  executeTransaction<R>(execution: TransactionExecution<R>): Promise<R>;
}

export interface ConnectionBasedRepository<T extends Entity>
  extends CrudRepository<T> {
  isConnected(): boolean;
}

export interface Logger {
  info(message: any, options?: any): void;

  warn(message: any, options?: any): void;

  error(message: any, options?: any): void;

  debug(message: any, options?: any): void;

  trace(message: any, options?: any): void;
}

export type LogLevelName =
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  | 'trace'
  | 'none';

export interface RemovalOptions {
  softDelete?: boolean;
}

export interface ConnectionProperties {
  appName: string;
}

export interface FirestoreConnectionProperties extends ConnectionProperties {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  emulatorEndpoint?: string;
}

export interface MongoConnectionProperties<T extends EntityWithAdditionalId>
  extends ConnectionProperties {
  entities: EntityDefinitionList<T>;
  uri?: string;
  connectionOptions?: ConnectOptions;
}

export interface LocalStorageConnectionProperties extends ConnectionProperties {
  storagePath?: string;
}

export type Nullable<T> = T | null | undefined;
