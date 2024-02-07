const isNoneEmpty = (...args: any[]): boolean => {
  if (!args || args.length === 0) {
    return false;
  }

  for (const arg of args) {
    if (isEmpty(arg)) {
      return false;
    }
  }

  return true;
};

const isAnyEmpty = (...args: any[]): boolean => {
  if (!args || args.length === 0) {
    return true;
  }
  for (const arg of args) {
    if (isEmpty(arg)) {
      return true;
    }
  }

  return false;
};

const isAnyTextual = (...args: any[]): boolean => {
  if (!args) {
    return true;
  }
  const numberRegularExpression = /^[0-9]+$/;
  for (const arg of args) {
    if (
      arg === undefined ||
      arg === null ||
      !numberRegularExpression.test(arg)
    ) {
      return true;
    }
  }

  return false;
};

const isNumeric = (input: any): boolean => {
  return !isNaN(parseFloat(input)) && isFinite(input);
};

const firstNonNull = (...args: any[]): any | null => {
  for (const arg of args) {
    if (isNoneEmpty(arg)) {
      return arg;
    }
  }

  return null;
};

const stringOrEmpty = (value?: string): string => {
  if (value && isNoneEmpty(value)) {
    return value;
  }
  return '';
};

const generate = (): string => {
  let sysTime = new Date().getTime();
  let perfTime =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let random = Math.random() * 16;
    if (sysTime > 0) {
      random = (sysTime + random) % 16 | 0;
      sysTime = Math.floor(sysTime / 16);
    } else {
      random = (perfTime + random) % 16 | 0;
      perfTime = Math.floor(perfTime / 16);
    }
    return (c == 'x' ? random : (random & 0x7) | 0x8).toString(16);
  });
};

const generateNumber = (): number => {
  return Math.floor(100000000 + Math.random() * 900000000);
};

const generateBase64 = (data: string): string => {
  return new Buffer(data).toString('base64');
};

const limit = (arg: string, limit: number = 40): string => {
  if (isAnyEmpty(arg)) {
    return 'Anonymous';
  }
  if (arg.length <= limit) {
    return arg;
  }

  return arg.substring(0, limit - 3).concat('...');
};

const millisecondsToMinutes = (milliseconds: number): number => {
  return milliseconds / 60000;
};

const isTimeElapsed = (timeAgoInMinutes: number, time: number): boolean => {
  const timeAgoInSeconds = new Date(time).getTime();
  const currentTimeInSeconds = new Date().getTime();

  const diff = Math.abs(currentTimeInSeconds - timeAgoInSeconds);
  const minutes = Math.floor(diff / 1000 / 60);

  return minutes >= timeAgoInMinutes;
};

const isInThePastOrToday = (timestamp: number): boolean => {
  return (
    new Date(timestamp).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0)
  );
};

const isInThePast = (timestamp: number): boolean => {
  return (
    new Date(timestamp).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)
  );
};

const addDaysToTimestamp = (timestamp: number, days: number): number => {
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).getTime();
};

const createPaddedHex = (id?: number): string => {
  return (id || Date.now() + generateNumber()).toString().padStart(64, '0');
};

const ipfsToUrl = (rawUrl: string): string => {
  if (!rawUrl.startsWith('ipfs://')) {
    return rawUrl;
  }
  return rawUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
};

const isEmpty = (arg: any): boolean => {
  if (arg === undefined || arg === null) {
    return true;
  }
  if (typeof arg === 'number') {
    return isNaN(arg) || arg === 0;
  }
  if (typeof arg === 'string' && !arg.includes('{') && !arg.includes('}')) {
    return arg.trim().length === 0;
  }
  if (Array.isArray(arg)) {
    return arg.length === 0;
  }
  if (typeof arg === 'object' || Object.keys(JSON.parse(arg)).length === 0) {
    return Object.keys(arg).length === 0;
  }
  return false;
};

const capitalize = (arg: string): string => {
  if (isEmpty(arg)) {
    return '';
  }
  return arg.charAt(0).toUpperCase() + arg.slice(1).toLowerCase();
};

const dateTimeFormat = (time: number | Date): string => {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds();

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const mapErrorMessage = (error: any): string => {
  if (error) {
    if (error.response && error.response.data && error.response.data.message) {
      return error.response.data.message;
    }
    if (error.response && error.response.data) {
      return error.response.data;
    }
  }

  return 'An error occurred';
};

const secondsBetweenDates = (dateA: Date, dateB: Date): number => {
  return Math.abs(dateA.getTime() - dateB.getTime()) / 1000;
};

const secondsFromToday = (date: Date | number): number => {
  return Math.abs(new Date().getTime() - new Date(date).getTime()) / 1000;
};

const sanitize = (input: string): string => {
  return input.replace(/['";\(\)]/g, '').trim();
};

const isSafe = (input: any): boolean => {
  const dangerousPatterns: RegExp[] = [
    /\$where/i,
    /\$regex/i,
    /\$options/i,
    /\$eq/i,
    /\$gt/i,
    /\$gte/i,
    /\$lt/i,
    /\$lte/i,
    /\$ne/i,
    /\$nin/i,
    /\$or/i,
    /\$and/i,
    /\$not/i,
    /\$nor/i,
    /\$in/i,
    /\$all/i,
    /\$size/i,
    /\$type/i,
    /\$elemMatch/i,
    /\$exists/i,
    /\$mod/i,
    /\$where/i,
    /\$geoNear/i,
    /\$near/i,
    /\$nearSphere/i,
    /<script>/i,
    /['";\(\)]/i
  ];

  if (typeof input === 'string') {
    return !dangerousPatterns.some((pattern) => input.match(pattern));
  }
  if (Array.isArray(input)) {
    return input.every((item) => {
      if (typeof item === 'string') {
        return !dangerousPatterns.some((pattern) => item.match(pattern));
      }
      return true;
    });
  }
  if (typeof input === 'object') {
    return Object.keys(input).every((key) => {
      if (typeof input[key] === 'string') {
        return !dangerousPatterns.some((pattern) => input[key].match(pattern));
      }
      return true;
    });
  }
  return !input.match(/['";\(\)]/);
};

export {
  isEmpty,
  isNoneEmpty,
  isAnyEmpty,
  isAnyTextual,
  isNumeric,
  firstNonNull,
  stringOrEmpty,
  generate,
  generateNumber,
  generateBase64,
  limit,
  millisecondsToMinutes,
  isTimeElapsed,
  isInThePastOrToday,
  isInThePast,
  addDaysToTimestamp,
  createPaddedHex,
  ipfsToUrl,
  capitalize,
  dateTimeFormat,
  mapErrorMessage,
  secondsBetweenDates,
  secondsFromToday,
  sanitize,
  isSafe
};
