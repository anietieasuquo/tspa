import { FirestoreEmulatorContainer, StartedFirestoreEmulatorContainer } from '@testcontainers/gcloud';
import {
  CrudRepository,
  FirestoreCrudRepository,
  LocalStorageCrudRepository,
  logger,
  MongoCrudRepository,
  Optional
} from '../main';
import { User } from './types/test';
import { DockerComposeEnvironment, PullPolicy, StartedDockerComposeEnvironment, Wait } from 'testcontainers';
import { StartedGenericContainer } from 'testcontainers/build/generic-container/started-generic-container';
import mongoose from 'mongoose';

describe('Smoke Test', () => {
  jest.setTimeout(100000000);
  const projectId = 'typescript-persistence-api';
  let firestoreEmulatorContainer: StartedFirestoreEmulatorContainer;
  let localStorageCrudRepository: LocalStorageCrudRepository<User>;
  let firestoreCrudRepository: FirestoreCrudRepository<User>;
  let mongoEnvironment: StartedDockerComposeEnvironment;
  let mongoContainer: StartedGenericContainer;
  const mongoService = 'mongodb';
  const setupService = 'mongo-setup';
  let mongoCrudRepository: MongoCrudRepository<User>;
  const firestoreName = 'firestore';
  const mongoName = 'mongo';
  const localStorageName = 'localStorage';

  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  beforeAll(async () => {
    firestoreEmulatorContainer = await new FirestoreEmulatorContainer().start();
    localStorageCrudRepository = await LocalStorageCrudRepository.initFor<User>('user', {
      appName: 'tspa',
      storagePath: './db'
    });

    firestoreCrudRepository = FirestoreCrudRepository.initFor<User>('user', {
      apiKey: 'apiKey',
      authDomain: 'authDomain',
      projectId,
      appName: projectId,
      emulatorEndpoint: firestoreEmulatorContainer.getEmulatorEndpoint()
    });

    mongoEnvironment = await new DockerComposeEnvironment('./docker', 'docker-compose.yml')
      .withBuild()
      .withPullPolicy(PullPolicy.alwaysPull())
      .withWaitStrategy(mongoService, Wait.forListeningPorts())
      .withWaitStrategy(setupService, Wait.forListeningPorts())
      .withEnvironment({ DEBUG: 'testcontainers:containers' })
      .up([mongoService, setupService]);

    mongoContainer = mongoEnvironment.getContainer(mongoService);
    const host = mongoContainer.getHost();
    const port = mongoContainer.getFirstMappedPort();
    logger.info(`Smoke test > Mongodb container is running on: ${host}:${port}`);
    const appName = 'tspa';
    const uri = `mongodb://${host}:${port}/${appName}?authSource=admin&replicaSet=tspa-rs`;
    mongoCrudRepository = MongoCrudRepository.initFor<User>('user', { entities: [{ user }], uri, appName });
  });

  afterAll(async () => {
    await firestoreEmulatorContainer.stop();
    await mongoose.disconnect();
    await mongoContainer.stop();
    await mongoEnvironment.stop();
    await mongoEnvironment.down();
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

  const getRepositoryByName = (name: string): CrudRepository<User> => {
    switch (name) {
      case localStorageName:
        return localStorageCrudRepository;
      case firestoreName:
        return firestoreCrudRepository;
      case mongoName:
        return mongoCrudRepository;
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
    getter: (name: string) => CrudRepository<User>,
    name: string,
    result: boolean
  }) => {
    const repository: CrudRepository<User> = getter(name);
    expect(await check(repository)).toBe(result);
  });
});
