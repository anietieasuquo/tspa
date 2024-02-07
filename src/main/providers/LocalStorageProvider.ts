import { LocalStorage } from 'node-localstorage';

class LocalStorageProvider {
  private static instance?: LocalStorageProvider;
  public storage: LocalStorage | Storage;

  private constructor(private readonly path: string) {
    this.storage =
      typeof localStorage === 'undefined' || localStorage === null
        ? new LocalStorage(path)
        : localStorage;
  }

  public static getInstance(path: string): LocalStorageProvider {
    return this.instance || (this.instance = new this(path));
  }
}

export { LocalStorageProvider };
