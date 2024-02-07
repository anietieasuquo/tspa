import { Objects } from '@src/main';

class Optional<T> {
  private static readonly EMPTY: Optional<any> = new Optional<any>(null);
  private readonly value: T | null;

  constructor(value: T | null) {
    this.value = value;
  }

  public static of<T>(value: T): Optional<T> {
    Objects.requireNonNull(value, 'Value cannot be null');
    return new Optional(value);
  }

  public static ofNullable<T>(value: T | null | undefined): Optional<T> {
    return value === undefined || value == null
      ? (this.EMPTY as Optional<T>)
      : new Optional<T>(value);
  }

  public static empty<T>(): Optional<T> {
    return this.EMPTY as Optional<T>;
  }

  public isPresent(): boolean {
    return this.value !== null && this.value !== undefined;
  }

  public get(): T {
    Objects.requireNonNull(this.value, 'Value is not present');
    return this.value!;
  }

  public isEmpty(): boolean {
    return !this.isPresent();
  }

  public ifPresentOrElse(
    consumer: (value: T) => void,
    action: () => void
  ): void {
    if (this.isPresent()) {
      consumer(this.value!);
    } else {
      action();
    }
  }

  public filter(predicate: (value: T) => boolean): Optional<T> {
    Objects.requireNonNull(predicate, 'Predicate cannot be null');
    if (!this.isPresent()) {
      return this;
    }
    return predicate(this.value!) ? this : Optional.empty();
  }

  public map<U>(mapper: (value: T) => U): Optional<U> {
    Objects.requireNonNull(mapper, 'Mapper cannot be null');
    if (!this.isPresent()) {
      return Optional.empty();
    }
    return Optional.ofNullable(mapper(this.value!));
  }

  public flatMap<U>(mapper: (value: T) => Optional<U>): Optional<U> {
    Objects.requireNonNull(mapper, 'Mapper cannot be null');
    if (!this.isPresent()) {
      return Optional.empty();
    }
    const result: Optional<U> = mapper(this.value!);
    Objects.requireTrue(result.isPresent(), 'Mapper result cannot be null');
    return result;
  }

  public ifPresentThrow<E extends Error>(error: E): void {
    if (this.isPresent()) {
      throw error;
    }
  }

  public orElseThrow<E extends Error>(error: E): T {
    if (!this.isPresent()) {
      throw error;
    }
    return this.value!;
  }

  public orElseThrowErrorWithMessage(message: string, ...args: any[]): T {
    if (!this.isPresent()) {
      throw new Error(message + args);
    }
    return this.value!;
  }

  public orElseGet(supplier: () => T): T {
    return this.isPresent() ? this.value! : supplier();
  }

  public orElse(defaultValue: T): T {
    return this.isPresent() ? this.value! : defaultValue;
  }

  public or(supplier: <T>() => Optional<T>): Optional<T> {
    Objects.requireNonNull(supplier, 'Supplier cannot be null');
    if (this.isPresent()) {
      return this;
    } else {
      const result: Optional<T> = supplier();
      Objects.requireTrue(result.isPresent(), 'Supplier result cannot be null');
      return result;
    }
  }

  public ifPresent(consumer: (value: T) => void): void {
    if (this.isPresent()) {
      consumer(this.value!);
    }
  }

  public ifEmpty(action: () => void): void {
    if (this.isEmpty()) {
      action();
    }
  }

  public equals(other: Optional<T>): boolean {
    if (this === other) {
      return true;
    }
    if (!other) {
      return false;
    }
    return this.value === other.value;
  }
}

export { Optional };
