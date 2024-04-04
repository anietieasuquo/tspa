import { commonUtils, LocalStorageCrudRepository, logger, Optional } from '../../main';
import { User } from '../types/test';
import { LocalStorageProvider } from '../../main/providers/LocalStorageProvider';
import { DuplicateRecordException } from '../../main/exceptions/DuplicateRecordException';
import { RecordNotFoundException } from '../../main/exceptions/RecordNotFoundException';
import { InvalidRequestException } from '../../main/exceptions/InvalidRequestException';

describe('LocalStorageCrudRepository', () => {
  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  let localStorageCrudRepository: LocalStorageCrudRepository<User>;
  let mockClear = jest.fn();
  let mockKey = jest.fn();
  let mockRemoveItem = jest.fn();
  let mockGetItem = jest.fn();
  let mockCreateItem = jest.fn();
  // @ts-ignore
  let mockProvider: LocalStorageProvider = {
    storage: {
      length: 0,
      clear: mockClear,
      key: mockKey,
      removeItem: mockRemoveItem,
      getItem: mockGetItem,
      setItem: mockCreateItem
    }
  };
  const getActiveKey = (id: string): string => {
    return `${id}:false`;
  };

  beforeEach(async () => {
    localStorageCrudRepository = await LocalStorageCrudRepository.initFor<User>('user', {
      appName: 'tspa',
      storagePath: './db'
    });
    LocalStorageProvider.getInstance = jest.fn().mockReturnValue(mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create and return unique entity id', () => {
    //WHEN
    const result = localStorageCrudRepository.createId();

    //THEN
    expect(result).toBeTruthy();
  });

  it('should throw an exception when creating a record with and existing id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: { ...user, id } }));
    mockCreateItem.mockReturnValue(null);

    //THEN
    await expect(async () => {
      await localStorageCrudRepository.create({ ...user, id });
    }).rejects.toThrow(DuplicateRecordException);
  });

  it('should create and and save record with a generated id', async () => {
    //WHEN
    mockGetItem.mockReturnValue('');
    mockCreateItem.mockReturnValue(null);
    const result: User = await localStorageCrudRepository.create(user);

    //THEN
    expect(result.id).toBeTruthy();
    expect(result.name).toBe(user.name);
    expect(mockGetItem).toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalled();
  });

  it('should create and and save record with a given id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ '123': user }));
    mockCreateItem.mockReturnValue(null);

    const result: User = await localStorageCrudRepository.create({ ...user, id });

    //THEN
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
    expect(mockGetItem).toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalled();
  });

  it('should find and return an empty record by id when storage is empty', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({}));
    const found: Optional<User> = await localStorageCrudRepository.findById(id);

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return an empty record by id when record is not available', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: { ...user, id } }));
    const found: Optional<User> = await localStorageCrudRepository.findById('record-id');

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: { ...user, id } }));
    const optional: Optional<User> = await localStorageCrudRepository.findById(id);

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.name).toBe(user.name);
    expect(mockGetItem).toHaveBeenCalled();
  });

  it('should find and return an empty record by field when storage is empty', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({}));
    const found: Optional<User> = await localStorageCrudRepository.findOneBy({ email });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return an empty record by field when record is not available', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: user }));
    const found: Optional<User> = await localStorageCrudRepository.findOneBy({ 'email': 'test' });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by field', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: { ...user, id } }));
    const optional: Optional<User> = await localStorageCrudRepository.findOneBy({ email });

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
    expect(mockGetItem).toHaveBeenCalled();
  });

  it('should find and return empty records when storage is empty', async () => {
    //GIVEN
    const email = 'johndoe@gmail.com';

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({}));
    const found = await localStorageCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return empty records when records is empty', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: user }));
    const found = await localStorageCrudRepository.findAll({ 'email': 'test' });

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid records when records are found', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: user }));
    const found = await localStorageCrudRepository.findAll({ 'email': user.email });

    //THEN
    expect(found.length).toBe(1);
    expect(found[0].email).toBe(user.email);
  });

  it('should return empty array when creating all records with empty request', async () => {
    //WHEN
    const found = await localStorageCrudRepository.createAll([]);

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
      await localStorageCrudRepository.createAll([newUser, newUser]);
    }).rejects.toThrow(InvalidRequestException);
  });

  it('should return multiple results for multiple records creation', async () => {
    //WHEN
    mockGetItem.mockReturnValue('');
    mockCreateItem.mockReturnValue(null);
    const result = await localStorageCrudRepository.createAll([user, user]);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(2);
    expect(mockGetItem).toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalled();
  });

  it('should throw an exception when updating a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({}));
    mockCreateItem.mockReturnValue(null);

    //THEN
    await expect(async () => {
      await localStorageCrudRepository.update(id, user);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should update record', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'test';

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: user }));
    mockCreateItem.mockReturnValue(null);
    const result = await localStorageCrudRepository.update(id, { ...user, email });

    //THEN
    expect(result).toBe(true);
    expect(mockGetItem).toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalled();
  });

  it('should throw an exception when deleting a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({}));
    mockCreateItem.mockReturnValue(null);

    //THEN
    await expect(async () => {
      await localStorageCrudRepository.remove(id);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockGetItem.mockReturnValue(JSON.stringify({ [getActiveKey(id)]: { ...user, id } }));
    mockCreateItem.mockReturnValue(null);
    const result = await localStorageCrudRepository.remove(id);

    //THEN
    expect(result).toBe(true);
    expect(mockGetItem).toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalled();
  });
});
