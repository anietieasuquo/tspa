import { createDefaultInternalLogger } from '@main/utils/logger-utils';
import { LocalStorageProvider } from '@main/providers/LocalStorageProvider';
import * as commonUtils from '@main/utils/common-utils';
import * as entityUtils from '@main/utils/entity-utils';
import { markAsDeleted, updatePayload } from '@main/utils/entity-utils';
import {
  CrudRepository,
  Entity,
  LocalStorageConnectionProperties,
  Logger,
  QueryOptions
} from '@main/types/core';
import { DuplicateRecordException } from '@main/exceptions/DuplicateRecordException';
import { RecordNotFoundException } from '@main/exceptions/RecordNotFoundException';
import { OptimisticLockException } from '@main/exceptions/OptimisticLockException';
import { Objects, Optional } from '@src/main';
import { ConfigurationException } from '@main/exceptions/ConfigurationException';

const APP_NAME = process.env.TSPA_APP_NAME;
const STORAGE_PATH = process.env.TSPA_STORAGE_PATH;
const logger: Logger = createDefaultInternalLogger();

class LocalStorageCrudRepository<T extends Entity>
  implements CrudRepository<T>
{
  private static localStorageConnectionProperties: LocalStorageConnectionProperties;
  private static initialized: boolean = false;
  private readonly storageKey: string;
  private readonly localStorage: Storage;

  private constructor(private readonly collectionName: string) {
    Objects.requireTrue(
      LocalStorageCrudRepository.initialized,
      new ConfigurationException('No entities/connection initialized')
    );
    Objects.requireNonEmpty(
      collectionName,
      new ConfigurationException('No collection name provided')
    );

    const { appName, storagePath } =
      LocalStorageCrudRepository.localStorageConnectionProperties;
    this.storageKey = `${appName}_${collectionName.toLowerCase()}`;
    this.localStorage = LocalStorageProvider.getInstance(storagePath!).storage;
    logger.info(
      'LocalStorageCrudRepository > LocalStorage has been successfully initialized'
    );
  }

  public getDatabase(): any {
    return this.localStorage;
  }

  public static for<E extends Entity>(
    collectionName: string
  ): LocalStorageCrudRepository<E> {
    return new LocalStorageCrudRepository<E>(collectionName);
  }

  public static async initFor<E extends Entity>(
    collectionName: string,
    localStorageConnectionProperties: LocalStorageConnectionProperties
  ): Promise<LocalStorageCrudRepository<E>> {
    await LocalStorageCrudRepository.init(localStorageConnectionProperties);
    return new LocalStorageCrudRepository<E>(collectionName);
  }

  public static async init(
    localStorageConnectionProperties: LocalStorageConnectionProperties
  ): Promise<void> {
    const { appName, storagePath } = localStorageConnectionProperties;
    const name = appName ?? APP_NAME ?? 'app';
    const path = storagePath ?? STORAGE_PATH ?? './db';
    Objects.requireNonEmpty(
      [name, path],
      new ConfigurationException('Invalid initialization parameters')
    );

    LocalStorageCrudRepository.localStorageConnectionProperties = {
      appName: name,
      storagePath: path
    };
    LocalStorageCrudRepository.initialized = true;
  }

  public createId(): string {
    const id = commonUtils.generate();
    logger.debug(`LocalStorageCrudRepository createId: ${id}`);
    return id;
  }

  public async findById(id: string): Promise<Optional<T>> {
    logger.debug(`LocalStorageCrudRepository findById: ${id}`);

    const jsonString = this.localStorage.getItem(this.storageKey);

    if (!jsonString || commonUtils.isEmpty(jsonString)) {
      logger.debug('LocalStorageCrudRepository storage is empty', {
        jsonString
      });
      return Optional.empty();
    }

    const jsonValue = JSON.parse(jsonString);
    const content = jsonValue[this.getActiveKey(id)];

    logger.debug(
      'LocalStorageCrudRepository findById -> found record',
      content
    );
    return Optional.ofNullable(content as T);
  }

  public async findOneBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>> {
    logger.debug(
      `LocalStorageCrudRepository findOneBy filter: ${JSON.stringify(filter)}`,
      queryOptions
    );

    const jsonString = this.localStorage.getItem(this.storageKey);

    if (!jsonString || commonUtils.isEmpty(jsonString)) {
      return Optional.empty();
    }
    const jsonValue = JSON.parse(jsonString);

    let result: T | undefined;

    Object.keys(jsonValue).forEach((recordKey) => {
      const item = jsonValue[recordKey];
      if (item.deleted) {
        return;
      }

      // @ts-ignore
      if (Object.keys(item).some((key) => item[key] === filter[key])) {
        result = item as T;
      }
    });

    return Optional.ofNullable(result as T);
  }

  public async findAll(
    filter: Partial<T> = {},
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    logger.debug(
      `LocalStorageCrudRepository findAll filter: ${JSON.stringify(filter)}`,
      queryOptions
    );

    const jsonString = this.localStorage.getItem(this.storageKey);
    if (!jsonString || commonUtils.isEmpty(jsonString)) {
      return [];
    }

    const jsonValue = JSON.parse(jsonString);

    const items: T[] = [];

    Object.keys(filter).forEach((key) => {
      // @ts-ignore
      const value = filter[key];

      Object.keys(jsonValue).forEach((recordKey) => {
        const item = jsonValue[recordKey];
        if (item.deleted) {
          return;
        }

        if (Object.keys(item).includes(key) && item[key] === value) {
          items.push(item as T);
        }
      });
    });

    return items;
  }

  public async create(payload: T): Promise<T> {
    logger.debug('LocalStorageCrudRepository create payload', payload);
    const id = await this.getId(payload);

    let object = {};
    const jsonString = this.localStorage.getItem(this.storageKey);

    if (jsonString && commonUtils.isNoneEmpty(jsonString)) {
      object = JSON.parse(jsonString);
      logger.debug('LocalStorageCrudRepository storage is not empty', object);
    }

    updatePayload(payload);

    const item: T = { ...payload, id };
    const activeKey = this.getActiveKey(id);

    object[activeKey] = item;
    this.localStorage.setItem(this.storageKey, JSON.stringify(object));

    logger.debug(
      `LocalStorageCrudRepository created entity for ${this.collectionName}`,
      item
    );

    return item;
  }

  public async createAll(payload: T[]): Promise<T[]> {
    logger.debug(
      `LocalStorageCrudRepository createAll filter: ${JSON.stringify(payload)}`
    );

    if (payload.length === 0) {
      return [];
    }
    const entitiesWithIds: T[] = payload.filter(
      (entity) => !commonUtils.isEmpty(entity.id)
    );
    entityUtils.checkForDuplicates<T>(entitiesWithIds, ['id']);

    const all: Promise<T>[] = payload.flatMap(async (record: T) => {
      return await this.create(record);
    });

    const records = await Promise.all(all);
    logger.debug('LocalStorageCrudRepository createAll records', records);
    return records;
  }

  public async update(
    id: string,
    payload: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    logger.debug(
      `LocalStorageCrudRepository update id: ${id} payload: ${JSON.stringify(payload)}`
    );

    const activeKey = this.getActiveKey(id);
    const object = await this.findExpectedRecord(activeKey);
    const record: T = object[activeKey] as T;

    if (
      queryOptions?.locking === 'optimistic' &&
      record.version !== payload.version
    ) {
      logger.error('Optimistic locking update: Record version mismatch');
      throw new OptimisticLockException(
        'Optimistic lock > Record version mismatch'
      );
    }

    return this.performUpdate({ ...record, ...payload }, object, queryOptions);
  }

  public async remove(
    id: string,
    queryOptions: QueryOptions<T> = { deletionOptions: { softDelete: true } }
  ): Promise<boolean> {
    logger.debug(`LocalStorageCrudRepository remove id: ${id}`);

    const activeKey = this.getActiveKey(id);
    const object = await this.findExpectedRecord(activeKey);
    const record: T = object[activeKey] as T;
    if (queryOptions.deletionOptions?.softDelete) {
      return this.softDelete(record, object);
    }
    return this.hardDelete(activeKey, object);
  }

  private async getId(payload: T): Promise<string> {
    return commonUtils.isEmpty(payload.id)
      ? this.createId()
      : await this.checkDuplicateId(payload.id!);
  }

  private async softDelete(
    record: T,
    object: object,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    logger.debug('LocalStorageCrudRepository softDelete options', queryOptions);
    delete object[this.getActiveKey(record.id!)];

    markAsDeleted(record);
    updatePayload(record);
    object[this.getInactiveKey(record.id!)] = record;
    this.localStorage.setItem(this.storageKey, JSON.stringify(object));
    return true;
  }

  private async hardDelete(
    id: string,
    object: object,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    logger.debug('LocalStorageCrudRepository hardDelete options', queryOptions);
    delete object[id];
    this.localStorage.setItem(this.storageKey, JSON.stringify(object));
    return true;
  }

  private async performUpdate(
    payload: T,
    object: object,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    logger.debug('LocalStorageCrudRepository update options', queryOptions);

    updatePayload(payload);
    const activeKey = this.getActiveKey(payload.id!);
    object[activeKey] = payload;
    this.localStorage.setItem(this.storageKey, JSON.stringify(object));
    return true;
  }

  private async checkDuplicateId(id: string): Promise<string> {
    logger.debug('LocalStorageCrudRepository checking duplicate id', id);

    (await this.findById(id)).ifPresentThrow(
      new DuplicateRecordException(
        `${this.collectionName} record with id (${id}) already exists`
      )
    );

    logger.debug('LocalStorageCrudRepository no duplicate ID found', id);
    return id;
  }

  private async findExpectedRecord(id: string): Promise<object> {
    const jsonString = this.localStorage.getItem(this.storageKey);
    Objects.requireNonEmpty(
      jsonString,
      new RecordNotFoundException(
        `${this.collectionName} record with id (${id}) not found`
      )
    );

    const object = JSON.parse(jsonString);
    const record: T = object[id] as T;

    if (!record) {
      logger.debug('LocalStorageCrudRepository record not found for id', id);

      throw new RecordNotFoundException(
        `${this.collectionName} record with id (${id}) not found`
      );
    }
    return object;
  }

  private getActiveKey(id: string): string {
    return `${id}:false`;
  }

  private getInactiveKey(id: string): string {
    return `${id}:true`;
  }
}

export { LocalStorageCrudRepository };
