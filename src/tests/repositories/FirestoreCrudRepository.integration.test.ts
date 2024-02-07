import { commonUtils, FirestoreCrudRepository, logger, LogicalOperator, Optional } from '../../main';
import { User } from '../types/test';
import { DuplicateRecordException } from '../../main/exceptions/DuplicateRecordException';
import { InvalidRequestException } from '../../main/exceptions/InvalidRequestException';
import { RecordNotFoundException } from '../../main/exceptions/RecordNotFoundException';
import { OptimisticLockException } from '../../main/exceptions/OptimisticLockException';

describe('FirestoreCrudRepository Integration Tests', () => {
  const projectId = 'typescript-persistence-api';
  let firestoreCrudRepository: FirestoreCrudRepository<User>;
  const cleanUp = async () => {
    const result = await fetch(`http://localhost:8095/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
    logger.debug('Clean up result:', { isOk: result.ok, status: result.status });
  };

  beforeAll(() => {
    firestoreCrudRepository = FirestoreCrudRepository.initFor<User>('user', {
      apiKey: 'apiKey',
      authDomain: 'authDomain',
      projectId,
      appName: 'typescript-persistence-api'
    });
  });

  beforeEach(() => {
    if (process.env.JEST_DEBUG) {
      jest.setTimeout(100000000);
    }
  });

  afterEach(async () => {
    await cleanUp();
  });

  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  const createAndCheckUser = async (user: User): Promise<User> => {
    const createdUser: User = await firestoreCrudRepository.create(user);

    expect(createdUser).toBeTruthy();
    expect(createdUser.id).toBeTruthy();
    expect(createdUser.name).toBe(user.name);
    return createdUser!;
  };

  it('should throw an exception when creating a record with an existing id', async () => {
    //GIVEN
    const id = commonUtils.generate();
    logger.debug('Generated ID:', id);
    const createdUser: User = await createAndCheckUser({ ...user, id });

    //THEN
    await expect(async () => {
      //WHEN
      await firestoreCrudRepository.create(createdUser);
    }).rejects.toThrow(DuplicateRecordException);
  });

  it('should create and and save record with a generated document id', async () => {

    //WHEN
    await createAndCheckUser(user);
  });

  it('should create and and save record with a given document id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const result: User = await createAndCheckUser({ ...user, id });

    //THEN
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
  });

  it('should find and return an empty record by id when record is not found', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const found = await firestoreCrudRepository.findById(id);

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by id when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    const createdUser: User = await createAndCheckUser({ ...user, id });
    const optional: Optional<User> = await firestoreCrudRepository.findById(id);

    //THEN
    expect(optional.isPresent()).toBe(true);
    const found = optional.get();
    expect(found).toBeTruthy();
    expect(found.id).toBe(id);
    expect(found.name).toBe(createdUser.name);
  });

  it('should find and return an empty record by field when record is not available', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    await createAndCheckUser(user);
    const found = await firestoreCrudRepository.findOneBy({ email });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by field when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    await createAndCheckUser({ ...user, id, email });
    const optional: Optional<User> = await firestoreCrudRepository.findOneBy({ email });

    //THEN
    expect(optional.isPresent()).toBe(true);
    const found = optional.get();
    expect(found).toBeTruthy();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
  });

  it('should find and return empty records when filter is empty', async () => {
    //WHEN
    const found = await firestoreCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid and sorted records when filter is not provided', async () => {
    //GIVEN
    const today = Date.now();
    const yesterday = today - 86400000;
    const tomorrow = today + 1;
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //WHEN
    await createAndCheckUser({ ...user, dateCreated: today, name: 'Mary' });
    await createAndCheckUser({ ...user, dateCreated: tomorrow, name: 'James' });
    await createAndCheckUser({ ...user, dateCreated: yesterday, name: 'Joe' });
    const found = await firestoreCrudRepository.findAll();

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
    const found = await firestoreCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid and sorted records when filter is provided', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email
    };
    const today = Date.now();
    const yesterday = today - 86400000;
    const tomorrow = today + 1;
    const next = today + 2;

    //WHEN
    await createAndCheckUser({ ...user, dateCreated: today, name: 'Mary', email });
    await createAndCheckUser({ ...user, dateCreated: tomorrow, name: 'James', email });
    await createAndCheckUser({ ...user, dateCreated: yesterday, name: 'Joe', email });
    await createAndCheckUser({ ...user, dateCreated: next, name: 'Mark', email: 'mark@gmail.com' });
    const found = await firestoreCrudRepository.findAll({
      email
    }, { logicalOperator: LogicalOperator.AND });

    //THEN
    expect(found.length).toBe(3);
    expect(found[0].name).toBe('James');
    expect(found[1].name).toBe('Mary');
    expect(found[2].name).toBe('Joe');
  });

  it('should find and return valid and sorted records when filter is provided using or logical operator', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email
    };
    const today = Date.now();
    const yesterday = today - 86400000;
    const tomorrow = today + 1;
    const next = today + 2;

    //WHEN
    await createAndCheckUser({ ...user, dateCreated: today, name: 'Mary', email });
    await createAndCheckUser({ ...user, dateCreated: tomorrow, name: 'James', email });
    await createAndCheckUser({ ...user, dateCreated: yesterday, name: 'Joe', email });
    await createAndCheckUser({ ...user, dateCreated: next, name: 'Mark', email: 'mark@gmail.com' });
    await createAndCheckUser({ ...user, dateCreated: next + 1, name: 'Jane', email: 'jane@gmail.com' });
    const found = await firestoreCrudRepository.findAll({
      email,
      name: 'Jane'
    }, { logicalOperator: LogicalOperator.OR, limit: 3 });

    expect(found.length).toBe(3);
    expect(found[0].name).toBe('Jane');
    expect(found[1].name).toBe('James');
    expect(found[2].name).toBe('Mary');
  });

  it('should return empty array when creating multiple records with empty request', async () => {
    //WHEN
    const found = await firestoreCrudRepository.createAll([]);

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
      await firestoreCrudRepository.createAll([newUser, newUser]);
    }).rejects.toThrow(InvalidRequestException);
  });

  it('should return multiple results for multiple records creation without ids', async () => {
    //GIVEN
    const user: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //WHEN
    const result = await firestoreCrudRepository.createAll([user, user, user]);

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
    const result = await firestoreCrudRepository.createAll(users);

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
      await firestoreCrudRepository.update(id, user);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should throw an exception when updating a record with optimistic locking enabled and version does not match', async () => {
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
      await firestoreCrudRepository.update(id, {
        ...user,
        version: (user.version || 1) + 1
      }, { locking: 'optimistic' });
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
    const result = await firestoreCrudRepository.update(id, updatedUser);

    //THEN
    expect(result).toBe(true);

    const optional: Optional<User> = await firestoreCrudRepository.findById(id);

    expect(optional.isPresent()).toBe(true);
    const found = optional.get();
    expect(found).toBeTruthy();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
    expect(found.version).toBe(createdUser.version! + 1);
  });

  it('should throw an exception when deleting a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //THEN
    await expect(async () => {
      await firestoreCrudRepository.remove(id);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should soft-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    await createAndCheckUser({ ...user, id });
    const result = await firestoreCrudRepository.remove(id);

    //THEN
    expect(result).toBe(true);
  });

  it('should hard-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    await createAndCheckUser({ ...user, id });

    const result = await firestoreCrudRepository.remove(id, { deletionOptions: { softDelete: false } });

    //THEN
    expect(result).toBe(true);
    const found: Optional<User> = await firestoreCrudRepository.findById(id);
    expect(found.isPresent()).toBeFalsy();
  });
});
