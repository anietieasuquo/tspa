import mongoose, { Model, model, Schema } from 'mongoose';
import { Entity, Logger, MongoSchemaBody } from '@main/types/core';
import { createDefaultInternalLogger } from '@main/utils/logger-utils';
import { capitalize } from '@main/utils/common-utils';

const logger: Logger = createDefaultInternalLogger();

const createEntitySchemaBody = <T extends Entity>(
  entity: Partial<T>
): MongoSchemaBody<T> => {
  const schema: MongoSchemaBody<T> = {} as MongoSchemaBody<T>;
  Object.keys(entity).forEach((key) => {
    // @ts-ignore
    schema[key] = {
      type: capitalize(typeof entity[key]),
      required: entity[key] !== undefined
    };
  });
  return schema;
};

const createEntitySchema = <T extends Entity>(
  entity: Partial<T>
): Schema<T> => {
  const schemaBody: MongoSchemaBody<T> = createEntitySchemaBody<T>(entity);
  logger.debug(
    `Creating schema for entity: ${JSON.stringify(entity)} =>`,
    schemaBody
  );
  return new Schema<T>(schemaBody, { _id: false, strict: false });
};

const createModel = <T extends Entity>(
  entity: Partial<T>,
  collectionName: string
): Model<T> => {
  logger.debug(`Creating model for collection: ${collectionName} =>`, entity);
  return model<T>(collectionName, createEntitySchema<T>(entity));
};

const createOrGetEntityModel = <T extends Entity>(
  entity: Partial<T>,
  collectionName: string
): Model<T> => {
  const entityModel = mongoose.models[collectionName] as Model<T> | undefined;
  if (entityModel) {
    logger.debug(
      `Existing model for collection: ${collectionName}, entity: ${JSON.stringify(entity)}, model =>`,
      entityModel.schema.obj
    );
    return entityModel;
  }

  const newModel = createModel<T>(entity, collectionName);
  logger.debug(
    `New model for collection: ${collectionName} created =>`,
    newModel
  );
  return newModel;
};

export { createOrGetEntityModel };
