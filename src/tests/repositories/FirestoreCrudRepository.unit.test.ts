import * as firestore from 'firebase/firestore';
import { CollectionReference, DocumentReference, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { commonUtils, FirestoreCrudRepository, Optional } from '../../main';
import { User } from '../types/test';
import { DuplicateRecordException } from '../../main/exceptions/DuplicateRecordException';
import { InvalidRequestException } from '../../main/exceptions/InvalidRequestException';
import { RecordNotFoundException } from '../../main/exceptions/RecordNotFoundException';
import { FirestoreProvider } from '../../main/providers/FirestoreProvider';
import { Query } from 'mongoose';

jest.mock('firebase/firestore', () => {
  return {
    __esModule: true,
    ...jest.requireActual('firebase/firestore')
  };
});

describe('FirestoreCrudRepository Unit Tests', () => {
  const user: User = {
    deleted: false,
    dateCreated: Date.now(),
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  };

  let firestoreCrudRepository: FirestoreCrudRepository<User>;
  let mockAuth = jest.fn();

  beforeEach(async () => {
    const database = { auth: mockAuth, firestore: { app: {} } };
    FirestoreProvider.getInstance = jest.fn().mockReturnValue(database);

    firestoreCrudRepository = FirestoreCrudRepository.initFor<User>('user', {
      apiKey: 'apiKey',
      authDomain: 'authDomain',
      projectId: 'projectId',
      appName: 'appName'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockFind = (id?: string, data?: User | User[]) => {
    //GIVEN
    const createQueryDocumentSnapshot = (data: User) => {
      return { data: () => data } as QueryDocumentSnapshot<User, any>;
    };
    const users: User[] = data ? (Array.isArray(data) ? data : [data]) : [];
    const querySnapshot: QuerySnapshot<User> = {
      docs: users.map(createQueryDocumentSnapshot),
      empty: users.length === 0
    } as unknown as QuerySnapshot<User>;
    const collectionReference: CollectionReference<User> = { id } as unknown as CollectionReference<User>;
    const query: Query<User, any> = jest.fn() as unknown as Query<User, any>;

    //WHEN
    // @ts-ignore
    jest.spyOn(firestore, 'query').mockReturnValue(query);
    jest.spyOn(firestore, 'getDocs').mockReturnValue(Promise.resolve(querySnapshot));
    jest.spyOn(firestore, 'collection').mockReturnValue(collectionReference);
  };

  const mockCreate = (id?: string, data?: User, newUser: boolean = false) => {
    //GIVEN
    const documentReference: DocumentReference<User> = { id } as unknown as DocumentReference<User>;

    //WHEN
    mockFind(id, newUser ? undefined : data);

    // @ts-ignore
    jest.spyOn(firestore, 'doc').mockReturnValue(documentReference);
    jest.spyOn(firestore, 'setDoc').mockReturnValue(Promise.resolve());
  };

  const mockBatch = (id?: string) => {
    mockFind(id);
    mockCreate(id, undefined, true);
    const writeBatch = { commit: jest.fn(), set: jest.fn() } as unknown as firestore.WriteBatch;
    jest.spyOn(firestore, 'writeBatch').mockReturnValue(writeBatch);
  };

  const mockUpdate = (id: string, data?: User) => {
    //WHEN
    mockFind(id, data);
    jest.spyOn(firestore, 'updateDoc').mockReturnValue(Promise.resolve());
  };

  it('should create and return unique entity id', () => {
    //GIVEN
    const id = commonUtils.generate();
    let collectionReference: CollectionReference<User> = { id } as unknown as CollectionReference<User>;
    const documentReference: DocumentReference<User> = { id } as unknown as DocumentReference<User>;

    //WHEN
    jest.spyOn(firestore, 'collection').mockReturnValue(collectionReference);
    jest.spyOn(firestore, 'doc').mockReturnValue(documentReference);
    const result = firestoreCrudRepository.createId();

    //THEN
    expect(result).toBeTruthy();
  });

  it('should throw an exception when creating a record with an existing id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockFind(id, { ...user, id });

    //THEN
    await expect(async () => {
      await firestoreCrudRepository.create({ ...user, id });
    }).rejects.toThrow(DuplicateRecordException);
  });

  it('should create and and save record with a generated id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockCreate(id, undefined, true);
    const result: User = await firestoreCrudRepository.create(user);

    //THEN
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    expect(result.name).toBe(user.name);
  });

  it('should create and and save record with a given id', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockCreate(id, undefined, true);
    const result: User = await firestoreCrudRepository.create({ ...user, id });

    //THEN
    expect(result).toBeTruthy();
    expect(result.id).toBe(id);
    expect(result.name).toBe(user.name);
  });

  it('should find and return an empty record by id when record is not found', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockFind(id);

    const found: Optional<User> = await firestoreCrudRepository.findById(id);

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });


  it('should find and return a record by id when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockFind(id, { ...user, id });
    const optional: Optional<User> = await firestoreCrudRepository.findById(id);

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
    mockFind('id');
    const found: Optional<User> = await firestoreCrudRepository.findOneBy({ email });

    //THEN
    expect(found.isPresent()).toBeFalsy();
  });

  it('should find and return a record by field when it exists', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'johndoe@gmail.com';

    //WHEN
    mockFind('id', { ...user, id });
    const optional: Optional<User> = await firestoreCrudRepository.findOneBy({ email });

    //THEN
    expect(optional.isPresent()).toBeTruthy();
    const found = optional.get();
    expect(found.id).toBe(id);
    expect(found.email).toBe(email);
  });

  it('should find and return empty records when filter is empty', async () => {
    //WHEN
    mockFind('id');
    const found = await firestoreCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid records when filter is empty', async () => {
    //WHEN
    mockFind('id', [user]);
    const found = await firestoreCrudRepository.findAll();

    //THEN
    expect(found.length).toBe(1);
    expect(found[0].email).toBe(user.email);
  });

  it('should find and return empty records when filter is not empty', async () => {
    //GIVEN
    const email = 'email';

    //WHEN
    mockFind('id', []);
    const found = await firestoreCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(0);
  });

  it('should find and return valid records when filter is not empty and records are found', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const email = 'first@email.com';

    //WHEN
    mockFind('id', [{ ...user, id: commonUtils.generate(), email }, { ...user, id: commonUtils.generate(), email }]);
    const found = await firestoreCrudRepository.findAll({ email });

    //THEN
    expect(found.length).toBe(2);
    expect(found[0].email).toBe(email);
    expect(found[1].email).toBe(email);
  });

  it('should return empty array when creating multiple records with empty request', async () => {
    //WHEN
    const found = await firestoreCrudRepository.createAll([]);

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
      await firestoreCrudRepository.createAll([newUser, newUser]);
    }).rejects.toThrow(InvalidRequestException);
  });

  it('should return multiple results for multiple records creation without ids', async () => {
    //GIVEN
    const testUser: User = {
      deleted: false,
      dateCreated: Date.now(),
      name: 'John Doe',
      email: 'johndoe@gmail.com'
    };

    //WHEN
    mockBatch();

    const result = await firestoreCrudRepository.createAll([testUser, testUser]);

    //THEN
    expect(result).toBeTruthy();
    expect(result?.length).toBe(2);
    const ids = result?.map((r) => r.id);
    expect(ids).toBeTruthy();
    expect(ids?.length).toBe(2);
  });

  it('should return multiple results for multiple records creation with ids', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const newUser = { ...user, id };
    const users = [newUser, user];

    //WHEN
    mockBatch();
    const result = await firestoreCrudRepository.createAll(users);

    //THEN
    expect(result?.length).toBe(2);
    const ids = result?.map((r) => r.id);
    expect(ids?.length).toBe(2);
    expect(ids?.includes(id)).toBeTruthy();
  });

  it('should throw an exception when updating a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockFind(id);

    //THEN
    await expect(async () => {
      await firestoreCrudRepository.update(id, user);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should update record', async () => {
    //GIVEN
    const id = commonUtils.generate();
    const record = { ...user, id };
    const email = 'test';

    //WHEN
    mockUpdate(id, record);
    const result = await firestoreCrudRepository.update(id, { ...record, email });

    //THEN
    expect(result).toBe(true);
  });

  it('should throw an exception when deleting a record that does not exist', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockFind(id);

    //THEN
    await expect(async () => {
      await firestoreCrudRepository.remove(id);
    }).rejects.toThrow(RecordNotFoundException);
  });

  it('should soft-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockUpdate(id, { ...user, id });
    const result = await firestoreCrudRepository.remove(id);

    //THEN
    expect(result).toBeTruthy();
    expect(result).toBe(true);
  });

  it('should hard-delete record', async () => {
    //GIVEN
    const id = commonUtils.generate();

    //WHEN
    mockCreate(id, { ...user, id }, false);
    jest.spyOn(firestore, 'deleteDoc').mockReturnValue(Promise.resolve());

    const result = await firestoreCrudRepository.remove(id, { deletionOptions: { softDelete: false } });

    //THEN
    expect(result).toBeTruthy();
    expect(result).toBe(true);
  });
});
