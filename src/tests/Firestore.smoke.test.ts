import {
  CrudRepository,
  FirestoreCrudRepository,
  LocalStorageCrudRepository,
  MongoCrudRepository,
  Optional
} from '../main';
import { User } from './types/test';

describe('Firestore Smoke Test', () => {
  let localStorageCrudRepository: LocalStorageCrudRepository<User>;
  let firestoreCrudRepository: FirestoreCrudRepository<User>;
  let mongoCrudRepository: MongoCrudRepository<User>;

  const check = async (repository: CrudRepository<User>): Promise<boolean> => {
    const entity: User = {
      id: repository.createId(),
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'john@gmail.com'
    };

    const createdEntity = await repository.create(entity);
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
  };

  beforeAll(async () => {
    localStorageCrudRepository = await LocalStorageCrudRepository.initFor<User>('user', {
      appName: 'tspa',
      storagePath: './db'
    });

    firestoreCrudRepository = FirestoreCrudRepository.initFor<User>('user', {
      apiKey: 'apiKey',
      authDomain: 'authDomain',
      projectId: 'typescript-persistence-api',
      appName: 'typescript-persistence-api'
    });
  });

  it('should operate on an entity', async () => {
    test.each([
      [localStorageCrudRepository, 'LocalStorage', true],
      [firestoreCrudRepository, 'Firestore', true],
      [mongoCrudRepository, 'Mongo', true]
    ])('should successfully run CRUD operations for  [%s, %s] and result in => %s', (repository: CrudRepository<User>, name: string, result: boolean) => {
      expect(check(repository)).toBe(result);
    });
  });
});
