class RecordNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordNotFoundException';
    Object.setPrototypeOf(this, RecordNotFoundException.prototype);
  }
}

export { RecordNotFoundException };
