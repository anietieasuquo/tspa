import { FirestoreEmulatorContainer, StartedFirestoreEmulatorContainer } from '@testcontainers/gcloud';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import {
  CrudRepository,
  FirestoreCrudRepository,
  LocalStorageCrudRepository,
  logger,
  MongoCrudRepository,
  Optional
} from '../main';
import { User } from './types/test';
import mongoose from 'mongoose';

describe('Smoke Test', () => {
  jest.setTimeout(100000000);
  const projectId = 'typescript-persistence-api';
  let firestoreEmulatorContainer: StartedFirestoreEmulatorContainer;
  let mongoContainer: StartedMongoDBContainer;
  const firestoreName = 'firestore';
  const mongoName = 'mongo';
  const localStorageName = 'localStorage';

  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  afterAll(async () => {
    await firestoreEmulatorContainer.stop();
    await mongoose.disconnect();
    await mongoContainer.stop();
  });

  const check = async (repository: CrudRepository<User>): Promise<boolean> => {
    try {
      const createdEntity = await repository.create(user);
      expect(createdEntity).toBeTruthy();

      const retrievedEntity: Optional<User> = await repository.findById(createdEntity.id!);
      expect(retrievedEntity.isPresent()).toEqual(true);
      expect(retrievedEntity.get().id).toEqual(createdEntity.id);

      const updatedEntity = await repository.update(createdEntity.id!, <User>{
        ...createdEntity,
        name: 'Jane Doe'
      });
      expect(updatedEntity).toEqual(true);
      const retrievedUpdatedEntity: Optional<User> = await repository.findById(createdEntity.id!);
      expect(retrievedUpdatedEntity.isPresent()).toEqual(true);
      expect(retrievedUpdatedEntity.get()['name']).toEqual('Jane Doe');

      const deletedEntity = await repository.remove(createdEntity.id!);
      expect(deletedEntity).toEqual(true);

      const retrievedDeletedEntity: Optional<User> = await repository.findById(createdEntity.id!);
      expect(retrievedDeletedEntity.isPresent()).toEqual(false);
      return true;
    } catch (e) {
      logger.error('Test failed:', e);
      return false;
    }
  };

  const getMongoRepository = async (): Promise<CrudRepository<User>> => {
    mongoContainer = await new MongoDBContainer('mongo:7.0-jammy').start();
    const host = mongoContainer.getHost();
    const port = mongoContainer.getFirstMappedPort();
    logger.info(`Smoke test > Mongodb container is running on: ${host}:${port}`);
    const appName = 'tspa';
    const uri = `mongodb://${host}:${port}/${appName}?authSource=admin&replicaSet=rs0&directConnection=true&ssl=false`;
    return MongoCrudRepository.initFor<User>('user', { entities: [{ user }], uri, appName });
  };

  const getFirestoreRepository = async (): Promise<CrudRepository<User>> => {
    firestoreEmulatorContainer = await new FirestoreEmulatorContainer().start();
    return FirestoreCrudRepository.initFor<User>('user', {
      apiKey: 'apiKey',
      authDomain: 'authDomain',
      projectId,
      appName: projectId,
      emulatorEndpoint: firestoreEmulatorContainer.getEmulatorEndpoint()
    });
  };

  const getLocalStorageRepository = async (): Promise<CrudRepository<User>> => {
    return LocalStorageCrudRepository.initFor<User>('user', {
      appName: 'tspa',
      storagePath: './db'
    });
  };

  const getRepositoryByName = (name: string): Promise<CrudRepository<User>> => {
    switch (name) {
      case localStorageName:
        return getLocalStorageRepository();
      case firestoreName:
        return getFirestoreRepository();
      case mongoName:
        return getMongoRepository();
      default:
        throw new Error('Invalid repository name');
    }
  };

  test.each([
    { getter: getRepositoryByName, name: firestoreName, result: true },
    { getter: getRepositoryByName, name: mongoName, result: true },
    { getter: getRepositoryByName, name: localStorageName, result: true }
  ])('[$#] should successfully run CRUD operations for $name and result in => $result', async ({
                                                                                                 getter,
                                                                                                 name,
                                                                                                 result
                                                                                               }: {
    getter: (name: string) => Promise<CrudRepository<User>>,
    name: string,
    result: boolean
  }) => {
    const repository: CrudRepository<User> = await getter(name);
    expect(await check(repository)).toBe(result);
  });
});
