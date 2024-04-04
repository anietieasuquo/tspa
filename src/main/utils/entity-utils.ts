import { Entity, EntityMap, SortOrder } from '@main/types/core';
import * as commonUtils from '@main/utils/common-utils';
import { InvalidRequestException } from '@main/exceptions/InvalidRequestException';
import { Objects } from '@src/main';

const sort = <T extends Entity>(
  list: T[],
  order: SortOrder = SortOrder.DESC
): T[] => {
  return list.sort((a: T, b: T): number => {
    if (a.dateCreated && b.dateCreated) {
      if (a.dateCreated > b.dateCreated) {
        return order === SortOrder.DESC ? -1 : 1;
      } else if (a.dateCreated < b.dateCreated) {
        return order === SortOrder.DESC ? 1 : -1;
      }
    }
    return 0;
  });
};

const unique = <T extends Entity>(list: T[], keys?: (keyof T)[]): T[] => {
  if (list.length === 0) {
    return list;
  }
  const _keys: (keyof T)[] = keys ?? ['id'];
  const map: { [key: string]: T } = {};
  const getKey = (key: keyof T, item: T): any => {
    if (item[key]) {
      return item[key];
    }
    return commonUtils.generate();
  };

  list.forEach((item: T) => {
    const key = _keys.map((k: keyof T) => getKey(k, item)).join('-');
    map[key] = item;
  });
  return Object.values(map);
};

const addToMap = <T extends Entity>(
  map: EntityMap<T>,
  item: T,
  key: string,
  sortOrder: SortOrder = SortOrder.DESC
): EntityMap<T> => {
  const _map: EntityMap<T> = map ?? {};
  const list: T[] = _map[key] ?? [];
  const index = list.findIndex((i: T) => i.id === item.id);
  if (index !== -1) {
    list.splice(index, 1);
  }
  _map[key] = sort<T>([...list, item], sortOrder);
  return _map;
};

const combineMap = <T extends Entity>(
  base: EntityMap<T>,
  second: T[],
  key: string,
  sortOrder: SortOrder = SortOrder.DESC
): EntityMap<T> => {
  const _map: EntityMap<T> = base ?? {};
  second.forEach((item: T) => {
    const _list: T[] = _map[key] ?? [];
    const index = _list.findIndex((i: T) => i.id === item.id);
    if (index !== -1) {
      _list.splice(index, 1);
    }
    _map[key] = sort<T>([..._list, item], sortOrder);
  });
  return _map;
};

const addToListUniqueSorted = <T extends Entity>(
  list: T[],
  item: T,
  sortOrder: SortOrder = SortOrder.DESC
): T[] => {
  const index = list.findIndex((i: T) => i.id === item.id);
  if (index !== -1) {
    list.splice(index, 1);
  }
  return sort<T>([...list, item], sortOrder);
};

const updateListItem = <T extends Entity>(
  list: T[],
  item: Partial<T>,
  sortOrder: SortOrder = SortOrder.DESC
): T[] => {
  const index = list.findIndex((i: T) => i.id === item.id);
  if (index !== -1) {
    list.splice(index, 1, { ...list[index], ...item });
  }
  return sort<T>([...list], sortOrder);
};

const checkForDuplicates = <T extends Entity>(
  payload: T[],
  keys?: (keyof T)[]
): void => {
  const uniquePayload = unique<T>(payload, keys);
  Objects.requireTrue(
    uniquePayload.length === payload.length,
    new InvalidRequestException('Duplicate records found in payload')
  );
};

const markAsDeleted = <T extends Entity>(payload: Partial<T>): void => {
  payload.deleted = true;
  payload.dateDeleted = Date.now();
};

const getNextVersion = (version?: number): number => {
  return version === undefined ? 1 : version + 1;
};

const updatePayload = <T extends Entity>(payload: Partial<T>): void => {
  payload.version = getNextVersion(payload.version);
  payload.dateCreated = commonUtils.isAnyEmpty(payload.dateCreated)
    ? Date.now()
    : payload.dateCreated;
  payload.dateUpdated = Date.now();
  payload.deleted = payload.deleted ?? false;
};

export {
  sort,
  unique,
  addToMap,
  combineMap,
  addToListUniqueSorted,
  updateListItem,
  checkForDuplicates,
  updatePayload,
  markAsDeleted
};
