import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { FirestoreConnectionProperties, Logger } from '@main/types/core';
import { isAnyEmpty } from '@main/utils/common-utils';
import { InternalServerException } from '@main/exceptions/InternalServerException';
import { createDefaultInternalLogger } from '@main/utils/logger-utils';

const ENVIRONMENT =
  process.env.TSPA_ENVIRONMENT === 'dev' ? 'tspa-dev' : 'tspa';
const logger: Logger = createDefaultInternalLogger();

class FirestoreProvider {
  private static instance?: FirestoreProvider;
  public firestore: Firestore;
  public auth: Auth;

  private constructor(
    firebaseConnectionProperties: FirestoreConnectionProperties
  ) {
    const { apiKey, authDomain, projectId } = firebaseConnectionProperties;
    if (isAnyEmpty(apiKey, authDomain, projectId)) {
      throw new InternalServerException(
        'Firebase credentials not set for provider'
      );
    }

    const app = initializeApp({ apiKey, authDomain, projectId });
    this.firestore = getFirestore(app);
    this.auth = getAuth(app);

    if (ENVIRONMENT === 'tspa-dev') {
      logger.debug('Connecting to Firestore emulator at localhost:8095');
      connectFirestoreEmulator(this.firestore, 'localhost', 8095);
    }

    if (
      !this.firestore ||
      !this.firestore.app ||
      !this.auth ||
      !this.auth.app
    ) {
      throw new InternalServerException(
        'Failed to initialize Firestore provider'
      );
    }
  }

  public static getInstance(
    firebaseConnectionProperties: FirestoreConnectionProperties
  ): FirestoreProvider {
    return (
      this.instance || (this.instance = new this(firebaseConnectionProperties))
    );
  }
}

export { FirestoreProvider };
