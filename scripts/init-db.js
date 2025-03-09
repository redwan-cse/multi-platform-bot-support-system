/**
 * Database Initialization Script
 *
 * This script initializes the database by calling the existing initializeDatabase function
 * that's already defined in the main dbUtils.js
 */

// Use ES module imports
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__filename));

// Set up logging
console.log('Starting database initialization...');

// Ensure the data directory exists
const dataDir = join(projectRoot, 'data');
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
}

// Path to the SQLite database file
const dbPath = join(dataDir, 'database.sqlite');
console.log(`Database path: ${dbPath}`);

// Check if database needs to be reset
if (process.env.RESET_DB === 'true' && fs.existsSync(dbPath)) {
  console.log('Resetting database as requested...');
  fs.unlinkSync(dbPath);
  console.log('Existing database deleted.');
}

// Import the database utilities
import('../src/utils/dbUtils.js').then(async (dbUtils) => {
  try {
    console.log('Initializing database...');
    await dbUtils.initializeDatabase();
    console.log('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}).catch(error => {
  console.error('Failed to import database utilities:', error);
  process.exit(1);
});