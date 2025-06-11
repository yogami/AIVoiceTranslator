import winston from 'winston';

// Determine log level based on environment variables
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const logger = winston.createLogger({
  level: level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log stack traces
    winston.format.splat(),
    winston.format.json() // Default to JSON format for structured logging
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let logMessage = `${timestamp} [${level}]: ${message}`;
          if (meta && Object.keys(meta).length && !(meta.stack && Object.keys(meta).length === 1)) {
            // Append metadata if it exists and is not just the error stack (which is handled by printf)
             logMessage += ` ${JSON.stringify(meta)}`;
          }
          return logMessage;
        })
      )
    })
  ],
  exceptionHandlers: [ // Optional: Handle uncaught exceptions
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} [${level}]: ${message} - ${stack}`;
        })
      )
    })
  ],
  exitOnError: false // Do not exit on handled exceptions
});

// Optionally, add a file transport for production or persistent logging
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.json() // Keep file logs in JSON for easier parsing
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.json()
  }));
}

export default logger;
