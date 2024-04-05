# TypeScript Persistence API (TSPA)

<p>
  <a href="https://www.npmjs.com/package/tspa" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/tspa.svg">
  </a>
  <a href="https://github.com/anietieasuquo/tspa#readme" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="https://github.com/anietieasuquo/tspa/graphs/commit-activity" target="_blank">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
  </a>
  <a href="https://github.com/anietieasuquo/tspa/blob/master/LICENSE" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
  <a href="https://twitter.com/anietieasuquo" target="_blank">
    <img alt="Twitter: anietieasuquo" src="https://img.shields.io/twitter/follow/anietieasuquo.svg?style=social" />
  </a>
</p>

<p>
TypeScript Persistence API (TSPA) is a TypeScript library providing a flexible and easy-to-use Persistence API, allowing developers to perform CRUD operations in various data storage systems including LocalStorage, Firestore, and MongoDB (more storage systems to be supported). The library simplifies data management tasks by abstracting away the underlying storage implementation details and providing a unified interface.
</p>

## Install

```sh
yarn install tspa
```

## MongoCrudRepository

MongoCrudRepository is an implementation of the `TransactionalCrudRepository` interface tailored for MongoDB. It offers
seamless
integration with MongoDB databases, allowing you to perform CRUD operations on your MongoDB collections effortlessly, as
well as run transactional operations.

### Features

- **CRUD Operations**: Perform Create, Read, Update, and Delete operations on MongoDB collections.
- **Query Options**: Customize your queries with query options to control aspects like sorting, limiting, and skipping
  results.
- **Transactional Support**: Integrates with `TransactionalCrudRepository`, allowing transactional operations for
  MongoDB transactions.

### Usage

```dotenv
# .env

TSPA_APP_NAME=your-app-name
TSPA_MONGO_URI=your-mongo-uri #mongodb://localhost:27017/<your app name>?authSource=admin&replicaSet=<your app replica set name>
TSPA_LOG_LEVEL=info #none, error, warn, info, trace, debug
TSPA_INTERNAL_LOG_LEVEL=none #none, error, warn, info, trace, debug
```

```ts
import { Entity, MongoCrudRepository, TransactionalCrudRepository } from 'tspa';

interface User extends Entity {
  name: string;
  email: string;
}

// Below is the user object to tell mongoDB how to store the data. This object is not actually stored, rather a schema is created based on the object fields.
const user: User = {
  id: '1',
  name: 'John Doe',
  email: 'johndoe@email.com'
}

const userRepository: TransactionalCrudRepository<User> = MongoCrudRepository.initFor<User>('users', {
  entities: [{ user }],
  uri: TSPA_MONGO_URI,
  appName: TSPA_APP_NAME
});

//OR

MongoCrudRepository.init<User>({ entities: [{ user }], uri: TSPA_MONGO_URI, appName: TSPA_APP_NAME });
const userRepository: TransactionalCrudRepository<User> = MongoCrudRepository.for<User>('users');

const createdUser: User = userRepository.create(user);
```

## FirestoreCrudRepository

FirestoreCrudRepository is an implementation of the `CrudRepository` interface tailored for Firestore. It offers
seamless
integration with Firestore storage.

### Features

- **CRUD Operations**: Perform Create, Read, Update, and Delete operations on Firestore collections.
- **Query Options**: Customize your queries with query options to control aspects like sorting, limiting, and skipping
  results.
- **Real-time Updates**: Leverage Firestore's real-time updates for live data synchronization.

### Usage

```dotenv
# .env

TSPA_APP_NAME=your-app-name
TSPA_FIREBASE_API_KEY=your-api-key
TSPA_FIREBASE_AUTH_DOMAIN=your-auth-domain
TSPA_FIREBASE_PROJECT_ID=your-project-id
TSPA_LOG_LEVEL=info #none, error, warn, info, trace, debug
TSPA_INTERNAL_LOG_LEVEL=none #none, error, warn, info, trace, debug
```

```ts
import { Entity, FirestoreCrudRepository, CrudRepository } from 'tspa';

interface User extends Entity {
  name: string;
  email: string;
}

const user: User = {
  id: '1',
  name: 'John Doe',
  email: 'johndoe@email.com'
}

const userRepository: CrudRepository<User> = FirestoreCrudRepository.initFor<User>('users', {
  apiKey: 'apiKey',
  authDomain: 'authDomain',
  projectId: 'your-project-id',
  appName: 'your-app-name'
});

//OR

FirestoreCrudRepository.init<User>({
  apiKey: 'apiKey',
  authDomain: 'authDomain',
  projectId: 'your-project-id',
  appName: 'your-app-name'
});
const userRepository: CrudRepository<User> = FirestoreCrudRepository.for<User>('users');

const createdUser: User = userRepository.create(user);
```

## LocalStorageCrudRepository

`LocalStorageCrudRepository` is an implementation of the `CrudRepository` interface tailored for browsers and NodeJS
Local Storage, providing seamless integration for client-side and server-side data persistence.

### Features

- **CRUD Operations**: Perform Create, Read, Update, and Delete operations on browser and NodeJS Local Storage.
- **Query Options**: Limited query options are available for filtering data.
- **Client-Side Data Persistence**: Store data locally in the browser or NodeJS server, ensuring data availability even
  after page refresh or server restarts.

### Usage

```dotenv
# .env

TSPA_APP_NAME=your-app-name
TSPA_STORAGE_PATH=your-app-storage-path #where the data will be stored (default: './db' for NodeJS and 'localStorage' for browser)
TSPA_LOG_LEVEL=info #none, error, warn, info, trace, debug
TSPA_INTERNAL_LOG_LEVEL=none #none, error, warn, info, trace, debug
```

```ts
import { Entity, LocalStorageCrudRepository, CrudRepository } from 'tspa';

interface User extends Entity {
  name: string;
  email: string;
}

const user: User = {
  id: '1',
  name: 'John Doe',
  email: 'johndoe@email.com'
};

const userRepository: CrudRepository<User> = LocalStorageCrudRepository.initFor<User>('user', {
  appName: 'your-app-name',
  storagePath: './db' //where the data will be stored (default: './db' for NodeJS and 'localStorage' for browser)
});

//OR

LocalStorageCrudRepository.init<User>({
  appName: 'your-app-name',
  storagePath: './db' //where the data will be stored (default: './db' for NodeJS and 'localStorage' for browser)
});
const userRepository: CrudRepository<User> = LocalStorageCrudRepository.for<User>('users');

const createdUser: User = userRepository.create(user);
```

## API Reference

All repositories implement the `CrudRepository` which includes the following methods (except for `executeTransaction`
which is from `TransactionalCrudRepository` which at the moment is only supported by MongoDB):

- `findById(id: string, queryOptions?: QueryOptions<T>): Promise<Optional<T>>`: Find a document by its ID.
- `findOneBy(filter: Partial<T>, queryOptions?: QueryOptions<T>): Promise<Optional<T>>`: Find a single document matching
  the provided filter.
- `findAll(filter?: Partial<T>, queryOptions?: QueryOptions<T>): Promise<T[]>`: Find all documents optionally matching
  the provided filter.
- `create(payload: T, queryOptions?: QueryOptions<T>): Promise<T>`: Create a new document.
- `createAll(payload: T[], queryOptions?: QueryOptions<T>): Promise<T[]>`: Create multiple documents.
- `update(id: string, payload: Partial<T>, queryOptions?: QueryOptions<T>)`: Promise<boolean>: Update a document by ID.
- `remove(id: string, queryOptions?: QueryOptions<T>): Promise<boolean>`: Remove a document by ID.
- `createId()`: string: Generate a new unique ID.
- `executeTransaction<R>(execution: TransactionExecution<R>): Promise<R>`: Creates a transaction context to execute a
  set of transactional operations.

## TESTS

To run tests, ensure you have docker installed, and also you may have to update your `/etc/hosts` file with the following:

```sh
127.0.0.1 mongodb
```

Then run the following command:

```sh
yarn test
```

## Examples
- [Vending Machine](https://github.com/anietieasuquo/vending-machine): A simple vending machine backend application built with TSPA, NodeJS, Express, supporting OAuth2 authentication/authorization, and also transactional sessions with TSPA's `TransactionalCrudRepository` for MongoDB.


## Author

👤 **Anietie Asuquo <hello@anietieasuquo.com>**

* Website: https://anietieasuquo.com
* Twitter: [@anietieasuquo](https://twitter.com/anietieasuquo)
* Github: [@anietieasuquo](https://github.com/anietieasuquo)
* LinkedIn: [@anietieasuquo](https://linkedin.com/in/anietieasuquo)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to
check [issues page](https://github.com/anietieasuquo/tspa/issues). You can also take a look at
the [contributing guide](https://github.com/anietieasuquo/tspa/blob/master/CONTRIBUTING.md).

## 📝 License

Copyright © 2024 [Anietie Asuquo <hello@anietieasuquo.com>](https://github.com/anietieasuquo).<br />
This project is [MIT](https://github.com/anietieasuquo/tspa/blob/master/LICENSE) licensed.
