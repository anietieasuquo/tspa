import { EntityWithAdditionalId } from '../../main/types/core';

export interface User extends EntityWithAdditionalId {
  name: string;
  email: string;
}
