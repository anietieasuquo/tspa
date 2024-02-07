import { LogLevelName } from '@main/types/core';

export interface CallerProperties {
  path: string;
  line: string;
  column: string;
  method: string;
}

export interface LoggerConfig {
  logLevel: LogLevelName;
  appName: string;
}
