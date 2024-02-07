class OptimisticLockException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockException';
    Object.setPrototypeOf(this, OptimisticLockException.prototype);
  }
}

export { OptimisticLockException };
