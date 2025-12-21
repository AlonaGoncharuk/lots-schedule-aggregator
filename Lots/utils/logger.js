const fs = require('fs');
const path = require('path');
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

// Try to use GCP Cloud Logging if available (skip in test mode)
let gcpLogging = null;
if (!IS_TEST) {
  try {
    // Check if we're in GCP environment or have credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT) {
      const { Logging } = require('@google-cloud/logging');
      const logging = new Logging();
      gcpLogging = logging.log('lots-schedule-aggregator');
      console.log('GCP Cloud Logging initialized');
    } else {
      console.log('GCP Cloud Logging not configured (no credentials), using file-based logging');
    }
  } catch (err) {
    // Module not installed or other error
    console.log('GCP Cloud Logging not available, using file-based logging:', err.message);
  }
}

// Require uuid (will work in both test and production)
let uuidv4;
try {
  uuidv4 = require('uuid').v4;
} catch (err) {
  // Fallback if uuid is not available
  uuidv4 = () => 'uuid-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

// File-based logging fallback
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_AGE_DAYS = 7;
const MAX_LOG_SIZE_MB = 10;

// Ensure logs directory exists (skip in test mode)
if (!IS_TEST && !fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

// Session storage for collecting logs per session
const sessionLogs = new Map();

// Log levels
const LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Format log entry
function formatLogEntry(level, sessionId, userId, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    sessionId: sessionId || 'unknown',
    userId: userId || 'unknown',
    message,
    ...metadata
  };
  
  return `[${timestamp}] [${level}] [${sessionId || 'unknown'}] [${userId || 'unknown'}] ${message}${metadata.stack ? '\n' + metadata.stack : ''}`;
}

// Write to file
function writeToFile(sessionId, logEntry) {
  // Skip file writing in test mode
  if (IS_TEST) return;
  
  const logFile = path.join(LOGS_DIR, `session-${sessionId}.log`);
  
  try {
    fs.appendFileSync(logFile, logEntry + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// Clean up old log files
function cleanupOldLogs() {
  // Skip cleanup in test mode
  if (IS_TEST) return;
  
  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAge = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      if (file.startsWith('session-') && file.endsWith('.log')) {
        const filePath = path.join(LOGS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtimeMs;
          
          // Remove files older than MAX_LOG_AGE_DAYS
          if (age > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`Removed old log file: ${file}`);
          }
          
          // Remove files larger than MAX_LOG_SIZE_MB
          const sizeMB = stats.size / (1024 * 1024);
          if (sizeMB > MAX_LOG_SIZE_MB) {
            fs.unlinkSync(filePath);
            console.log(`Removed large log file: ${file} (${sizeMB.toFixed(2)}MB)`);
          }
        } catch (err) {
          // Ignore errors for individual files
        }
      }
    });
  } catch (err) {
    console.error('Failed to cleanup log files:', err);
  }
}

// Log to GCP Cloud Logging
async function logToGCP(level, sessionId, userId, message, metadata = {}) {
  if (!gcpLogging) return false;
  
  try {
    const severityMap = {
      ERROR: 'error',
      WARN: 'warning',
      INFO: 'info',
      DEBUG: 'debug'
    };
    
    const entry = gcpLogging.entry(
      {
        severity: severityMap[level] || 'info',
        resource: { type: 'global' }
      },
      {
        sessionId,
        userId,
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    );
    
    await gcpLogging.write(entry);
    return true;
  } catch (err) {
    console.error('Failed to log to GCP:', err);
    return false;
  }
}

// Main logging function
function log(level, sessionId, userId, message, metadata = {}) {
  const logEntry = formatLogEntry(level, sessionId, userId, message, metadata);
  
  // Always log to console
  const consoleMethod = level === 'ERROR' ? console.error :
                       level === 'WARN' ? console.warn :
                       level === 'DEBUG' ? console.debug :
                       console.log;
  consoleMethod(logEntry);
  
  // Try GCP Cloud Logging first
  if (gcpLogging) {
    logToGCP(level, sessionId, userId, message, metadata).catch(() => {
      // Fallback to file if GCP fails
      writeToFile(sessionId, logEntry);
    });
  } else {
    // Fallback to file-based logging
    writeToFile(sessionId, logEntry);
  }
  
  // Store in session logs for retrieval
  if (sessionId && sessionId !== 'unknown') {
    if (!sessionLogs.has(sessionId)) {
      sessionLogs.set(sessionId, []);
    }
    sessionLogs.get(sessionId).push({
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    });
    
    // Limit session log size (keep last 1000 entries)
    const logs = sessionLogs.get(sessionId);
    if (logs.length > 1000) {
      logs.shift();
    }
  }
}

// Logger object
const logger = {
  error: (sessionId, userId, message, metadata = {}) => {
    log(LEVELS.ERROR, sessionId, userId, message, metadata);
  },
  
  warn: (sessionId, userId, message, metadata = {}) => {
    log(LEVELS.WARN, sessionId, userId, message, metadata);
  },
  
  info: (sessionId, userId, message, metadata = {}) => {
    log(LEVELS.INFO, sessionId, userId, message, metadata);
  },
  
  debug: (sessionId, userId, message, metadata = {}) => {
    log(LEVELS.DEBUG, sessionId, userId, message, metadata);
  },
  
  // Get logs for a session
  getSessionLogs: (sessionId) => {
    if (!sessionId) return [];
    
    // Try to get from memory first
    if (sessionLogs.has(sessionId)) {
      return sessionLogs.get(sessionId);
    }
    
    // Try to read from file
    const logFile = path.join(LOGS_DIR, `session-${sessionId}.log`);
    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
          // Parse log line
          const match = line.match(/\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              sessionId: match[3],
              userId: match[4],
              message: match[5]
            };
          }
          return { message: line };
        });
      } catch (err) {
        console.error('Failed to read session log file:', err);
        return [];
      }
    }
    
    return [];
  },
  
  // Get session log file path
  getSessionLogFilePath: (sessionId) => {
    if (!sessionId) return null;
    const logFile = path.join(LOGS_DIR, `session-${sessionId}.log`);
    return fs.existsSync(logFile) ? logFile : null;
  },
  
  // Generate new session ID
  generateSessionId: () => {
    return uuidv4();
  },
  
  // Cleanup old logs (call periodically)
  cleanup: cleanupOldLogs
};

// Run cleanup on startup and set interval (daily) - skip in test mode
let cleanupInterval = null;
if (!IS_TEST) {
  cleanupOldLogs();
  cleanupInterval = setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000); // Daily cleanup
}

// Export cleanup function for tests
logger.clearInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

module.exports = logger;

