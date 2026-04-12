import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: label => ({ level: label }),
  },
  base: {
    service: 'opencode-memory-plugin',
    version: '2.9.1',
  },
});

export const logInfo = (component, message, meta = {}) => {
  logger.info({ component, ...meta }, message);
};

export const logWarn = (component, message, meta = {}) => {
  logger.warn({ component, ...meta }, message);
};

export const logError = (component, message, error, meta = {}) => {
  logger.error(
    {
      component,
      error: error?.message || error,
      stack: error?.stack,
      ...meta,
    },
    message
  );
};

export const logDebug = (component, message, meta = {}) => {
  logger.debug({ component, ...meta }, message);
};

export { logger };
export default logger;
