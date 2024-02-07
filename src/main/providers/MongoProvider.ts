import mongoose, { ConnectOptions } from 'mongoose';
import { createDefaultInternalLogger } from '@main/utils/logger-utils';
import { InternalServerException } from '@main/exceptions/InternalServerException';
import { Logger } from '@src/main';

const logger: Logger = createDefaultInternalLogger();

class MongoProvider {
  private constructor() {}

  public static async connect(
    uri: string,
    options: ConnectOptions
  ): Promise<MongoProvider | undefined> {
    if (mongoose.connection.readyState !== 0) {
      logger.info('MongoCrudRepository already connected to mongodb');
      return undefined;
    }

    logger.info('MongoCrudRepository connecting to mongodb', { uri, options });
    mongoose.set('strict', false);

    await mongoose.connect(uri, options);

    const isConnected = mongoose.connection.readyState.valueOf() === 1;
    logger.debug(
      `Is MongoCrudRepository connected to mongodb?: ${isConnected}`
    );
    if (!isConnected) {
      throw new InternalServerException(
        'MongoCrudRepository failed to connect to mongodb'
      );
    }
    this.registerMongooseListeners();
  }

  private static registerMongooseListeners(): void {
    mongoose.connection.removeAllListeners();

    mongoose.connection.on('connected', () => {
      logger.info('MongoCrudRepository connected to mongodb');
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('MongoCrudRepository disconnected from mongodb');
    });

    mongoose.connection.on('close', () => {
      logger.info('MongoCrudRepository connection to mongodb closed');
    });

    mongoose.connection.on('open', () => {
      logger.info('MongoCrudRepository connection to mongodb opened');
    });

    mongoose.connection.on('close', () => {
      logger.info('MongoCrudRepository connection to mongodb closed');
    });

    mongoose.connection.on('open', () => {
      logger.info('MongoCrudRepository connection to mongodb opened');
    });

    mongoose.connection.on('error', (error) => {
      throw new InternalServerException(
        `MongoCrudRepository connection error: ${error}`
      );
    });
  }
}

export { MongoProvider };
