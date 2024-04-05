import callSite from 'callsite';
import { Logger } from '@main/types/core';
import { LogLevel } from '@main/utils/LogLevel';
import { dateTimeFormat } from '@main/utils/common-utils';
import { CallerProperties, LoggerConfig } from '@main/types/utils';

const APPLICATION_LOG_LEVEL = process.env.TSPA_LOG_LEVEL ?? 'info';
const INTERNAL_LOG_LEVEL = process.env.TSPA_INTERNAL_LOG_LEVEL ?? 'debug';
const APP_NAME = process.env.TSPA_APP_NAME ?? 'app';
const appName = 'TSPA';

const createDefaultInternalLogger = (): Logger => {
  const config: LoggerConfig = {
    logLevel: LogLevel.fromString(INTERNAL_LOG_LEVEL).name,
    appName
  };
  console.log(`Configuring internal logger with: ${JSON.stringify(config)}`);
  return new DefaultLogger(config);
};

const getCaller = (showStack: boolean = false): string => {
  let props: CallerProperties[];
  const getStack = (stack: any) => {
    const path = stack.getFileName();
    const line = stack.getLineNumber();
    const column = stack.getColumnNumber();
    const method = stack.getMethodName() ?? 'anonymous';

    return {
      path,
      method,
      line,
      column
    };
  };

  if (showStack) {
    props = callSite().map((site: any) => getStack(site));
  } else {
    props = [getStack(callSite()[2])];
  }

  return `\nat: ${JSON.stringify(props)}`;
};

class DefaultLogger implements Logger {
  public constructor(
    private readonly loggerConfig: LoggerConfig = {
      logLevel: LogLevel.fromString(APPLICATION_LOG_LEVEL).name,
      appName: APP_NAME
    }
  ) {
    console.log(`Configuring logger with: ${JSON.stringify(loggerConfig)}`);
  }

  public debug(message: any, options?: any): void {
    if (this.shouldSkipLog(LogLevel.DEBUG)) {
      return;
    }
    console.debug(this.createLogMessage(message), options || '', getCaller());
  }

  public error(message: any, options?: any): void {
    if (this.shouldSkipLog(LogLevel.ERROR)) {
      return;
    }
    console.error(
      this.createLogMessage(message),
      options || '',
      getCaller(true)
    );
  }

  public info(message: any, options?: any): void {
    if (this.shouldSkipLog(LogLevel.INFO)) {
      return;
    }
    console.info(this.createLogMessage(message), options || '', getCaller());
  }

  public trace(message: any, options?: any): void {
    if (this.shouldSkipLog(LogLevel.TRACE)) {
      return;
    }
    console.trace(this.createLogMessage(message), options || '', getCaller());
  }

  public warn(message: any, options?: any): void {
    if (this.shouldSkipLog(LogLevel.WARN)) {
      return;
    }
    console.warn(this.createLogMessage(message), options || '', getCaller());
  }

  private createLogMessage(message: any): string {
    return `[${dateTimeFormat(new Date())}][${this.loggerConfig.appName}]: ${message}`;
  }

  private shouldSkipLog(level: LogLevel): boolean {
    return !LogLevel.fromString(this.loggerConfig.logLevel).canLog(level);
  }
}

const logger: Logger = new DefaultLogger();
export { logger, createDefaultInternalLogger };
