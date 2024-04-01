import mongoose, { ConnectOptions, FilterQuery, Model } from 'mongoose';
import { MongoProvider } from '@main/providers/MongoProvider';
import * as commonUtils from '@main/utils/common-utils';
import * as entityUtils from '@main/utils/entity-utils';
import { markAsDeleted, updatePayload } from '@main/utils/entity-utils';
import { createOrGetEntityModel } from '@main/models/MongoEntityModel';
import {
  ConnectionBasedRepository,
  EntityWithAdditionalId,
  Logger,
  LogicalOperator,
  MongoConnectionProperties,
  MongoSession,
  QueryOptions,
  TransactionalCrudRepository,
  TransactionExecution
} from '@main/types/core';
import { createDefaultInternalLogger } from '@main/utils/logger-utils';
import { DuplicateRecordException } from '@main/exceptions/DuplicateRecordException';
import { InternalServerException } from '@main/exceptions/InternalServerException';
import { OptimisticLockException } from '@main/exceptions/OptimisticLockException';
import { Objects, Optional } from '@src/main';
import { RecordNotFoundException } from '@main/exceptions/RecordNotFoundException';

const MONGO_URI = process.env.TSPA_MONGO_URI;
const APP_NAME = process.env.TSPA_APP_NAME;
const logger: Logger = createDefaultInternalLogger();

class MongoCrudRepository<T extends EntityWithAdditionalId>
  implements TransactionalCrudRepository<T>, ConnectionBasedRepository<T>
{
  private static connectionProperties: MongoConnectionProperties<EntityWithAdditionalId>;
  private static initialized: boolean = false;

  private constructor(private readonly collectionName: string) {
    Objects.requireTrue(
      MongoCrudRepository.initialized,
      new InternalServerException('No entities/connection initialized')
    );
    Objects.requireNonEmpty(
      collectionName,
      new InternalServerException('No mongo collection name provided')
    );

    const isEntityExists =
      MongoCrudRepository.connectionProperties.entities.some((entity) => {
        return Object.keys(entity)[0] === collectionName;
      });
    Objects.requireTrue(
      isEntityExists,
      new InternalServerException(
        `Mongo collection with name ${collectionName} not recognized`
      )
    );
    logger.info(
      'MongoCrudRepository > MongoDB has been successfully initialized'
    );
  }

  public isConnected(): boolean {
    const connected =
      mongoose.connection.readyState !== 0 && MongoCrudRepository.initialized;
    logger.debug(`MongoCrudRepository isConnected:`, {
      connected,
      isMongoConnected: mongoose.connection.readyState !== 0,
      isInitialized: MongoCrudRepository.initialized
    });
    return connected;
  }

  public static for<E extends EntityWithAdditionalId>(
    collectionName: string
  ): MongoCrudRepository<E> {
    return new MongoCrudRepository<E>(collectionName);
  }

  public static initFor<E extends EntityWithAdditionalId>(
    collectionName: string,
    mongoConnectionProperties: MongoConnectionProperties<E>
  ): MongoCrudRepository<E> {
    MongoCrudRepository.init(mongoConnectionProperties);
    return new MongoCrudRepository<E>(collectionName);
  }

  public static init<E extends EntityWithAdditionalId>(
    mongoConnectionProperties: MongoConnectionProperties<E>
  ): void {
    const { entities, uri, connectionOptions, appName } =
      mongoConnectionProperties;
    const mongodbUri = uri ?? MONGO_URI ?? '';
    const mongoAppName = appName ?? APP_NAME ?? '';
    if (
      commonUtils.isAnyEmpty(mongodbUri, mongoAppName) &&
      mongoose.connection.readyState === 0
    ) {
      throw new InternalServerException('No connection url provided');
    }

    Objects.requireTrue(
      entities.length > 0,
      new InternalServerException('No entities initialized')
    );

    const options: ConnectOptions = {
      autoIndex: false,
      autoCreate: false,
      forceServerObjectId: false,
      bufferCommands: true,
      connectTimeoutMS: 20000
    };
    const mongoConnectionOptions = {
      ...options,
      ...connectionOptions
    };
    MongoCrudRepository.connectionProperties = {
      appName: mongoAppName,
      entities,
      uri: mongodbUri,
      connectionOptions: mongoConnectionOptions
    };
    MongoCrudRepository.initialized = true;
  }

  public getDatabase(): any {
    return mongoose.connection.db;
  }

  public async create(
    payload: T,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T> {
    logger.debug(`MongoCrudRepository create:`, payload);
    await this.createConnection();
    updatePayload(payload);
    const id = await this.getId(payload, queryOptions);
    const updatedPayload = { ...payload, id, _id: id };
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      updatedPayload,
      this.collectionName
    );

    const entity = await new EntityModel<T | undefined>(updatedPayload).save({
      validateBeforeSave: true,
      safe: true,
      session: queryOptions?.mongoOptions?.session
    });

    logger.debug(
      `MongoCrudRepository created entity for ${this.collectionName}:`,
      entity
    );

    return this.getDocument(entity);
  }

  public async createAll(
    payload: T[],
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    logger.debug(`MongoCrudRepository createAll:`, payload);
    if (payload.length === 0) {
      return [];
    }
    const entitiesWithIds: T[] = payload.filter(
      (entity) => !commonUtils.isEmpty(entity.id)
    );
    entityUtils.checkForDuplicates<T>(entitiesWithIds, ['id']);

    await this.createConnection();
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );
    const newPayload = payload.map(async (item) => {
      updatePayload(item);
      const id = await this.getId(item, queryOptions);

      return { ...item, id, _id: id };
    });
    return (
      await EntityModel.insertMany(await Promise.all(newPayload), {
        session: queryOptions?.mongoOptions?.session
      })
    ).map((entity) => this.getDocument(entity));
  }

  public createId(): string {
    const id = commonUtils.generate();
    logger.debug(`MongoCrudRepository createId: ${id}`);
    return id;
  }

  public async findAll(
    filter?: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    logger.debug(`MongoCrudRepository findAll:`, filter);
    if (!filter) {
      return this._findAll(queryOptions);
    }
    return this.findBy(filter, queryOptions);
  }

  public async findById(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>> {
    logger.debug(`MongoCrudRepository findById: ${id}`);
    await this.createConnection();
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );
    const filterQuery: FilterQuery<T> = {
      deleted: { $ne: true },
      id: { $eq: id }
    };
    const entity: T | null = await EntityModel.findOne<T>(filterQuery, null, {
      session: queryOptions?.mongoOptions?.session
    }).exec();
    return entity ? Optional.of(this.getDocument(entity)) : Optional.empty();
  }

  public async findOneBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>> {
    logger.debug(`MongoCrudRepository findOneBy filter:`, filter);
    await this.createConnection();
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );
    const filterQuery: FilterQuery<T> = this.createFilter(filter, queryOptions);
    const entity: T | null = await EntityModel.findOne<T>(filterQuery, null, {
      session: queryOptions?.mongoOptions?.session
    }).exec();
    logger.debug(`MongoCrudRepository findOneBy result: ${entity}`);
    return entity ? Optional.of(this.getDocument(entity)) : Optional.empty();
  }

  public async remove(
    id: string,
    queryOptions: QueryOptions<T> = { deletionOptions: { softDelete: true } }
  ): Promise<boolean> {
    logger.debug(`MongoCrudRepository remove by:`, { id, queryOptions });
    await this.createConnection();
    const record: T = await this.findExpectedRecord(id, queryOptions);

    if (queryOptions.deletionOptions?.softDelete) {
      return this.performUpdate(record, record, queryOptions, true);
    }
    return this.hardDelete(id, queryOptions);
  }

  public async update(
    id: string,
    payload: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    logger.debug(`MongoCrudRepository update by:`, { id, payload });
    await this.createConnection();
    const record: T = await this.findExpectedRecord(id, queryOptions);

    if (
      queryOptions?.locking === 'optimistic' &&
      record.version !== payload.version
    ) {
      logger.error('Optimistic locking update: Record version mismatch');
      throw new OptimisticLockException(
        'Optimistic lock > Record version mismatch'
      );
    }

    return this.performUpdate(record, payload, queryOptions);
  }

  public async executeTransaction<R>(
    execution: TransactionExecution<R>
  ): Promise<R> {
    logger.info('MongoCrudRepository starting transaction session');
    const session: MongoSession = await mongoose.startSession();
    session.startTransaction();
    const { mongoExecutor } = execution;
    Objects.requireNonNull(
      mongoExecutor,
      new InternalServerException('No transaction executor provided')
    );

    try {
      logger.debug('MongoCrudRepository executing transaction');
      const result: R = await mongoExecutor(session);
      logger.debug('MongoCrudRepository committing transaction');
      await session.commitTransaction();
      logger.debug('MongoCrudRepository transaction committed');
      return result;
    } catch (error: any) {
      logger.error('MongoCrudRepository aborting transaction', error);
      await session.abortTransaction();
      throw error;
    } finally {
      logger.info('MongoCrudRepository ending transaction session');
      await session.endSession();
    }
  }

  private async getId(
    payload: T,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<string> {
    return commonUtils.isEmpty(payload.id)
      ? this.createId()
      : await this.checkDuplicateId(payload.id!, queryOptions);
  }

  private async performUpdate(
    record: T,
    payload: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined,
    markDeleted: boolean = false
  ): Promise<boolean> {
    const recordDoc: T = this.getDocument(record);
    const payloadDoc: T = this.getDocument(payload);
    const updatedRecord: T = { ...recordDoc, ...payloadDoc };
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );

    updatePayload(updatedRecord);
    if (markDeleted) {
      markAsDeleted(updatedRecord);
    }

    const result = await new EntityModel<T>(record)
      .updateOne(updatedRecord, {
        session: queryOptions?.mongoOptions?.session
      })
      .exec();

    Objects.requireNonNull(
      result,
      new InternalServerException(
        `MongoCrudRepository update: Failed to update record with id (${record.id})`
      )
    );
    return true;
  }

  private async hardDelete(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );
    const filterQuery: FilterQuery<T> = this.createFilter(
      <T>{ id },
      queryOptions
    );
    const result = await EntityModel.deleteOne(filterQuery, {
      session: queryOptions?.mongoOptions?.session
    }).exec();
    logger.debug(
      `MongoCrudRepository delete: ${result.deletedCount} records delete`
    );
    return result.deletedCount === 1;
  }

  private async _findAll(
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    await this.createConnection();
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );

    const filter: FilterQuery<T> = this.createFilter({}, queryOptions);
    const records =
      (await EntityModel.find(filter, null, {
        session: queryOptions?.mongoOptions?.session
      }).sort({
        deleted: -1,
        dateCreated: -1
      })) ?? [];
    logger.debug(
      `MongoCrudRepository _findAll: ${records.length} records found`
    );
    return records.map((record) => this.getDocument(record));
  }

  private async findBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    await this.createConnection();
    const EntityModel: Model<T> = createOrGetEntityModel<T>(
      {},
      this.collectionName
    );

    const filterQuery: FilterQuery<T> = this.createFilter(filter, queryOptions);
    const records =
      (await EntityModel.find(filterQuery, null, {
        session: queryOptions?.mongoOptions?.session
      }).sort({ dateCreated: -1 })) ?? [];
    logger.debug(`MongoCrudRepository findBy: ${records.length} records found`);
    return records.map((record) => this.getDocument(record));
  }

  private createFilterOnly(filter: Partial<T>): FilterQuery<T> {
    let filterQuery: FilterQuery<T> = {
      deleted: { $ne: true }
    };
    for (const key in filter) {
      if (Object.hasOwn(filter, key)) {
        filterQuery = {
          ...filterQuery,
          [key]: { $eq: filter[key], $exists: true }
        };
      }
    }
    return filterQuery;
  }

  private createFilter(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): FilterQuery<T> {
    if (
      !queryOptions?.logicalOperator ||
      queryOptions.logicalOperator === LogicalOperator.AND
    ) {
      return this.createFilterOnly(filter);
    }

    const deletedQuery: FilterQuery<T> = {
      deleted: { $ne: true }
    };

    const logicalOperator: string = queryOptions.logicalOperator
      .valueOf()
      .toLowerCase();
    const filterQuery: FilterQuery<T>[] = [];
    for (const key in filter) {
      if (Object.hasOwn(filter, key)) {
        const fieldQuery: FilterQuery<T> = {
          [key]: { $eq: filter[key], $exists: true }
        } as FilterQuery<T>;
        filterQuery.push(fieldQuery);
      }
    }

    const operator = `$${logicalOperator}`;
    const compoundQuery: FilterQuery<T> = {
      [`${operator}`]: filterQuery
    } as FilterQuery<T>;
    const query: FilterQuery<T> = { $and: [deletedQuery, compoundQuery] };
    logger.info(
      `MongoCrudRepository createFilter for ${this.collectionName}:`,
      JSON.stringify({ query, operator })
    );
    return query;
  }

  private async createConnection(): Promise<void> {
    if (this.isConnected()) {
      logger.debug('MongoCrudRepository already connected to mongodb');
      return;
    }

    const { uri, connectionOptions, entities } =
      MongoCrudRepository.connectionProperties;
    await MongoProvider.connect(uri!, connectionOptions!);
    MongoCrudRepository.checkMongoConnection();

    entities.forEach((entity) => {
      const entityName = Object.keys(entity)[0];
      createOrGetEntityModel<EntityWithAdditionalId>(
        entity[entityName],
        entityName
      );
    });
  }

  private static checkMongoConnection(): void {
    Objects.requireTrue(
      mongoose.connection.readyState !== 0,
      new InternalServerException('No connection to mongodb')
    );
  }

  private async checkDuplicateId(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<string> {
    (await this.findById(id, queryOptions)).ifPresentThrow(
      new DuplicateRecordException(
        `${this.collectionName} record with id (${id}) already exists`
      )
    );
    return id;
  }

  private async findExpectedRecord(
    id: string,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T> {
    const record = await this.findById(id, queryOptions);
    Objects.requireTrue(
      record.isPresent(),
      new RecordNotFoundException(
        `${this.collectionName} record with id (${id}) not found`
      )
    );
    return record.get();
  }

  private getDocument(record: Partial<T>): T {
    const docKey = '_doc';
    if (Object.keys(record).includes(docKey)) {
      return record[docKey];
    }
    return <T>record;
  }
}

export { MongoCrudRepository };
