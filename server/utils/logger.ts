/**
 * Logger Utility
 * 
 * Provides logging functionality with different log levels
 * and formats for different environments.
 */

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Format the log message with timestamp and level
 */
function formatLog(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data !== undefined) {
    if (data instanceof Error) {
      formattedMessage += `\n${data.stack || data.message}`;
    } else if (typeof data === 'object') {
      try {
        formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
      } catch (e) {
        formattedMessage += `\n[Object cannot be stringified]`;
      }
    } else {
      formattedMessage += `\n${data}`;
    }
  }
  
  return formattedMessage;
}

/**
 * Colorize the log message based on level
 */
function colorizeLog(level: LogLevel, message: string): string {
  switch (level) {
    case 'debug':
      return `${colors.blue}${message}${colors.reset}`;
    case 'info':
      return `${colors.green}${message}${colors.reset}`;
    case 'warn':
      return `${colors.yellow}${message}${colors.reset}`;
    case 'error':
      return `${colors.red}${message}${colors.reset}`;
    default:
      return message;
  }
}

/**
 * Logger implementation
 */
export const logger = {
  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    if (isProduction) return; // Skip debug logs in production
    
    const formattedMessage = formatLog('debug', message, data);
    console.log(colorizeLog('debug', formattedMessage));
  },
  
  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    const formattedMessage = formatLog('info', message, data);
    console.log(colorizeLog('info', formattedMessage));
  },
  
  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    const formattedMessage = formatLog('warn', message, data);
    console.warn(colorizeLog('warn', formattedMessage));
  },
  
  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    const formattedMessage = formatLog('error', message, data);
    console.error(colorizeLog('error', formattedMessage));
  },
};
