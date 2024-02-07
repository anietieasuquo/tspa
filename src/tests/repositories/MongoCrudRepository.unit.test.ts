import { commonUtils, MongoCrudRepository, MongoSession, Optional, TransactionalCrudRepository } from '../../main';
import { User } from '../types/test';
import { DuplicateRecordException } from '../../main/exceptions/DuplicateRecordException';
import { MongoProvider } from '../../main/providers/MongoProvider';
import mongoose from 'mongoose';
import { createOrGetEntityModel } from '../../main/models/MongoEntityModel';
import { InvalidRequestException } from '../../main/exceptions/InvalidRequestException';
import { RecordNotFoundException } from '../../main/exceptions/RecordNotFoundException';

describe('MongoCrudRepository Unit Tests', () => {
  const appName = 'tspa';
  const uri = 'mongodb://root:password@localhost:27017/tspa?authSource=admin';
  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  let mongoCrudRepository: TransactionalCrudRepository<User>;
  let mockInsertOne = jest.fn();
  let mockInsertMany = jest.fn();
  let mockFindOne = jest.fn();
  let mockExec = jest.fn();
  let mockFindAll = jest.fn();
  let mockUpdateOne = jest.fn();
  let mockDeleteOne = jest.fn();
  let mockConnect = jest.fn();
  let mockStartTransaction = jest.fn();
  let mockCommitTransaction = jest.fn();
  let mockAbortTransaction = jest.fn();
  let mockEndSession = jest.fn();
  let mongoSession: MongoSession = <MongoSession><unknown>{
    startTransaction: mockStartTransaction,
    commitTransaction: mockCommitTransaction,
    abortTransaction: mockAbortTransaction,
    endSession: mockEndSession
  };
  const findAllType = { sort: jest.fn() };
  let mockProvider: MongoProvider = {
    connect: mockConnect
  };

  const userModel: mongoose.Model<User> = createOrGetEntityModel<User>(user, 'user');

  beforeEach(async () => {
    MongoProvider.connect = jest.fn().mockReturnValue(mockProvider);
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as any);
    jest.spyOn(mongoose, 'startSession').mockReturnValue(Promise.resolve(mongoSession));

    mongoCrudRepository = MongoCrudRepository.initFor<User>('user', { entities: [{ user }], uri, appName });

    // @ts-ignore
    jest.spyOn(userModel, 'findOne').mockReturnValue({ exec: mockExec, apply: mockFindOne });
    jest.spyOn(userModel, 'find').mockImplementationOnce(mockFindAll);
    jest.spyOn(userModel.prototype, 'save').mockImplementationOnce(mockInsertOne);
    jest.spyOn(userModel, 'insertMany').mockImplementationOnce(mockInsertMany);
    jest.spyOn(userModel.prototype, 'updateOne').mockReturnValue({ exec: mockExec, apply: mockUpdateOne });
    // @ts-ignore
    jest.spyOn(userModel, 'deleteOne').mockReturnValue({ exec: mockExec, apply: mockDeleteOne });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create and return unique entity id', () => {
    //WHEN
    const result = mongoCrudRepository.createId();

    //THEN
    expect(result).toBeTruthy();
  });

  it('should throw an exception when creating a record with an existing id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue({ ...user, id });
    mockFindOne.mockReturnValue({ ...user, id });
    mockInsertOne.mockReturnValue(null);

    //THEN
    await expect(async () => {
      await mongoCrudRepository.create({ ...user, id });
      expect(mockConnect).toHaveBeenCalled();
    }).rejects.toThrow(DuplicateRecordException);
  });

  it('should create and and save record with a generated id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockInsertOne.mockReturnValue({ ...user, id });
    const result: User = await mongoCrudRepository.create(user);

    //THEN
    expect(result.id).toBeTruthy();
    expect(result.name).toBe(user.name);
    expect(mockFindOne).toHaveBeenCalledTimes(0);
    expect(mockInsertOne).toHaveBeenCalled();
  });

  it('should create and and save record with a given id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);
    mockInsertOne.mockReturnValue({ ...user, id, _id: id });

    const result: User = await mongoCrudRepository.create({ ...user, id });

    //THEN
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
    expect(mockInsertOne).toHaveBeenCalled();
  });

  it('should create and save record with a given id within a transaction without errors', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);
    mockInsertOne.mockReturnValue({ ...user, id, _id: id });

    const optional: Optional<User> = await mongoCrudRepository.executeTransaction({
      mongoExecutor: async (session: MongoSession): Promise<Optional<User>> => {
        const newUser = await mongoCrudRepository.create({ ...user, id }, { mongoOptions: { session } });
        return Optional.of(newUser);
      }
    });

    //THEN
    expect(optional.isPresent()).toBe(true);
    const result = optional.get();
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
    expect(mockInsertOne).toHaveBeenCalled();
    expect(mockCommitTransaction).toHaveBeenCalled();
    expect(mockEndSession).toHaveBeenCalled();
  });

  it('should create and save record with a given id within a transaction with errors', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue({ ...user, id });
    mockFindOne.mockReturnValue({ ...user, id });
    mockInsertOne.mockReturnValue(null);

    //THEN
    await expect(async () => {
      await mongoCrudRepository.executeTransaction({
        mongoExecutor: async (session: MongoSession): Promise<Optional<User>> => {
          const newUser = await mongoCrudRepository.create({ ...user, id }, { mongoOptions: { session } });
          return Optional.of(newUser);
        }
      });
    }).rejects.toThrow(DuplicateRecordException);
    expect(mockAbortTransaction).toHaveBeenCalled();
  });

  it('should find and return an empty record by id when record is not found', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);

    const found: Optional<User> = await mongoCrudRepository.findById(id);

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });


  it('should find and return a record by id when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue({ ...user, id });
    mockFindOne.mockReturnValue({ ...user, id });
    const optional: Optional<User> = await mongoCrudRepository.findById(id);

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.name).toBe(user.name);
  });


  it('should find and return an empty record by field when record is not available', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);
    const found: Optional<User> = await mongoCrudRepository.findOneBy({ email });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by field when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    mockExec.mockReturnValue({ ...user, id });
    mockFindOne.mockReturnValue({ ...user, id });
    const optional: Optional<User> = await mongoCrudRepository.findOneBy({ email });

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
  });

  it('should find and return empty records when filter is empty', async () => {
    //WHEN
    mockFindAll.mockReturnValue(findAllType);
    const found = await mongoCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(0);
    expect(mockFindAll).toHaveBeenCalled();
  });

  it('should find and return valid records when filter is empty', async () => {
    //WHEN
    findAllType.sort.mockReturnValue([user]);
    mockFindAll.mockReturnValue(findAllType);
    const found = await mongoCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(1);
    expect(found[0].email).toBe(user.email);
    expect(mockFindAll).toHaveBeenCalled();
  });

  it('should find and return empty records when filter is not empty', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    findAllType.sort.mockReturnValue([]);
    mockFindAll.mockReturnValue(findAllType);
    const found = await mongoCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(0);
    expect(mockFindAll).toHaveBeenCalled();
  });

  it('should find and return valid records when records are found', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = user.email;

    //WHEN
    findAllType.sort.mockReturnValue([user]);
    mockFindAll.mockReturnValue(findAllType);
    const found = await mongoCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(1);
    expect(found[0].email).toBe(email);
  });

  it('should return empty array when creating all records with empty request', async () => {
    //WHEN
    const found = await mongoCrudRepository.createAll([]);

    //THEN
    expect(found.length).toBe(0);
  });

  it('should throw an exception when creating duplicate records', async () => {
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
    mockInsertMany.mockReturnValue([user, user]);
    const result = await mongoCrudRepository.createAll([user, user]);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(2);
    const ids = result?.map((r) => r.id);
    expect(ids).toBeTruthy();
    expect(ids?.length).toBe(2);
    expect(mockFindOne).toHaveBeenCalledTimes(0);
    expect(mockInsertMany).toHaveBeenCalled();
  });

  it('should return multiple results for multiple records creation with ids', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const newUser = { ...user, id };
    const users = [newUser, user];

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);
    mockInsertMany.mockReturnValue(users);
    const result = await mongoCrudRepository.createAll(users);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(2);
    const ids = result?.map((r) => r.id);
    expect(ids).toBeTruthy();
    expect(ids?.length).toBe(2);
    expect(ids?.includes(id)).toBeTruthy();
    expect(mockInsertMany).toHaveBeenCalled();
  });

  it('should throw an exception when updating a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);

    //THEN
    await expect(async () => {
      await mongoCrudRepository.update(id, user);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should update record', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const updatedUser = { ...user, id };
    const email = 'test';

    //WHEN
    mockExec.mockReturnValue(updatedUser);
    mockFindOne.mockReturnValue(updatedUser);
    mockUpdateOne.mockReturnValue({ modifiedCount: 1 });
    const result = await mongoCrudRepository.update(id, { ...updatedUser, email });

    //THEN
    expect(result).toBe(true);
  });

  it('should throw an exception when deleting a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue(undefined);
    mockFindOne.mockReturnValue(undefined);

    //THEN
    await expect(async () => {
      await mongoCrudRepository.remove(id);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should soft-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'test';

    //WHEN
    mockExec.mockReturnValue(user);
    mockFindOne.mockReturnValue(user);
    mockUpdateOne.mockReturnValue({ modifiedCount: 1 });

    const result = await mongoCrudRepository.remove(id);

    //THEN
    expect(result).toBeTruthy();
    expect(result).toBe(true);
  });

  it('should hard-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockExec.mockReturnValue({ deletedCount: 1 });
    mockFindOne.mockReturnValue(user);
    mockDeleteOne.mockReturnValue({ deletedCount: 1 });

    const result = await mongoCrudRepository.remove(id, { deletionOptions: { softDelete: false } });

    //THEN
    expect(result).toBeTruthy();
    expect(result).toBe(true);
  });
});
