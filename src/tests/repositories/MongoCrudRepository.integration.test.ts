import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import mongoose from 'mongoose';
import { commonUtils, LogicalOperator, MongoCrudRepository, MongoSession, Optional } from '../../main';
import { User } from '../types/test';
import { DuplicateRecordException } from '../../main/exceptions/DuplicateRecordException';
import { InvalidRequestException } from '../../main/exceptions/InvalidRequestException';
import { RecordNotFoundException } from '../../main/exceptions/RecordNotFoundException';
import { OptimisticLockException } from '../../main/exceptions/OptimisticLockException';

describe('MongoCrudRepository Integration Tests', () => {
  let mongoCrudRepository: MongoCrudRepository<User>;
  let container: StartedMongoDBContainer;

  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  beforeAll(async () => {
    container = await new MongoDBContainer('mongo:7.0-jammy').start();
    const host = container.getHost();
    const port = container.getFirstMappedPort();
    const appName = 'tspa';
    const uri = `mongodb://${host}:${port}/${appName}?authSource=admin&replicaSet=rs0&directConnection=true&ssl=false`;
    mongoCrudRepository = MongoCrudRepository.initFor<User>('user', { entities: [{ user }], uri, appName });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await container.stop();
  });

  beforeEach(async () => {
    if (process.env.JEST_DEBUG) {
      jest.setTimeout(100000000);
    }

    await mongoCrudRepository.findById('0');
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  const createAndCheckUser = async (user: User): Promise<User> => {
    const createdUser: User = await mongoCrudRepository.create(user);

    expect(createdUser.id).toBeTruthy();
    expect(createdUser.name).toBe(user.name);
    return createdUser;
  };

  it('should throw an exception when creating a record with an existing id', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const createdUser: User = await createAndCheckUser({ ...user, id });

    //THEN
    await expect(async () => {
      //WHEN
      await mongoCrudRepository.create(createdUser);
    }).rejects.toThrow(DuplicateRecordException);
  });

  it('should create and and save record with a generated id', async () => {
    //WHEN
    await createAndCheckUser(user);
  });

  it('should create and and save record with a given id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const result: User = await createAndCheckUser({ ...user, id });

    //THEN
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
  });

  it('should create and and save record with a given id within a transaction without errors', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //WHEN
    const optional: Optional<User> = await mongoCrudRepository.executeTransaction({
      mongoExecutor: async (session: MongoSession): Promise<Optional<User>> => {
        const createdUser = await mongoCrudRepository.create({ ...user, id }, { mongoOptions: { session } });
        return Optional.of(createdUser);
      }
    });

    //THEN
    expect(optional.isPresent()).toBe(true);
    const result = optional.get();
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
  });

  it('should create and and save record with a given id within a transaction with errors', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //WHEN
    await expect(async () => {
      //WHEN
      const optional: Optional<User> = await mongoCrudRepository.executeTransaction({
        mongoExecutor: async (session: MongoSession): Promise<Optional<User>> => {
          // First record will be successfully created
          const createdUser = await mongoCrudRepository.create({ ...user, id }, { mongoOptions: { session } });

          // Second record will fail due to duplicate id and the whole transaction should be rolled back
          await mongoCrudRepository.create({ ...user, id }, { mongoOptions: { session } });
          return Optional.of(createdUser);
        }
      });
      expect(optional.isPresent()).toBe(false);
    }).rejects.toThrow(DuplicateRecordException);

    //THEN
    const found = await mongoCrudRepository.findById(id);
    expect(found.isPresent()).toBe(false);
  });

  it('should find and return an empty record by id when record is not found', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const found: Optional<User> = await mongoCrudRepository.findById(id);

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by id when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const createdUser: User = await createAndCheckUser({ ...user, id });
    const optional: Optional<User> = await mongoCrudRepository.findById(id);

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.name).toBe(createdUser.name);
  });

  it('should find and return an empty record by field when record is not available', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    await createAndCheckUser(user);
    const found: Optional<User> = await mongoCrudRepository.findOneBy({ email });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });


  it('should find and return a record by field when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    await createAndCheckUser({ ...user, id, email });
    const optional: Optional<User> = await mongoCrudRepository.findOneBy({ email });

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
  });

  it('should find and return a record by fields when they exists', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    await createAndCheckUser({ ...user, id, email });
    await createAndCheckUser({ ...user, name: 'Silva', email: 'silva@gmail.com' });
    await createAndCheckUser({ ...user, name: 'Bon', email: 'bon@gmail.com' });
    const found = await mongoCrudRepository.findAll({ email, name: 'Silva' }, { logicalOperator: LogicalOperator.OR });

    //THEN
    expect(found.length).toBe(2);
    expect(found[0].email).toBe(email);
    expect(found[1].email).toBe('silva@gmail.com');
  });

  it('should find and return empty records when filter is empty', async () => {
    //WHEN
    const found = await mongoCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid and sorted records when filter is empty', async () => {
    //GIVEN
    const today = Date.now();
    const yesterday = today - 86400000;
    const tomorrow = today + 1;

    //WHEN
    await createAndCheckUser({ ...user, dateCreated: today, name: 'Mary' });
    await createAndCheckUser({ ...user, dateCreated: tomorrow, name: 'James' });
    await createAndCheckUser({ ...user, dateCreated: yesterday, name: 'Joe' });
    const found = await mongoCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(3);
    expect(found[0].name).toBe('James');
    expect(found[1].name).toBe('Mary');
    expect(found[2].name).toBe('Joe');
  });

  it('should find and return empty records when filter is not empty', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    const found = await mongoCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid and sorted records when filter is not empty', async () => {
    //GIVEN
    const email = user.email;

    //WHEN
    const today = Date.now();
    const yesterday = today - 86400000;
    const tomorrow = today + 1;
    const next = today + 2;
    await createAndCheckUser({ ...user, dateCreated: today, name: 'Mary', email });
    await createAndCheckUser({ ...user, dateCreated: tomorrow, name: 'James', email });
    await createAndCheckUser({ ...user, dateCreated: yesterday, name: 'Joe', email });
    await createAndCheckUser({ ...user, dateCreated: next, name: 'Mark', email: 'mark@gmail.com' });
    const found = await mongoCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(3);
    expect(found[0].name).toBe('James');
    expect(found[1].name).toBe('Mary');
    expect(found[2].name).toBe('Joe');
  });

  it('should return empty array when creating multiple records with empty request', async () => {
    //WHEN
    const found = await mongoCrudRepository.createAll([]);

    //THEN
    expect(found.length).toBe(0);
  });

  it('should throw InvalidRequestException when creating duplicate records', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const newUser = { ...user, id };

    //THEN
    await expect(async () => {

      //WHEN
      await mongoCrudRepository.createAll([newUser, newUser]);
    }).rejects.toThrow(InvalidRequestException);
  });

  it('should return multiple results for multiple records creation without ids', async () => {
    //WHEN
    const result = await mongoCrudRepository.createAll([user, user, user]);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(3);
    const ids = result?.map((r) => r.id);
    expect(ids).toBeTruthy();
    expect(ids?.length).toBe(3);
  });

  it('should return multiple results for multiple records creation with ids', async () => {
    //GIVEN
    const userIds = [commonUtils.generate(), commonUtils.generate(), commonUtils.generate()];
    const users: User[] = userIds.map((id) => ({ ...user, id }));

    //WHEN
    const result = await mongoCrudRepository.createAll(users);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(3);
    const ids = result?.map((r) => r.id);
    expect(ids).toBeTruthy();
    expect(ids?.length).toBe(3);
    ids.forEach((id) => expect(userIds).toContain(id));
  });

  it('should throw an exception when updating a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //THEN
    await expect(async () => {
      await mongoCrudRepository.update(id, user);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should throw an exception when updating a record with optimistic lock enabled and version does not match', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //THEN
    await createAndCheckUser({ ...user, id });

    await expect(async () => {
      await mongoCrudRepository.update(id, { ...user, version: (user.version || 1) + 1 }, { locking: 'optimistic' });
    }).rejects.toThrow(OptimisticLockException);
  });

  it('should update record', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'test';
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };
    const updatedUser: User = { ...user, email };

    //WHEN
    const createdUser = await createAndCheckUser({ ...user, id });
    const result = await mongoCrudRepository.update(id, updatedUser);

    //THEN
    expect(result).toBe(true);

    const optional: Optional<User> = await mongoCrudRepository.findById(id);
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
    expect(found.version).toBe(createdUser.version! + 1);
  });

  it('should throw an exception when deleting a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //THEN
    await expect(async () => {
      await mongoCrudRepository.remove(id);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should soft-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    await createAndCheckUser({ ...user, id });
    const result = await mongoCrudRepository.remove(id);

    //THEN
    expect(result).toBe(true);
  });

  it('should hard-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    await createAndCheckUser({ ...user, id });

    const result = await mongoCrudRepository.remove(id, { deletionOptions: { softDelete: false } });

    //THEN
    expect(result).toBe(true);
    const found: Optional<User> = await mongoCrudRepository.findById(id);
    expect(found.isPresent()).toBeFalsy();
  });
});
