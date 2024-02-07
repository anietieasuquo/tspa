class DuplicateRecordException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRecordException';
    Object.setPrototypeOf(this, DuplicateRecordException.prototype);
  }
}

export { DuplicateRecordException };
