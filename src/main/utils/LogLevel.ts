import { LogLevelName } from '@main/types/core';

class LogLevel {
  public static readonly NONE: LogLevel = new LogLevel('none', 0);
  public static readonly ERROR: LogLevel = new LogLevel('error', 1);
  public static readonly WARN: LogLevel = new LogLevel('warn', 2);
  public static readonly INFO: LogLevel = new LogLevel('info', 3);
  public static readonly DEBUG: LogLevel = new LogLevel('debug', 4);
  public static readonly TRACE: LogLevel = new LogLevel('trace', 5);
  public constructor(
    public readonly name: LogLevelName,
    public readonly value: number
  ) {}

  public static fromString(name: string): LogLevel {
    switch (name) {
      case LogLevel.NONE.name:
        return LogLevel.NONE;
      case LogLevel.ERROR.name:
        return LogLevel.ERROR;
      case LogLevel.WARN.name:
        return LogLevel.WARN;
      case LogLevel.INFO.name:
        return LogLevel.INFO;
      case LogLevel.DEBUG.name:
        return LogLevel.DEBUG;
      case LogLevel.TRACE.name:
        return LogLevel.TRACE;
      default:
        throw new Error(`Unknown log level: ${name}`);
    }
  }

  public canLog(level: LogLevel): boolean {
    return this.value >= level.value;
  }

  public toString(): string {
    return this.name;
  }
}

export { LogLevel };
