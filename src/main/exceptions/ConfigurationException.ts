class ConfigurationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationException';
    Object.setPrototypeOf(this, ConfigurationException.prototype);
  }
}

export { ConfigurationException };
