import * as commonUtils from '@main/utils/common-utils';
import { Nullable } from '@main/types/core';

class Objects {
  public static requireNonNull<T, E extends Error>(
    args: Nullable<T>,
    error: string | E
  ): asserts args is NonNullable<T>;

  public static requireNonNull<T, E extends Error>(
    args: Nullable<T>[],
    error: string | E
  ): asserts args is NonNullable<T>[];

  public static requireNonNull<T, E extends Error>(
    args: Nullable<T>[] | Nullable<T>,
    error: string | E
  ): asserts args is NonNullable<T>[] | NonNullable<T> {
    if (Array.isArray(args)) {
      if (args.some((arg) => arg === null || arg === undefined)) {
        this.throwError(error);
      }
      return;
    }

    if (args === null || args === undefined) {
      this.throwError(error);
    }
  }

  public static requireNonEmpty<T, E extends Error>(
    args: Nullable<T>,
    error: string | E
  ): asserts args is NonNullable<T>;

  public static requireNonEmpty<T, E extends Error>(
    args: Nullable<T>[],
    error: string | E
  ): asserts args is NonNullable<T>[];

  public static requireNonEmpty<T, E extends Error>(
    args: Nullable<T>[] | Nullable<T>,
    error: string | E
  ): asserts args is NonNullable<T>[] | NonNullable<T> {
    this.requireNonNull(args, error);
    if (Array.isArray(args)) {
      if (args.length === 0 || commonUtils.isAnyEmpty(...args)) {
        this.throwError(error);
      }
      return;
    }

    if (commonUtils.isEmpty(args)) {
      this.throwError(error);
    }
  }

  public static requireTrue<E extends Error>(
    args: Nullable<boolean>,
    error: string | E
  ): asserts args is true;

  public static requireTrue<E extends Error>(
    args: Nullable<boolean>[],
    error: string | E
  ): asserts args is true[];

  public static requireTrue<E extends Error>(
    args: Nullable<boolean>[] | Nullable<boolean>,
    error: string | E
  ): asserts args is true[] | true {
    this.requireNonNull(args, error);
    if (Array.isArray(args)) {
      if (args.some((arg) => !arg)) {
        this.throwError(error);
      }
      return;
    }
    if (!args) {
      this.throwError(error);
    }
  }

  private static throwError(error: string | Error): void {
    if (typeof error === 'string') {
      throw new Error(error);
    }
    throw error;
  }
}

export { Objects };
