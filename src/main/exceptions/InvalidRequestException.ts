class InvalidRequestException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestException';
    Object.setPrototypeOf(this, InvalidRequestException.prototype);
  }
}

export { InvalidRequestException };
