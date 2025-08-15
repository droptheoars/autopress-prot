import fs from 'fs/promises';
import path from 'path';

/**
 * Logger utility with different levels
 */
export class Logger {
  constructor(config = {}) {
    this.level = config.level || 'info';
    this.enableConsole = config.enableConsole !== false;
  }

  log(level, message, data = null) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      
      if (this.enableConsole) {
        console.log(logMessage);
        if (data) console.log(data);
      }
    }
  }

  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
}

/**
 * Load configuration from JSON file with environment variable overrides
 */
export async function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'schedule.json');
    const configFile = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configFile);

    // Override with environment variables if present
    if (process.env.SCHEDULE_START_HOUR) {
      config.schedule.startHour = parseInt(process.env.SCHEDULE_START_HOUR);
    }
    if (process.env.SCHEDULE_END_HOUR) {
      config.schedule.endHour = parseInt(process.env.SCHEDULE_END_HOUR);
    }
    if (process.env.SCHEDULE_INTERVAL_MINUTES) {
      config.schedule.intervalMinutes = parseInt(process.env.SCHEDULE_INTERVAL_MINUTES);
    }
    if (process.env.TIMEZONE) {
      config.schedule.timezone = process.env.TIMEZONE;
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Check if current time is within scheduled hours
 */
export function isWithinScheduledHours(config) {
  const now = new Date();
  const currentHour = now.getHours(); // Local time
  
  return currentHour >= config.schedule.startHour && currentHour < config.schedule.endHour;
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for async functions
 */
export async function retry(fn, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await sleep(delay);
    }
  }
}

/**
 * Clean HTML content for Webflow
 */
export function cleanHtmlContent(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/**
 * Generate unique ID for press release
 */
export function generateReleaseId(title, date) {
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  let dateStr;
  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      // If date parsing fails, use current date
      dateStr = new Date().toISOString().split('T')[0];
    } else {
      dateStr = parsedDate.toISOString().split('T')[0];
    }
  } catch (error) {
    // Fallback to current date if any error occurs
    dateStr = new Date().toISOString().split('T')[0];
  }
  
  return `${dateStr}-${cleanTitle}`.substring(0, 100);
}