import { Entity, LocalStorageCrudRepository, Optional } from '../main';
import { User } from './types/test';

describe('LocalStorage Smoke Test', () => {
  let repository: LocalStorageCrudRepository<Entity>;

  beforeAll(async () => {
    repository = await LocalStorageCrudRepository.initFor<User>('user', {
      appName: 'tspa',
      storagePath: './db'
    });
  });

  it('should operate on an entity', async () => {
    const entity = {
      id: repository.createId(),
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'john@gmail.com'
    };

    const createdEntity = await repository.create(entity);
    expect(createdEntity).toBeTruthy();

    const retrievedEntity: Optional<Entity> = await repository.findById(createdEntity.id!);

    expect(retrievedEntity.isPresent()).toEqual(true);
    expect(retrievedEntity.get().id).toEqual(createdEntity.id);

    const updatedEntity = await repository.update(createdEntity.id!, <Entity>{
      ...createdEntity,
      name: 'Jane Doe'
    });
    expect(updatedEntity).toEqual(true);
    const retrievedUpdatedEntity: Optional<Entity> = await repository.findById(createdEntity.id!);
    expect(retrievedUpdatedEntity.isPresent()).toEqual(true);
    expect(retrievedUpdatedEntity.get()['name']).toEqual('Jane Doe');

    const deletedEntity = await repository.remove(createdEntity.id!);
    expect(deletedEntity).toEqual(true);

    const retrievedDeletedEntity: Optional<Entity> = await repository.findById(createdEntity.id!);
    expect(retrievedDeletedEntity.isPresent()).toEqual(true);
  });
});
