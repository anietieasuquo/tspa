import {
  and,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  Firestore,
  getDocs,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  Query,
  QueryDocumentSnapshot,
  QueryFieldFilterConstraint,
  QueryOrderByConstraint,
  QuerySnapshot,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

import * as commonUtils from '@main/utils/common-utils';
import { FirestoreProvider } from '@main/providers/FirestoreProvider';
import {
  CrudRepository,
  Entity,
  EventfulRepository,
  FirestoreConnectionProperties,
  Logger,
  LogicalOperator,
  QueryOptions
} from '@main/types/core';
import { createDefaultInternalLogger } from '@main/utils/logger-utils';
import { DuplicateRecordException } from '@main/exceptions/DuplicateRecordException';
import { RecordNotFoundException } from '@main/exceptions/RecordNotFoundException';
import { QueryConstraint } from '@firebase/firestore';
import * as entityUtils from '@main/utils/entity-utils';
import { markAsDeleted, updatePayload } from '@main/utils/entity-utils';
import { OptimisticLockException } from '@main/exceptions/OptimisticLockException';
import { Objects, Optional } from '@src/main';
import { ConfigurationException } from '@main/exceptions/ConfigurationException';

const FIREBASE_API_KEY = process.env.TSPA_FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = process.env.TSPA_FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = process.env.TSPA_FIREBASE_PROJECT_ID;
const APP_NAME = process.env.TSPA_APP_NAME;
const logger: Logger = createDefaultInternalLogger();

class FirestoreCrudRepository<T extends Entity>
  implements CrudRepository<T>, EventfulRepository<T>
{
  private static connectionProperties: FirestoreConnectionProperties;
  private static initialized = false;
  private readonly database: Firestore;

  private constructor(private readonly collectionName: string) {
    Objects.requireTrue(
      FirestoreCrudRepository.initialized,
      new ConfigurationException('Firestore not initialized')
    );
    Objects.requireNonEmpty(
      collectionName,
      new ConfigurationException('No firestore collection name provided')
    );

    this.database = FirestoreProvider.getInstance(
      FirestoreCrudRepository.connectionProperties
    ).firestore;
    logger.info(
      'FirestoreCrudRepository > Firestore has been successfully initialized'
    );
  }

  public static for<E extends Entity>(
    collectionName: string
  ): FirestoreCrudRepository<E> {
    return new FirestoreCrudRepository<E>(collectionName);
  }

  public static initFor<E extends Entity>(
    collectionName: string,
    firebaseConnectionProperties: FirestoreConnectionProperties
  ): FirestoreCrudRepository<E> {
    FirestoreCrudRepository.init(firebaseConnectionProperties);
    return new FirestoreCrudRepository<E>(collectionName);
  }

  public static init<E extends Entity>(
    firebaseConnectionProperties: FirestoreConnectionProperties
  ): void {
    const { apiKey, authDomain, projectId, appName } =
      firebaseConnectionProperties;
    const firebaseApiKey = apiKey || FIREBASE_API_KEY || '';
    const firebaseAuthDomain = authDomain || FIREBASE_AUTH_DOMAIN || '';
    const firebaseProjectId = projectId || FIREBASE_PROJECT_ID || '';
    const firebaseAppName = appName || APP_NAME || '';

    Objects.requireNonEmpty(
      [firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseAppName],
      new ConfigurationException('Firebase credentials not set')
    );

    FirestoreCrudRepository.connectionProperties = {
      ...firebaseConnectionProperties,
      apiKey: firebaseApiKey,
      authDomain: firebaseAuthDomain,
      projectId: firebaseProjectId,
      appName: firebaseAppName
    };
    FirestoreCrudRepository.initialized = true;
  }

  public getDatabase(): any {
    return this.database;
  }

  public createId(): string {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    const documentReference: DocumentReference<T> = doc(collectionReference);

    logger.debug(`Generated new document ID: ${documentReference.id}`);
    return documentReference.id;
  }

  public async findById(id: string): Promise<Optional<T>> {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    const byId: QueryFieldFilterConstraint = where('id', '==', id);
    const byDelete: QueryFieldFilterConstraint = where('deleted', '!=', true);

    const record: QuerySnapshot<T> = await getDocs(
      query(collectionReference, byId, byDelete)
    );

    if (!record || (record.empty && record.docs.length === 0)) {
      return Optional.empty();
    }

    return Optional.ofNullable(record.docs[0].data());
  }

  public async findOneBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Optional<T>> {
    const querySnapShot: QuerySnapshot<T> | undefined = await this._findBy(
      filter,
      queryOptions
    );

    if (!querySnapShot) {
      return Optional.empty();
    }

    return Optional.ofNullable(querySnapShot.docs[0].data());
  }

  public async findAll(
    filter?: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    if (!filter) {
      return this._findAll(queryOptions);
    }

    const querySnapShot: QuerySnapshot<T> | undefined = await this._findBy(
      filter,
      queryOptions
    );

    if (!querySnapShot) {
      return [];
    }

    const sortedDocs = querySnapShot.docs.sort((a, b) => {
      const dateA = a.data().dateCreated as number;
      const dateB = b.data().dateCreated as number;
      return dateB - dateA; // Descending order
    });

    return sortedDocs.map((document) => {
      return document.data();
    });
  }

  public async create(payload: T): Promise<T> {
    logger.debug(`Creating new record for ${this.collectionName}`, payload);

    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    updatePayload(payload);

    const id = await this.getId(payload);
    const documentReference: DocumentReference<T> = doc(
      collectionReference,
      id
    );

    payload.id = id;

    await setDoc(documentReference, payload);
    logger.debug(
      `FirestoreCrudRepository created entity for ${this.collectionName}`,
      payload
    );
    return payload;
  }

  public async createAll(payload: T[]): Promise<T[]> {
    if (payload.length === 0) {
      return [];
    }
    const entitiesWithIds: T[] = payload.filter(
      (entity) => !commonUtils.isEmpty(entity.id)
    );
    entityUtils.checkForDuplicates<T>(entitiesWithIds, ['id']);

    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();

    const batch = writeBatch(this.database);

    const updated = payload.map(async (entity) => {
      updatePayload(entity);

      if (commonUtils.isEmpty(entity.id)) {
        const documentReference = doc(collectionReference);
        const record: T = { ...entity, id: documentReference.id };
        batch.set(documentReference, record);
      } else {
        const id = await this.checkDuplicateId(entity.id!);
        const documentReference = doc(collectionReference, id);
        batch.set(documentReference, entity);
      }
    });

    await Promise.all(updated);
    await batch.commit();
    return payload;
  }

  public async update(
    id: string,
    payload: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    const record = await this.findExpectedRecord(id);

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

  public async remove(
    id: string,
    queryOptions: QueryOptions<T> = { deletionOptions: { softDelete: true } }
  ): Promise<boolean> {
    const record = await this.findExpectedRecord(id);

    if (queryOptions.deletionOptions?.softDelete) {
      return this.softDelete(record, queryOptions);
    }

    return this.hardDelete(record.id!, queryOptions);
  }

  public async addListenerById(
    listener: (change?: T) => void,
    id: string
  ): Promise<() => void> {
    await this.findExpectedRecord(id);

    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    return onSnapshot(
      collectionReference,
      (snapshot: QuerySnapshot<T>) => {
        if (
          snapshot &&
          !snapshot.empty &&
          !snapshot.metadata.hasPendingWrites
        ) {
          const data: QueryDocumentSnapshot<T> | undefined = snapshot.docs.find(
            (doc) => doc.id === id
          );
          if (data) {
            listener(data.data());
          }
        }
      },
      (error) => logger.error('Firestore addListenerById error', error)
    );
  }

  public async addListener(
    listener: (change?: T, ...args: any) => void,
    filter: Partial<T> = {},
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<() => void> {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    const finalQuery: Query<T> = await this.createQuery(
      collectionReference,
      filter,
      queryOptions
    );
    return onSnapshot(
      finalQuery,
      (snapshot) => {
        if (
          snapshot &&
          !snapshot.empty &&
          !snapshot.metadata.hasPendingWrites
        ) {
          snapshot.docChanges().forEach((change) => {
            const document: T = change.doc.data();
            listener(document, change.type);
            logger.debug(
              `Firebase Listener: ${this.collectionName}, change: ${change.type}`
            );
            return;
          });
        }
      },
      (error) => logger.error('Firestore addListener error', error)
    );
  }

  private async getId(payload: T): Promise<string> {
    return commonUtils.isEmpty(payload.id)
      ? this.createId()
      : await this.checkDuplicateId(payload.id!);
  }

  private async performUpdate(
    record: T,
    payload: Partial<T>,
    _queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();

    const documentReference: DocumentReference<T> = doc(
      collectionReference,
      record.id
    );

    updatePayload(record);

    // @ts-ignore
    await updateDoc(documentReference, { ...record, ...payload });
    return true;
  }

  private async softDelete(
    record: T,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    markAsDeleted(record);

    return this.performUpdate(record, record, queryOptions);
  }

  private async hardDelete(
    id: string,
    _queryOptions?: QueryOptions<T> | undefined
  ): Promise<boolean> {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();
    await deleteDoc(doc(collectionReference, id));
    return true;
  }

  private getCollectionReference(): CollectionReference<T> {
    const collectionReference = collection(
      this.database,
      this.collectionName
    ) as CollectionReference<T>;
    Objects.requireNonEmpty(
      collectionReference,
      new ConfigurationException('Collection reference not found')
    );
    return collectionReference;
  }

  private async _findBy(
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<QuerySnapshot<T> | undefined> {
    const collectionReference: CollectionReference<T> =
      this.getCollectionReference();

    const finalQuery: Query<T> = await this.createQuery(
      collectionReference,
      filter,
      queryOptions
    );
    const querySnapshot: QuerySnapshot<T> = await getDocs(finalQuery);
    return querySnapshot.empty ? undefined : querySnapshot;
  }

  private getOrderConstraints(): QueryOrderByConstraint[] {
    const byOrderByDelete: QueryOrderByConstraint = orderBy('deleted', 'desc');
    const byOrderByDateCreated: QueryOrderByConstraint = orderBy(
      'dateCreated',
      'desc'
    );
    return [byOrderByDelete, byOrderByDateCreated];
  }

  private orderAndLimit(
    queryRef: Query<T>,
    queryOptions: QueryOptions<T> | undefined
  ): Query<T> {
    const constraints: QueryConstraint[] = this.getOrderConstraints();

    if (queryOptions?.sortBy) {
      const key = Object.keys(queryOptions.sortBy)[0];
      const value = queryOptions.sortBy[key];
      constraints.push(orderBy(key, value));
    }

    if (queryOptions?.limit) {
      constraints.push(limit(queryOptions.limit));
    }

    return query(queryRef, ...constraints);
  }

  private async createQuery(
    collectionRef: CollectionReference<T>,
    filter: Partial<T>,
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<Query<T>> {
    let mainQuery: Query<T> = collectionRef;

    const filterArray: QueryFieldFilterConstraint[] = Object.entries(
      filter
    ).map(([key, value]) => {
      return where(key, '==', value);
    });
    const deletionConstraint: QueryFieldFilterConstraint = where(
      'deleted',
      '!=',
      true
    );
    if (
      !queryOptions ||
      !queryOptions.logicalOperator ||
      queryOptions.logicalOperator === LogicalOperator.AND
    ) {
      mainQuery = query(mainQuery, deletionConstraint, ...filterArray);
    } else {
      mainQuery = query(mainQuery, and(deletionConstraint, or(...filterArray)));
    }

    mainQuery = this.orderAndLimit(mainQuery, queryOptions);
    return mainQuery;
  }

  private async _findAll(
    queryOptions?: QueryOptions<T> | undefined
  ): Promise<T[]> {
    const records: QuerySnapshot<T> | undefined = await this._findBy(
      {},
      queryOptions
    );
    if (!records) {
      return [];
    }

    return records.docs.map((value) => {
      return value.data();
    });
  }

  private async checkDuplicateId(id: string): Promise<string> {
    (await this.findById(id)).ifPresentThrow(
      new DuplicateRecordException(
        `${this.collectionName} record with id (${id}) already exists`
      )
    );
    return id;
  }

  private async findExpectedRecord(id: string): Promise<T> {
    const record = await this.findById(id);
    return record.orElseThrow(
      new RecordNotFoundException(
        `${this.collectionName} record with id (${id}) not found`
      )
    );
  }
}

export { FirestoreCrudRepository };
