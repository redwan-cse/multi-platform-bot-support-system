/**
 * Database Utilities
 * 
 * This module provides functions for connecting to the database and performing CRUD operations.
 * It supports three database engines: SQLite (default), PostgreSQL, and MongoDB.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import logger from './logging.js';
import bcrypt from 'bcrypt';

const { Pool } = pg;
const sqliteVerbose = sqlite3.verbose();
const Database = sqliteVerbose.Database;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database engine from environment variable (default: SQLITE)
const DB_ENGINE = process.env.DB_ENGINE || 'SQLITE';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'botdashboard';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_URL = process.env.DB_URL || '';

let db = null;
let client = null;
let isConnecting = false;
let connectionPromise = null;

/**
 * Get database connection
 * @returns {Promise<Object>} Database connection
 */
async function getConnection() {
  // If already connected, return the connection
  if (db !== null) {
    return db;
  }
  
  // If connection is in progress, wait for it to complete
  if (isConnecting) {
    if (connectionPromise) {
      return connectionPromise;
    }
  }
  
  // Start connection process
  isConnecting = true;
  connectionPromise = initializeDatabase()
    .finally(() => {
      isConnecting = false;
      connectionPromise = null;
    });
  
  return connectionPromise;
}

/**
 * Initialize the database connection based on the configured engine
 */
async function initializeDatabase() {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        return await initializePostgreSQL();
      case 'MONGODB':
        return await initializeMongoDB();
      case 'SQLITE':
      default:
        return await initializeSQLite();
    }
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Initialize SQLite database
 */
async function initializeSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    
    // Ensure the data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = new Database(dbPath, async (err) => {
      if (err) {
        logger.error('Error opening SQLite database:', err);
        reject(err);
        return;
      }
      
      logger.info('Connected to SQLite database');
      
      // Create tables if they don't exist
      try {
        await createSQLiteTables();
        resolve(db);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Create SQLite tables if they don't exist
 */
async function createSQLiteTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          twoFactorSecret TEXT,
          twoFactorEnabled INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          lastLogin TEXT
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating users table:', err);
          reject(err);
          return;
        }
      });
      
      // Bots table
      db.run(`
        CREATE TABLE IF NOT EXISTS bots (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          config TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          lastActive TEXT
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating bots table:', err);
          reject(err);
          return;
        }
      });
      
      // Tickets table
      db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticketId TEXT UNIQUE NOT NULL,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          platform TEXT NOT NULL,
          issue TEXT NOT NULL,
          status TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          assignedTo TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT,
          closedAt TEXT
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating tickets table:', err);
          reject(err);
          return;
        }
      });
      
      // Interactions table
      db.run(`
        CREATE TABLE IF NOT EXISTS interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          platform TEXT NOT NULL,
          command TEXT NOT NULL,
          details TEXT,
          timestamp TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating interactions table:', err);
          reject(err);
          return;
        }
      });
      
      // Leads table
      db.run(`
        CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          platform TEXT NOT NULL,
          source TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating leads table:', err);
          reject(err);
          return;
        }
      });
      
      // Reputation table
      db.run(`
        CREATE TABLE IF NOT EXISTS reputation (
          userId TEXT PRIMARY KEY,
          points INTEGER DEFAULT 0,
          level TEXT DEFAULT 'Newcomer',
          lastUpdated TEXT NOT NULL,
          updatedBy TEXT
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating reputation table:', err);
          reject(err);
          return;
        }
      });

      // Settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          settings TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating settings table:', err);
          reject(err);
          return;
        }
      });
      
      // Check if admin user exists, create if not
      db.get('SELECT * FROM users WHERE email = ?', ['admin@redwan.work'], (err, row) => {
        if (err) {
          logger.error('Error checking for admin user:', err);
          reject(err);
          return;
        }
        
        if (!row) {
          // Create default admin user with the specified credentials
          const saltRounds = 10;
          const defaultPassword = "Password123"; // As requested
          
          bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
            if (err) {
              logger.error('Error hashing password:', err);
              reject(err);
              return;
            }
            
            db.run(`
              INSERT INTO users (id, username, email, password, role, status, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              'admin-' + Date.now(),
              'admin',
              'admin@redwan.work',
              hash,
              'Administrator',
              'active',
              new Date().toISOString()
            ], (err) => {
              if (err) {
                logger.error('Error creating admin user:', err);
                reject(err);
                return;
              }
              
              logger.info('Default admin user created');
              resolve();
            });
          });
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Initialize PostgreSQL database
 */
async function initializePostgreSQL() {
  try {
    const pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    
    // Test the connection
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL database');
    
    // Create tables if they don't exist
    await createPostgreSQLTables(client);
    
    client.release();
    db = pool;
    return pool;
  } catch (error) {
    logger.error('Error connecting to PostgreSQL:', error);
    throw error;
  }
}

/**
 * Create PostgreSQL tables if they don't exist
 */
async function createPostgreSQLTables(client) {
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        twoFactorSecret TEXT,
        twoFactorEnabled BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP NOT NULL,
        lastLogin TIMESTAMP
      )
    `);
    
    // Bots table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        config JSONB NOT NULL,
        createdAt TIMESTAMP NOT NULL,
        lastActive TIMESTAMP
      )
    `);
    
    // Tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticketId TEXT UNIQUE NOT NULL,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        platform TEXT NOT NULL,
        issue TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        assignedTo TEXT,
        createdAt TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP,
        closedAt TIMESTAMP
      )
    `);
    
    // Interactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS interactions (
        id SERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        platform TEXT NOT NULL,
        command TEXT NOT NULL,
        details JSONB,
        timestamp TIMESTAMP NOT NULL
      )
    `);
    
    // Leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        platform TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL
      )
    `);
    
    // Reputation table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reputation (
        userId TEXT PRIMARY KEY,
        points INTEGER DEFAULT 0,
        level TEXT DEFAULT 'Newcomer',
        lastUpdated TIMESTAMP NOT NULL,
        updatedBy TEXT
      )
    `);

    // Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        settings JSONB NOT NULL,
        createdAt TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    
    // Check if admin user exists, create if not
    const result = await client.query('SELECT * FROM users WHERE role = $1', ['Administrator']);
    
    if (result.rows.length === 0) {
      // Create default admin user with the specified credentials
      const saltRounds = 10;
      const defaultPassword = "Password123"; // As requested
      
      const hash = await bcrypt.hash(defaultPassword, saltRounds);
      
      await client.query(`
        INSERT INTO users (id, username, email, password, role, status, createdAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'admin-' + Date.now(),
        'admin',
        'admin@redwan.work', // Updated email as requested
        hash,
        'Administrator',
        'active',
        new Date()
      ]);
      
      logger.info('Default admin user created in PostgreSQL');
    }
  } catch (error) {
    logger.error('Error creating PostgreSQL tables:', error);
    throw error;
  }
}

/**
 * Initialize MongoDB database
 */
async function initializeMongoDB() {
  try {
    const url = DB_URL || `mongodb://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
    client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    
    await client.connect();
    logger.info('Connected to MongoDB database');
    
    db = client.db(DB_NAME);
    
    // Create collections and indexes
    await createMongoDBCollections();
    
    return db;
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

/**
 * Create MongoDB collections and indexes
 */
async function createMongoDBCollections() {
  try {
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
    }
    
    if (!collectionNames.includes('bots')) {
      await db.createCollection('bots');
    }
    
    if (!collectionNames.includes('tickets')) {
      await db.createCollection('tickets');
      await db.collection('tickets').createIndex({ ticketId: 1 }, { unique: true });
    }
    
    if (!collectionNames.includes('interactions')) {
      await db.createCollection('interactions');
      await db.collection('interactions').createIndex({ timestamp: 1 });
    }
    
    if (!collectionNames.includes('leads')) {
      await db.createCollection('leads');
      await db.collection('leads').createIndex({ timestamp: 1 });
    }
    
    if (!collectionNames.includes('reputation')) {
      await db.createCollection('reputation');
      await db.collection('reputation').createIndex({ userId: 1 }, { unique: true });
    }

    if (!collectionNames.includes('settings')) {
      await db.createCollection('settings');
      await db.collection('settings').createIndex({ userId: 1 }, { unique: true });
    }
    
    // Check if admin user exists, create if not
    const adminUser = await db.collection('users').findOne({ role: 'Administrator' });
    
    if (!adminUser) {
      // Create default admin user with the specified credentials
      const saltRounds = 10;
      const defaultPassword = "Password123"; // As requested
      
      const hash = await bcrypt.hash(defaultPassword, saltRounds);
      
      await db.collection('users').insertOne({
        id: 'admin-' + Date.now(),
        username: 'admin',
        email: 'admin@redwan.work', // Updated email as requested
        password: hash,
        role: 'Administrator',
        status: 'active',
        twoFactorEnabled: false,
        createdAt: new Date(),
        lastLogin: null
      });
      
      logger.info('Default admin user created in MongoDB');
    }
  } catch (error) {
    logger.error('Error creating MongoDB collections:', error);
    throw error;
  }
}

/**
 * Close the database connection
 */
async function closeDatabase() {
  try {
    if (DB_ENGINE === 'SQLITE' && db) {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            logger.error('Error closing SQLite database:', err);
            reject(err);
            return;
          }
          logger.info('SQLite database connection closed');
          resolve();
        });
      });
    } else if (DB_ENGINE === 'POSTGRESQL' && db) {
      await db.end();
      logger.info('PostgreSQL database connection closed');
    } else if (DB_ENGINE === 'MONGODB' && client) {
      await client.close();
      logger.info('MongoDB database connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

/**
 * Get active bots from the database
 * @returns {Promise<Array>} Array of active bot objects
 */
async function getActiveBots() {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await db.query('SELECT * FROM bots WHERE status = $1', ['online']);
        return result.rows;
      
      case 'MONGODB':
        return await db.collection('bots').find({ status: 'online' }).toArray();
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.all('SELECT * FROM bots WHERE status = ?', ['online'], (err, rows) => {
            if (err) {
              logger.error('Error getting active bots:', err);
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting active bots:', error);
    return []; // Return empty array instead of throwing to prevent app crash
  }
}

/**
 * Update bot status in the database
 * @param {string} id - Bot ID
 * @param {string} status - New status ('online', 'offline', 'error')
 */
async function updateBotStatus(id, status) {
  try {
    const now = new Date().toISOString();
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await db.query(
          'UPDATE bots SET status = $1, lastActive = $2 WHERE id = $3',
          [status, now, id]
        );
        break;
      
      case 'MONGODB':
        await db.collection('bots').updateOne(
          { id },
          { $set: { status, lastActive: now } }
        );
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(
            'UPDATE bots SET status = ?, lastActive = ? WHERE id = ?',
            [status, now, id],
            function(err) {
              if (err) {
                logger.error('Error updating bot status:', err);
                reject(err);
                return;
              }
              resolve();
            }
          );
        });
    }
    
    logger.info(`Updated bot ${id} status to ${status}`);
  } catch (error) {
    logger.error('Error updating bot status:', error);
    throw error;
  }
}

/**
 * Create a new ticket in the database
 */
async function createTicket(ticketData) {
  try {
    const { ticketId, userId, username, platform, issue, status, priority = 'medium' } = ticketData;
    const now = new Date().toISOString();

    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await db.query(`
          INSERT INTO tickets 
          (ticketId, userId, username, platform, issue, status, priority, createdAt) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [ticketId, userId, username, platform, issue, status, priority, now]);
        break;
      
      case 'MONGODB':
        await db.collection('tickets').insertOne({
          ...ticketData,
          createdAt: now
        });
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO tickets 
            (ticketId, userId, username, platform, issue, status, priority, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [ticketId, userId, username, platform, issue, status, priority, now], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
    }
    
    logger.info(`Ticket ${ticketId} created by ${username}`);
    return true;
  } catch (error) {
    logger.error('Error creating ticket:', error);
    return false;
  }
}

/**
 * Log an interaction in the database
 */
async function logInteraction(interactionData) {
  try {
    const { userId, username, platform, command, details } = interactionData;
    const now = new Date().toISOString();

    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await db.query(`
          INSERT INTO interactions 
          (userId, username, platform, command, details, timestamp) 
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, username, platform, command, JSON.stringify(details), now]);
        break;
      
      case 'MONGODB':
        await db.collection('interactions').insertOne({
          userId, 
          username, 
          platform, 
          command, 
          details, 
          timestamp: now
        });
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO interactions 
            (userId, username, platform, command, details, timestamp) 
            VALUES (?, ?, ?, ?, ?, ?)
          `, [userId, username, platform, command, JSON.stringify(details), now], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
    }
    
    return true;
  } catch (error) {
    logger.error('Error logging interaction:', error);
    return false;
  }
}

/**
 * Store a new lead in the database
 */
async function storeLead(leadData) {
  try {
    const { userId, username, platform, source } = leadData;
    const now = new Date().toISOString();

    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await db.query(`
          INSERT INTO leads 
          (userId, username, platform, source, timestamp) 
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, username, platform, source, now]);
        break;
      
      case 'MONGODB':
        await db.collection('leads').insertOne({
          userId, 
          username, 
          platform, 
          source, 
          timestamp: now
        });
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO leads 
            (userId, username, platform, source, timestamp) 
            VALUES (?, ?, ?, ?, ?)
          `, [userId, username, platform, source, now], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
    }
    
    logger.info(`New lead stored: ${username} from ${platform} via ${source}`);
    return true;
  } catch (error) {
    logger.error('Error storing lead:', error);
    return false;
  }
}

/**
 * Get reputation for a user
 */
async function getReputation(userId) {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await db.query('SELECT * FROM reputation WHERE userId = $1', [userId]);
        return result.rows[0] || null;
      
      case 'MONGODB':
        return await db.collection('reputation').findOne({ userId });
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM reputation WHERE userId = ?', [userId], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || null);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting reputation:', error);
    return null;
  }
}

/**
 * Add reputation points for a user
 */
async function addReputation(userId, points, updatedBy) {
  try {
    const now = new Date().toISOString();
    const currentRep = await getReputation(userId);
    
    if (currentRep) {
      const newPoints = currentRep.points + points;
      const level = calculateLevel(newPoints);
      
      switch (DB_ENGINE) {
        case 'POSTGRESQL':
          await db.query(
            'UPDATE reputation SET points = $1, level = $2, lastUpdated = $3, updatedBy = $4 WHERE userId = $5',
            [newPoints, level, now, updatedBy, userId]
          );
          break;
        
        case 'MONGODB':
          await db.collection('reputation').updateOne(
            { userId },
            { $set: { points: newPoints, level, lastUpdated: now, updatedBy } }
          );
          break;
        
        case 'SQLITE':
        default:
          return new Promise((resolve, reject) => {
            db.run(
              'UPDATE reputation SET points = ?, level = ?, lastUpdated = ?, updatedBy = ? WHERE userId = ?',
              [newPoints, level, now, updatedBy, userId],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve();
              }
            );
          });
      }
    } else {
      const level = calculateLevel(points);
      
      switch (DB_ENGINE) {
        case 'POSTGRESQL':
          await db.query(
            'INSERT INTO reputation (userId, points, level, lastUpdated, updatedBy) VALUES ($1, $2, $3, $4, $5)',
            [userId, points, level, now, updatedBy]
          );
          break;
        
        case 'MONGODB':
          await db.collection('reputation').insertOne({
            userId, 
            points, 
            level, 
            lastUpdated: now, 
            updatedBy
          });
          break;
        
        case 'SQLITE':
        default:
          return new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO reputation (userId, points, level, lastUpdated, updatedBy) VALUES (?, ?, ?, ?, ?)',
              [userId, points, level, now, updatedBy],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve();
              }
            );
          });
      }
    }
    
    logger.info(`Added ${points} reputation points to user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error adding reputation:', error);
    return false;
  }
}

/**
 * Calculate reputation level based on points
 */
function calculateLevel(points) {
  if (points < 100) return 'Newcomer';
  if (points < 500) return 'Regular';
  if (points < 1000) return 'Contributor';
  if (points < 2500) return 'Advocate';
  return 'Champion';
}

/**
 * Get settings for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Settings object
 */
async function getUserSettings(userId) {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await db.query('SELECT * FROM settings WHERE userId = $1', [userId]);
        return result.rows[0] || null;
      
      case 'MONGODB':
        return await db.collection('settings').findOne({ userId });
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM settings WHERE userId = ?', [userId], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || null);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting user settings:', error);
    return null;
  }
}

/**
 * Save settings for a user
 * @param {string} userId - User ID
 * @param {Object} settings - Settings object
 * @returns {Promise<boolean>} Success status
 */
async function saveUserSettings(userId, settings) {
  try {
    const now = new Date().toISOString();
    const settingsJson = JSON.stringify(settings);
    
    // Check if settings already exist
    const existingSettings = await getUserSettings(userId);
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        if (existingSettings) {
          await db.query(
            'UPDATE settings SET settings = $1, updatedAt = $2 WHERE userId = $3',
            [settingsJson, now, userId]
          );
        } else {
          await db.query(
            'INSERT INTO settings (userId, settings, createdAt, updatedAt) VALUES ($1, $2, $3, $4)',
            [userId, settingsJson, now, now]
          );
        }
        break;
      
      case 'MONGODB':
        if (existingSettings) {
          await db.collection('settings').updateOne(
            { userId },
            { $set: { settings, updatedAt: now } }
          );
        } else {
          await db.collection('settings').insertOne({
            userId,
            settings,
            createdAt: now,
            updatedAt: now
          });
        }
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          if (existingSettings) {
            db.run(
              'UPDATE settings SET settings = ?, updatedAt = ? WHERE userId = ?',
              [settingsJson, now, userId],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(true);
              }
            );
          } else {
            db.run(
              'INSERT INTO settings (userId, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
              [userId, settingsJson, now, now],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(true);
              }
            );
          }
        });
    }
    
    logger.info(`Settings updated for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error saving user settings:', error);
    return false;
  }
}

/**
 * Create a new bot in the database
 * @param {Object} botData - Bot data
 * @returns {Promise<string|boolean>} Bot ID if successful, false if failed
 */
async function createBot(botData) {
  try {
    const { name, platform, type, config } = botData;
    const id = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const status = 'offline';
    const createdAt = new Date().toISOString();
    
    let configStr;
    if (typeof config === 'object') {
      configStr = JSON.stringify(config);
    } else {
      configStr = config;
    }
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await db.query(
          'INSERT INTO bots (id, name, platform, type, status, config, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [id, name, platform, type, status, configStr, createdAt]
        );
        break;
      
      case 'MONGODB':
        await db.collection('bots').insertOne({
          id,
          name,
          platform,
          type,
          status,
          config: typeof config === 'object' ? config : JSON.parse(configStr),
          createdAt,
          lastActive: null
        });
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO bots (id, name, platform, type, status, config, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, name, platform, type, status, configStr, createdAt],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(id);
            }
          );
        });
    }
    
    logger.info(`Bot created: ${name} (${platform} ${type}) with ID: ${id}`);
    return id;
  } catch (error) {
    logger.error('Error creating bot:', error);
    return false;
  }
}

/**
 * Get all bots from the database
 * @returns {Promise<Array>} Array of bot objects
 */
async function getAllBots() {
  try {
    // Ensure database connection
    const connection = await getConnection();

    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query('SELECT * FROM bots ORDER BY createdAt DESC');
        return result.rows.map(bot => ({
          ...bot,
          config: typeof bot.config === 'string' ? JSON.parse(bot.config) : bot.config
        }));
      
      case 'MONGODB':
        return await connection.collection('bots').find({}).sort({ createdAt: -1 }).toArray();
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.all('SELECT * FROM bots ORDER BY createdAt DESC', [], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Parse config JSON if it's a string
            const bots = rows || [];
            bots.forEach(bot => {
              if (typeof bot.config === 'string') {
                try {
                  bot.config = JSON.parse(bot.config);
                } catch (e) {
                  // Keep as string if parsing fails
                }
              }
            });
            
            resolve(bots);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting all bots:', error);
    return [];
  }
}

/**
 * Get a bot by ID
 * @param {string} id - Bot ID
 * @returns {Promise<Object|null>} Bot object or null if not found
 */
async function getBotById(id) {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await db.query('SELECT * FROM bots WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        
        const bot = result.rows[0];
        if (typeof bot.config === 'string') {
          bot.config = JSON.parse(bot.config);
        }
        return bot;
      
      case 'MONGODB':
        return await db.collection('bots').findOne({ id });
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM bots WHERE id = ?', [id], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (!row) {
              resolve(null);
              return;
            }
            
            // Parse config JSON if it's a string
            if (typeof row.config === 'string') {
              try {
                row.config = JSON.parse(row.config);
              } catch (e) {
                // Keep as string if parsing fails
              }
            }
            
            resolve(row);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting bot by ID:', error);
    return null;
  }
}

/**
 * Update a bot in the database
 * @param {string} id - Bot ID
 * @param {Object} botData - Bot data to update
 * @returns {Promise<boolean>} Success status
 */
async function updateBot(id, botData) {
  try {
    const { name, platform, type, status, config } = botData;
    const updatableFields = {};
    
    if (name !== undefined) updatableFields.name = name;
    if (platform !== undefined) updatableFields.platform = platform;
    if (type !== undefined) updatableFields.type = type;
    if (status !== undefined) updatableFields.status = status;
    
    // Handle config separately since it needs JSON conversion
    let configStr;
    if (config !== undefined) {
      if (typeof config === 'object') {
        configStr = JSON.stringify(config);
        updatableFields.config = configStr;
      } else {
        configStr = config;
        updatableFields.config = config;
      }
    }
    
    // If there's nothing to update
    if (Object.keys(updatableFields).length === 0) {
      return false;
    }
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        // Construct dynamic query
        const fields = Object.keys(updatableFields);
        const values = fields.map(field => updatableFields[field]);
        values.push(id); // Add ID for WHERE clause
        
        const query = `UPDATE bots SET ${fields.map((field, i) => `${field} = $${i+1}`).join(', ')} WHERE id = $${fields.length + 1}`;
        await db.query(query, values);
        break;
      
      case 'MONGODB':
        const updateDoc = { $set: updatableFields };
        await db.collection('bots').updateOne({ id }, updateDoc);
        break;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          // Construct dynamic query
          const fields = Object.keys(updatableFields);
          const values = fields.map(field => updatableFields[field]);
          values.push(id); // Add ID for WHERE clause
          
          const query = `UPDATE bots SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
          db.run(query, values, function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes > 0);
          });
        });
    }
    
    logger.info(`Bot updated: ${id}`);
    return true;
  } catch (error) {
    logger.error('Error updating bot:', error);
    return false;
  }
}

/**
 * Delete a bot from the database
 * @param {string} id - Bot ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteBot(id) {
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await db.query('DELETE FROM bots WHERE id = $1', [id]);
        return result.rowCount > 0;
      
      case 'MONGODB':
        const deleteResult = await db.collection('bots').deleteOne({ id });
        return deleteResult.deletedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run('DELETE FROM bots WHERE id = ?', [id], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes > 0);
          });
        });
    }
    
    logger.info(`Bot deleted: ${id}`);
    return true;
  } catch (error) {
    logger.error('Error deleting bot:', error);
    return false;
  }
}

// User related functions

/**
 * Get a user by ID
 * @param {string} id - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserById(id, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
      
      case 'MONGODB':
        return await connection.collection('users').findOne({ id });
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || null);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Get a user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByEmail(email, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
      
      case 'MONGODB':
        return await connection.collection('users').findOne({ email });
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || null);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Get all users from the database
 * @returns {Promise<Array>} Array of user objects
 */
async function getAllUsers(dbConnection = null) {
  try {
    const connection = dbConnection || await getConnection();
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'SELECT id, username, email, role, status, twoFactorEnabled, createdAt, lastLogin FROM users ORDER BY createdAt DESC'
        );
        return result.rows;
      
      case 'MONGODB':
        return await connection.collection('users')
          .find({})
          .project({ password: 0, twoFactorSecret: 0 })
          .sort({ createdAt: -1 })
          .toArray();
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.all(
            'SELECT id, username, email, role, status, twoFactorEnabled, createdAt, lastLogin FROM users ORDER BY createdAt DESC',
            [],
            (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows || []);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error getting all users:', error);
    return [];
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<string|null>} User ID if successful, null otherwise
 */
async function createUser(userData, dbConnection = null) {
  try {
    const connection = dbConnection || await getConnection();
    
    const { username, email, password, role, status = 'active' } = userData;
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        await connection.query(
          'INSERT INTO users (id, username, email, password, role, status, createdAt, twoFactorEnabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [id, username, email, password, role, status, createdAt, false]
        );
        break;
      
      case 'MONGODB':
        await connection.collection('users').insertOne({
          id,
          username,
          email,
          password,
          role,
          status,
          twoFactorEnabled: false,
          createdAt,
          lastLogin: null
        });
        break;
      
      case 'SQLITE':
      default:
        await new Promise((resolve, reject) => {
          connection.run(
            'INSERT INTO users (id, username, email, password, role, status, createdAt, twoFactorEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, username, email, password, role, status, createdAt, 0],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(id);
            }
          );
        });
    }
    
    logger.info(`User created: ${username} (${email}) with ID: ${id}`);
    return id;
  } catch (error) {
    logger.error('Error creating user:', error);
    return null;
  }
}

/**
 * Update user status
 * @param {string} id - User ID
 * @param {string} status - New status ('active', 'suspended')
 * @returns {Promise<boolean>} Success status
 */
async function updateUserStatus(id, status, dbConnection = null) {
  try {
    const connection = dbConnection || await getConnection();
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'UPDATE users SET status = $1 WHERE id = $2',
          [status, id]
        );
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateResult = await connection.collection('users').updateOne(
          { id },
          { $set: { status } }
        );
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'UPDATE users SET status = ? WHERE id = ?',
            [status, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error updating user status:', error);
    return false;
  }
}

/**
 * Update user's last login timestamp
 * @param {string} id - User ID
 * @returns {Promise<boolean>} Success status
 */
async function updateLastLogin(id, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    const now = new Date().toISOString();
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'UPDATE users SET lastLogin = $1 WHERE id = $2',
          [now, id]
        );
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateResult = await connection.collection('users').updateOne(
          { id },
          { $set: { lastLogin: now } }
        );
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'UPDATE users SET lastLogin = ? WHERE id = ?',
            [now, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error updating last login:', error);
    return false;
  }
}

/**
 * Update user profile
 * @param {string} id - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<boolean>} Success status
 */
async function updateUserProfile(id, profileData, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    const { username, email, role } = profileData;
    const validFields = {};
    
    if (username !== undefined) validFields.username = username;
    if (email !== undefined) validFields.email = email;
    if (role !== undefined) validFields.role = role;
    
    // If there's nothing to update
    if (Object.keys(validFields).length === 0) {
      return false;
    }
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        // Construct dynamic query
        const fields = Object.keys(validFields);
        const values = fields.map(field => validFields[field]);
        values.push(id); // Add ID for WHERE clause
        
        const query = `UPDATE users SET ${fields.map((field, i) => `${field} = $${i+1}`).join(', ')} WHERE id = $${fields.length + 1}`;
        const result = await connection.query(query, values);
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateDoc = { $set: validFields };
        const updateResult = await connection.collection('users').updateOne({ id }, updateDoc);
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          // Construct dynamic query
          const fields = Object.keys(validFields);
          const values = fields.map(field => validFields[field]);
          values.push(id); // Add ID for WHERE clause
          
          const query = `UPDATE users SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
          connection.run(query, values, function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.changes > 0);
          });
        });
    }
  } catch (error) {
    logger.error('Error updating user profile:', error);
    return false;
  }
}

/**
 * Change user password
 * @param {string} id - User ID
 * @param {string} newPasswordHash - New password hash
 * @returns {Promise<boolean>} Success status
 */
async function changeUserPassword(id, newPasswordHash, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [newPasswordHash, id]
        );
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateResult = await connection.collection('users').updateOne(
          { id },
          { $set: { password: newPasswordHash } }
        );
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'UPDATE users SET password = ? WHERE id = ?',
            [newPasswordHash, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error changing user password:', error);
    return false;
  }
}

/**
 * Delete a user
 * @param {string} id - User ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteUser(id, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query('DELETE FROM users WHERE id = $1', [id]);
        return result.rowCount > 0;
      
      case 'MONGODB':
        const deleteResult = await connection.collection('users').deleteOne({ id });
        return deleteResult.deletedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'DELETE FROM users WHERE id = ?',
            [id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error deleting user:', error);
    return false;
  }
}

/**
 * Set up two-factor authentication for a user
 * @param {string} id - User ID
 * @param {string} secretKey - Two-factor secret key
 * @returns {Promise<boolean>} Success status
 */
async function setupTwoFactorAuth(id, secretKey, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'UPDATE users SET twoFactorSecret = $1 WHERE id = $2',
          [secretKey, id]
        );
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateResult = await connection.collection('users').updateOne(
          { id },
          { $set: { twoFactorSecret: secretKey } }
        );
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'UPDATE users SET twoFactorSecret = ? WHERE id = ?',
            [secretKey, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error setting up two-factor auth:', error);
    return false;
  }
}

/**
 * Enable or disable two-factor authentication for a user
 * @param {string} id - User ID
 * @param {boolean} enabled - Whether to enable or disable 2FA
 * @returns {Promise<boolean>} Success status
 */
async function toggleTwoFactorAuth(id, enabled, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'UPDATE users SET twoFactorEnabled = $1 WHERE id = $2',
          [enabled, id]
        );
        return result.rowCount > 0;
      
      case 'MONGODB':
        const updateResult = await connection.collection('users').updateOne(
          { id },
          { $set: { twoFactorEnabled: enabled } }
        );
        return updateResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.run(
            'UPDATE users SET twoFactorEnabled = ? WHERE id = ?',
            [enabled ? 1 : 0, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error toggling two-factor auth:', error);
    return false;
  }
}

/**
 * Check if an email exists in the database
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if email exists
 */
async function checkEmailExists(email, dbConnection = null) {
  const connection = dbConnection || db;
  
  try {
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const result = await connection.query(
          'SELECT COUNT(*) as count FROM users WHERE email = $1',
          [email]
        );
        return parseInt(result.rows[0].count) > 0;
      
      case 'MONGODB':
        const count = await connection.collection('users').countDocuments({ email });
        return count > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          connection.get(
            'SELECT COUNT(*) as count FROM users WHERE email = ?',
            [email],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(row && parseInt(row.count) > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error checking email existence:', error);
    return false;
  }
}

// Analytics related functions

/**
 * Get bot usage statistics
 * @param {string} period - Time period ('day', 'week', 'month', 'year')
 * @returns {Promise<Object>} Usage statistics
 */
async function getBotUsageStats(period = 'day') {
  try {
    // Get the date cutoff based on the period
    const now = new Date();
    const cutoff = new Date();
    
    switch (period) {
      case 'day':
        cutoff.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoff.setDate(now.getDate() - 1); // Default to day
    }
    
    const cutoffStr = cutoff.toISOString();
    
    // Get interactions data
    let interactions;
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const resultInteractions = await db.query(
          'SELECT platform, COUNT(*) as count FROM interactions WHERE timestamp >= $1 GROUP BY platform',
          [cutoffStr]
        );
        interactions = resultInteractions.rows;
        break;
      
      case 'MONGODB':
        interactions = await db.collection('interactions').aggregate([
          { $match: { timestamp: { $gte: cutoffStr } } },
          { $group: { _id: '$platform', count: { $sum: 1 } } },
          { $project: { _id: 0, platform: '$_id', count: 1 } }
        ]).toArray();
        break;
      
      case 'SQLITE':
      default:
        interactions = await new Promise((resolve, reject) => {
          db.all(
            'SELECT platform, COUNT(*) as count FROM interactions WHERE timestamp >= ? GROUP BY platform',
            [cutoffStr],
            (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows || []);
            }
          );
        });
    }
    
    // Get leads data
    let leads;
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const resultLeads = await db.query(
          'SELECT platform, COUNT(*) as count FROM leads WHERE timestamp >= $1 GROUP BY platform',
          [cutoffStr]
        );
        leads = resultLeads.rows;
        break;
      
      case 'MONGODB':
        leads = await db.collection('leads').aggregate([
          { $match: { timestamp: { $gte: cutoffStr } } },
          { $group: { _id: '$platform', count: { $sum: 1 } } },
          { $project: { _id: 0, platform: '$_id', count: 1 } }
        ]).toArray();
        break;
      
      case 'SQLITE':
      default:
        leads = await new Promise((resolve, reject) => {
          db.all(
            'SELECT platform, COUNT(*) as count FROM leads WHERE timestamp >= ? GROUP BY platform',
            [cutoffStr],
            (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows || []);
            }
          );
        });
    }
    
    // Get tickets data
    let tickets;
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const resultTickets = await db.query(
          'SELECT platform, status, COUNT(*) as count FROM tickets WHERE createdAt >= $1 GROUP BY platform, status',
          [cutoffStr]
        );
        tickets = resultTickets.rows;
        break;
      
      case 'MONGODB':
        tickets = await db.collection('tickets').aggregate([
          { $match: { createdAt: { $gte: cutoffStr } } },
          { $group: { 
            _id: { platform: '$platform', status: '$status' }, 
            count: { $sum: 1 } 
          }},
          { $project: { 
            _id: 0, 
            platform: '$_id.platform', 
            status: '$_id.status', 
            count: 1 
          }}
        ]).toArray();
        break;
      
      case 'SQLITE':
      default:
        tickets = await new Promise((resolve, reject) => {
          db.all(
            'SELECT platform, status, COUNT(*) as count FROM tickets WHERE createdAt >= ? GROUP BY platform, status',
            [cutoffStr],
            (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows || []);
            }
          );
        });
    }
    
    return { 
      interactions,
      leads,
      tickets,
      period
    };
  } catch (error) {
    logger.error('Error getting bot usage stats:', error);
    return {
      interactions: [],
      leads: [],
      tickets: [],
      period
    };
  }
}

/**
 * Get analytical data for a time period
 * @param {string} startDate - Start date in ISO format
 * @param {string} endDate - End date in ISO format
 * @returns {Promise<Object>} Analytics data
 */
async function getAnalyticalData(startDate, endDate) {
  try {
    // Get platform-wise interaction counts
    let platformInteractions;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        platformInteractions = await db.query(`
          SELECT platform, COUNT(*) as count 
          FROM interactions 
          WHERE timestamp BETWEEN $1 AND $2 
          GROUP BY platform
        `, [startDate, endDate]);
        platformInteractions = platformInteractions.rows;
        break;
      
      case 'MONGODB':
        platformInteractions = await db.collection('interactions').aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$platform', count: { $sum: 1 } } },
          { $project: { platform: '$_id', count: 1, _id: 0 } }
        ]).toArray();
        break;
      
      case 'SQLITE':
      default:
        platformInteractions = await new Promise((resolve, reject) => {
          db.all(`
            SELECT platform, COUNT(*) as count 
            FROM interactions 
            WHERE timestamp BETWEEN ? AND ? 
            GROUP BY platform
          `, [startDate, endDate], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
    }
    
    // Get command usage statistics
    let commandUsage;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        commandUsage = await db.query(`
          SELECT command, COUNT(*) as count 
          FROM interactions 
          WHERE timestamp BETWEEN $1 AND $2 
          GROUP BY command 
          ORDER BY count DESC 
          LIMIT 10
        `, [startDate, endDate]);
        commandUsage = commandUsage.rows;
        break;
      
      case 'MONGODB':
        commandUsage = await db.collection('interactions').aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$command', count: { $sum: 1 } } },
          { $project: { command: '$_id', count: 1, _id: 0 } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray();
        break;
      
      case 'SQLITE':
      default:
        commandUsage = await new Promise((resolve, reject) => {
          db.all(`
            SELECT command, COUNT(*) as count 
            FROM interactions 
            WHERE timestamp BETWEEN ? AND ? 
            GROUP BY command 
            ORDER BY count DESC 
            LIMIT 10
          `, [startDate, endDate], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
    }
    
    // Get active users count
    let activeUsers;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        activeUsers = await db.query(`
          SELECT COUNT(DISTINCT userId) as count 
          FROM interactions 
          WHERE timestamp BETWEEN $1 AND $2
        `, [startDate, endDate]);
        activeUsers = parseInt(activeUsers.rows[0].count);
        break;
      
      case 'MONGODB':
        activeUsers = await db.collection('interactions').distinct('userId', { 
          timestamp: { $gte: startDate, $lte: endDate } 
        });
        activeUsers = activeUsers.length;
        break;
      
      case 'SQLITE':
      default:
        activeUsers = await new Promise((resolve, reject) => {
          db.get(`
            SELECT COUNT(DISTINCT userId) as count 
            FROM interactions 
            WHERE timestamp BETWEEN ? AND ?
          `, [startDate, endDate], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(parseInt(row?.count || 0));
          });
        });
    }
    
    // Get new leads count
    let newLeads;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        newLeads = await db.query(`
          SELECT COUNT(*) as count 
          FROM leads 
          WHERE timestamp BETWEEN $1 AND $2
        `, [startDate, endDate]);
        newLeads = parseInt(newLeads.rows[0].count);
        break;
      
      case 'MONGODB':
        newLeads = await db.collection('leads').countDocuments({ 
          timestamp: { $gte: startDate, $lte: endDate } 
        });
        break;
      
      case 'SQLITE':
      default:
        newLeads = await new Promise((resolve, reject) => {
          db.get(`
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE timestamp BETWEEN ? AND ?
          `, [startDate, endDate], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(parseInt(row?.count || 0));
          });
        });
    }
    
    return {
      platformInteractions,
      commandUsage,
      activeUsers,
      newLeads
    };
  } catch (error) {
    logger.error('Error getting analytical data:', error);
    return {
      platformInteractions: [],
      commandUsage: [],
      activeUsers: 0,
      newLeads: 0
    };
  }
}

/**
 * Get recent activity for dashboard display
 * @param {number} limit - Number of activities to return
 * @returns {Promise<Array>} Recent activities
 */
async function getRecentActivity(limit = 10) {
  try {
    // Get recent interactions
    let recentInteractions;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        recentInteractions = await db.query(`
          SELECT userId, username, platform, command, details, timestamp 
          FROM interactions 
          ORDER BY timestamp DESC 
          LIMIT $1
        `, [limit]);
        recentInteractions = recentInteractions.rows.map(row => ({
          ...row,
          type: 'interaction',
          details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
        }));
        break;
      
      case 'MONGODB':
        recentInteractions = await db.collection('interactions')
          .find({})
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();
        recentInteractions = recentInteractions.map(item => ({
          ...item,
          type: 'interaction',
          _id: undefined
        }));
        break;
      
      case 'SQLITE':
      default:
        recentInteractions = await new Promise((resolve, reject) => {
          db.all(`
            SELECT userId, username, platform, command, details, timestamp 
            FROM interactions 
            ORDER BY timestamp DESC 
            LIMIT ?
          `, [limit], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve((rows || []).map(row => ({
              ...row,
              type: 'interaction',
              details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
            })));
          });
        });
    }
    
    // Get recent tickets
    let recentTickets;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        recentTickets = await db.query(`
          SELECT ticketId, userId, username, platform, issue, status, priority, createdAt 
          FROM tickets 
          ORDER BY createdAt DESC 
          LIMIT $1
        `, [limit]);
        recentTickets = recentTickets.rows.map(row => ({
          ...row,
          type: 'ticket'
        }));
        break;
      
      case 'MONGODB':
        recentTickets = await db.collection('tickets')
          .find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        recentTickets = recentTickets.map(item => ({
          ...item,
          type: 'ticket',
          _id: undefined
        }));
        break;
      
      case 'SQLITE':
      default:
        recentTickets = await new Promise((resolve, reject) => {
          db.all(`
            SELECT ticketId, userId, username, platform, issue, status, priority, createdAt 
            FROM tickets 
            ORDER BY createdAt DESC 
            LIMIT ?
          `, [limit], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve((rows || []).map(row => ({
              ...row,
              type: 'ticket'
            })));
          });
        });
    }
    
    // Get recent leads
    let recentLeads;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        recentLeads = await db.query(`
          SELECT userId, username, platform, source, timestamp 
          FROM leads 
          ORDER BY timestamp DESC 
          LIMIT $1
        `, [limit]);
        recentLeads = recentLeads.rows.map(row => ({
          ...row,
          type: 'lead'
        }));
        break;
      
      case 'MONGODB':
        recentLeads = await db.collection('leads')
          .find({})
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();
        recentLeads = recentLeads.map(item => ({
          ...item,
          type: 'lead',
          _id: undefined
        }));
        break;
      
      case 'SQLITE':
      default:
        recentLeads = await new Promise((resolve, reject) => {
          db.all(`
            SELECT userId, username, platform, source, timestamp 
            FROM leads 
            ORDER BY timestamp DESC 
            LIMIT ?
          `, [limit], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve((rows || []).map(row => ({
              ...row,
              type: 'lead'
            })));
          });
        });
    }
    
    // Combine all activities, sort by timestamp/createdAt, and limit
    const allActivities = [
      ...recentInteractions,
      ...recentTickets,
      ...recentLeads
    ].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.createdAt);
      const dateB = new Date(b.timestamp || b.createdAt);
      return dateB - dateA;
    }).slice(0, limit);
    
    return allActivities;
  } catch (error) {
    logger.error('Error getting recent activity:', error);
    return [];
  }
}

/**
 * Create or update a ticket in the database
 * @param {Object} ticketData - Ticket data
 * @returns {Promise<Object|null>} Created/updated ticket or null on error
 */
async function updateTicket(id, ticketData) {
  try {
    const { status, priority, assignedTo } = ticketData;
    const updatedAt = new Date().toISOString();
    const updateData = {};
    
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    
    updateData.updatedAt = updatedAt;
    
    // Add closedAt timestamp if status is 'closed'
    if (status === 'closed') {
      updateData.closedAt = updatedAt;
    }
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        // Build query dynamically
        const setItems = Object.keys(updateData).map((key, i) => `${key} = $${i+1}`);
        const values = [...Object.values(updateData), id];
        
        const result = await db.query(
          `UPDATE tickets SET ${setItems.join(', ')} WHERE ticketId = $${setItems.length + 1} RETURNING *`,
          values
        );
        
        return result.rows[0] || null;
      
      case 'MONGODB':
        const updateResult = await db.collection('tickets').findOneAndUpdate(
          { ticketId: id },
          { $set: updateData },
          { returnDocument: 'after' }
        );
        
        return updateResult.value;
      
      case 'SQLITE':
      default:
        // Build query dynamically
        const setItemsSqlite = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const valuesSqlite = [...Object.values(updateData), id];
        
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE tickets SET ${setItemsSqlite} WHERE ticketId = ?`,
            valuesSqlite,
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes);
            }
          );
        });
        
        // Get the updated ticket
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM tickets WHERE ticketId = ?', [id], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || null);
          });
        });
    }
  } catch (error) {
    logger.error('Error updating ticket:', error);
    return null;
  }
}

/**
 * Get all tickets with optional filtering
 * @param {Object} filters - Optional filters (status, platform, priority)
 * @returns {Promise<Array>} Array of tickets
 */
async function getTickets(filters = {}) {
  try {
    const { status, platform, priority, assignedTo } = filters;
    let query = {};
    let sqlQuery = 'SELECT * FROM tickets';
    let sqlParams = [];
    let whereClause = [];
    
    // Build filters
    if (status) {
      query.status = status;
      whereClause.push('status = ?');
      sqlParams.push(status);
    }
    
    if (platform) {
      query.platform = platform;
      whereClause.push('platform = ?');
      sqlParams.push(platform);
    }
    
    if (priority) {
      query.priority = priority;
      whereClause.push('priority = ?');
      sqlParams.push(priority);
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
      whereClause.push('assignedTo = ?');
      sqlParams.push(assignedTo);
    }
    
    if (whereClause.length > 0) {
      sqlQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    sqlQuery += ' ORDER BY createdAt DESC';
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        // Convert SQL params to PostgreSQL style ($1, $2, etc.)
        const pgQuery = sqlQuery.replace(/\?/g, (_, i) => `$${i + 1}`);
        const result = await db.query(pgQuery, sqlParams);
        return result.rows;
      
      case 'MONGODB':
        return await db.collection('tickets').find(query).sort({ createdAt: -1 }).toArray();
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.all(sqlQuery, sqlParams, (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
    }
  } catch (error) {
    logger.error('Error getting tickets:', error);
    return [];
  }
}

/**
 * Get bot execution logs
 * @param {string} botId - Bot ID
 * @param {number} limit - Number of log entries to return
 * @returns {Promise<Array>} Array of log entries
 */
async function getBotLogs(botId, limit = 100) {
  try {
    // Get interactions related to this bot
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const pgResult = await db.query(`
          SELECT timestamp, username, command, details 
          FROM interactions 
          WHERE details::jsonb @> $1 
          ORDER BY timestamp DESC 
          LIMIT $2
        `, [JSON.stringify({ botId }), limit]);
        
        return pgResult.rows.map(row => ({
          timestamp: row.timestamp,
          username: row.username,
          command: row.command,
          details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
        }));
      
      case 'MONGODB':
        return await db.collection('interactions')
          .find({ 'details.botId': botId })
          .sort({ timestamp: -1 })
          .limit(limit)
          .project({ timestamp: 1, username: 1, command: 1, details: 1, _id: 0 })
          .toArray();
      
      case 'SQLITE':
      default:
        const sqliteRows = await new Promise((resolve, reject) => {
          db.all(`
            SELECT timestamp, username, command, details 
            FROM interactions 
            WHERE details LIKE ? 
            ORDER BY timestamp DESC 
            LIMIT ?
          `, [`%"botId":"${botId}"%`, limit], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
        
        return sqliteRows.map(row => ({
          timestamp: row.timestamp,
          username: row.username,
          command: row.command,
          details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
        }));
    }
  } catch (error) {
    logger.error('Error getting bot logs:', error);
    return [];
  }
}

/**
 * Update bot configuration
 * @param {string} botId - Bot ID
 * @param {Object} config - New configuration object
 * @returns {Promise<boolean>} Success status
 */
async function updateBotConfig(botId, config) {
  try {
    const configStr = typeof config === 'object' ? JSON.stringify(config) : config;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const pgResult = await db.query(
          'UPDATE bots SET config = $1 WHERE id = $2',
          [configStr, botId]
        );
        return pgResult.rowCount > 0;
      
      case 'MONGODB':
        const mongoResult = await db.collection('bots').updateOne(
          { id: botId },
          { $set: { config: typeof config === 'object' ? config : JSON.parse(configStr) } }
        );
        return mongoResult.modifiedCount > 0;
      
      case 'SQLITE':
      default:
        return new Promise((resolve, reject) => {
          db.run(
            'UPDATE bots SET config = ? WHERE id = ?',
            [configStr, botId],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes > 0);
            }
          );
        });
    }
  } catch (error) {
    logger.error('Error updating bot config:', error);
    return false;
  }
}

/**
 * Get dashboard summary statistics
 * @returns {Promise<Object>} Summary statistics
 */
async function getDashboardSummary() {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const dayAgoStr = dayAgo.toISOString();
    const weekAgoStr = weekAgo.toISOString();
    
    let onlineBots, totalBots, activeUsers, newTickets, pendingTickets;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        // Count online bots
        const onlineBotsResult = await db.query(`SELECT COUNT(*) as count FROM bots WHERE status = 'online'`);
        onlineBots = parseInt(onlineBotsResult.rows[0].count);
        
        // Count total bots
        const totalBotsResult = await db.query('SELECT COUNT(*) as count FROM bots');
        totalBots = parseInt(totalBotsResult.rows[0].count);
        
        // Count active users in last 24 hours
        const activeUsersResult = await db.query(
          'SELECT COUNT(DISTINCT userId) as count FROM interactions WHERE timestamp >= $1',
          [dayAgoStr]
        );
        activeUsers = parseInt(activeUsersResult.rows[0].count);
        
        // Count new tickets in last 24 hours
        const newTicketsResult = await db.query(
          'SELECT COUNT(*) as count FROM tickets WHERE createdAt >= $1',
          [dayAgoStr]
        );
        newTickets = parseInt(newTicketsResult.rows[0].count);
        
        // Count pending tickets
        const pendingTicketsResult = await db.query(`
          SELECT COUNT(*) as count FROM tickets 
          WHERE status = 'open' OR status = 'in-progress'
        `);
        pendingTickets = parseInt(pendingTicketsResult.rows[0].count);
        break;
      
      case 'MONGODB':
        // Count online bots
        onlineBots = await db.collection('bots').countDocuments({ status: 'online' });
        
        // Count total bots
        totalBots = await db.collection('bots').countDocuments({});
        
        // Count active users in last 24 hours
        const activeUsersList = await db.collection('interactions').distinct('userId', { timestamp: { $gte: dayAgoStr } });
        activeUsers = activeUsersList.length;
        
        // Count new tickets in last 24 hours
        newTickets = await db.collection('tickets').countDocuments({ createdAt: { $gte: dayAgoStr } });
        
        // Count pending tickets
        pendingTickets = await db.collection('tickets').countDocuments({ status: { $in: ['open', 'in-progress'] } });
        break;
      
      case 'SQLITE':
      default:
        // Count online bots
        onlineBots = await new Promise((resolve, reject) => {
          db.get("SELECT COUNT(*) as count FROM bots WHERE status = 'online'", [], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(parseInt(row?.count || 0));
          });
        });
        
        // Count total bots
        totalBots = await new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM bots', [], (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(parseInt(row?.count || 0));
          });
        });
        
        // Count active users in last 24 hours
        activeUsers = await new Promise((resolve, reject) => {
          db.get(
            'SELECT COUNT(DISTINCT userId) as count FROM interactions WHERE timestamp >= ?',
            [dayAgoStr],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(parseInt(row?.count || 0));
            }
          );
        });
        
        // Count new tickets in last 24 hours
        newTickets = await new Promise((resolve, reject) => {
          db.get(
            'SELECT COUNT(*) as count FROM tickets WHERE createdAt >= ?',
            [dayAgoStr],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(parseInt(row?.count || 0));
            }
          );
        });
        
        // Count pending tickets
        pendingTickets = await new Promise((resolve, reject) => {
          db.get(
            "SELECT COUNT(*) as count FROM tickets WHERE status = 'open' OR status = 'in-progress'",
            [],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(parseInt(row?.count || 0));
            }
          );
        });
        break;
    }
    
    // Get active users trend data for past 7 days
    const dailyActiveUsers = await getDailyActiveUsers(7);
    
    return {
      onlineBots,
      totalBots,
      activeUsers,
      newTickets,
      pendingTickets,
      dailyActiveUsers
    };
  } catch (error) {
    logger.error('Error getting dashboard summary:', error);
    return {
      onlineBots: 0,
      totalBots: 0,
      activeUsers: 0,
      newTickets: 0,
      pendingTickets: 0,
      dailyActiveUsers: []
    };
  }
}

/**
 * Get daily active users for the past n days
 * @param {number} days - Number of days to get data for
 * @returns {Promise<Array>} Daily active users data
 */
async function getDailyActiveUsers(days) {
  try {
    const now = new Date();
    const results = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dateStr = date.toISOString();
      const nextDateStr = nextDate.toISOString();
      
      let activeUsers;
      
      switch (DB_ENGINE) {
        case 'POSTGRESQL':
          const pgResult = await db.query(
            'SELECT COUNT(DISTINCT userId) as count FROM interactions WHERE timestamp >= $1 AND timestamp < $2',
            [dateStr, nextDateStr]
          );
          activeUsers = parseInt(pgResult.rows[0].count);
          break;
        
        case 'MONGODB':
          const distinctUsers = await db.collection('interactions').distinct('userId', {
            timestamp: { $gte: dateStr, $lt: nextDateStr }
          });
          activeUsers = distinctUsers.length;
          break;
        
        case 'SQLITE':
        default:
          activeUsers = await new Promise((resolve, reject) => {
            db.get(
              'SELECT COUNT(DISTINCT userId) as count FROM interactions WHERE timestamp >= ? AND timestamp < ?',
              [dateStr, nextDateStr],
              (err, row) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(parseInt(row?.count || 0));
              }
            );
          });
          break;
      }
      
      results.push({
        date: date.toISOString().split('T')[0], // YYYY-MM-DD format
        users: activeUsers
      });
    }
    
    return results;
  } catch (error) {
    logger.error('Error getting daily active users:', error);
    return [];
  }
}

/**
 * Save system settings
 * @param {Object} settings - Settings object to save
 * @returns {Promise<boolean>} Success status
 */
async function saveSystemSettings(settings) {
  try {
    const connection = await getConnection();
    const now = new Date().toISOString();
    const systemUserId = 'system';
    const settingsJson = JSON.stringify(settings);
    
    // Check if settings already exist
    let settingsExist = false;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const pgResult = await connection.query(
          'SELECT COUNT(*) as count FROM settings WHERE userId = $1',
          [systemUserId]
        );
        settingsExist = parseInt(pgResult.rows[0].count) > 0;
        
        if (settingsExist) {
          await connection.query(
            'UPDATE settings SET settings = $1, updatedAt = $2 WHERE userId = $3',
            [settingsJson, now, systemUserId]
          );
        } else {
          await connection.query(
            'INSERT INTO settings (userId, settings, createdAt, updatedAt) VALUES ($1, $2, $3, $4)',
            [systemUserId, settingsJson, now, now]
          );
        }
        break;
      
      case 'MONGODB':
        const mongoSettings = await connection.collection('settings').findOne({ userId: systemUserId });
        settingsExist = !!mongoSettings;
        
        if (settingsExist) {
          await connection.collection('settings').updateOne(
            { userId: systemUserId },
            { $set: { settings, updatedAt: now } }
          );
        } else {
          await connection.collection('settings').insertOne({
            userId: systemUserId,
            settings,
            createdAt: now,
            updatedAt: now
          });
        }
        break;
      
      case 'SQLITE':
      default:
        settingsExist = await new Promise((resolve, reject) => {
          connection.get(
            'SELECT COUNT(*) as count FROM settings WHERE userId = ?',
            [systemUserId],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(row && parseInt(row.count) > 0);
            }
          );
        });
        
        if (settingsExist) {
          await new Promise((resolve, reject) => {
            connection.run(
              'UPDATE settings SET settings = ?, updatedAt = ? WHERE userId = ?',
              [settingsJson, now, systemUserId],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(this.changes > 0);
              }
            );
          });
        } else {
          await new Promise((resolve, reject) => {
            connection.run(
              'INSERT INTO settings (userId, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
              [systemUserId, settingsJson, now, now],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(true);
              }
            );
          });
        }
        break;
    }
    
    logger.info('System settings updated');
    return true;
  } catch (error) {
    logger.error('Error saving system settings:', error);
    return false;
  }
}

/**
 * Get system settings
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
async function getSystemSettings() {
  try {
    const connection = await getConnection();
    const systemUserId = 'system';
    let settings = null;
    
    switch (DB_ENGINE) {
      case 'POSTGRESQL':
        const pgResult = await connection.query(
          'SELECT settings FROM settings WHERE userId = $1',
          [systemUserId]
        );
        if (pgResult.rows.length > 0) {
          settings = typeof pgResult.rows[0].settings === 'string' 
            ? JSON.parse(pgResult.rows[0].settings)
            : pgResult.rows[0].settings;
        }
        break;
      
      case 'MONGODB':
        const mongoSettings = await connection.collection('settings').findOne({ userId: systemUserId });
        if (mongoSettings) {
          settings = mongoSettings.settings;
        }
        break;
      
      case 'SQLITE':
      default:
        const sqliteSettings = await new Promise((resolve, reject) => {
          connection.get(
            'SELECT settings FROM settings WHERE userId = ?',
            [systemUserId],
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(row);
            }
          );
        });
        if (sqliteSettings) {
          settings = typeof sqliteSettings.settings === 'string'
            ? JSON.parse(sqliteSettings.settings)
            : sqliteSettings.settings;
        }
        break;
    }
    
    return settings || {
      database: {
        engine: 'SQLITE',
        host: 'localhost',
        port: '5432',
        name: 'botdashboard',
        user: 'postgres',
        password: '********',
        url: '',
        ssl: false
      },
      security: {
        sessionTimeout: 15,
        maxLoginAttempts: 5,
        rateLimitRequests: 100,
        rateLimitWindow: 15,
        enforceHttps: true,
        csrfProtection: true
      },
      system: {
        logLevel: 'info',
        logRetention: 14,
        backupEnabled: true,
        backupFrequency: 'daily',
        notificationsEnabled: false,
        notificationEmail: ''
      }
    };
  } catch (error) {
    logger.error('Error getting system settings:', error);
    return null;
  }
}

// Export functions
export {
  initializeDatabase,
  closeDatabase,
  getConnection,
  
  // User management
  getUserById,
  getUserByEmail,
  getAllUsers,
  createUser,
  updateUserStatus,
  updateLastLogin,
  updateUserProfile,
  changeUserPassword,
  deleteUser,
  checkEmailExists,
  setupTwoFactorAuth,
  toggleTwoFactorAuth,
  
  // Bot management
  createBot,
  getAllBots,
  getBotById,
  updateBot,
  deleteBot,
  getActiveBots,
  updateBotStatus,
  
  // Stats and interactions
  createTicket,
  logInteraction,
  storeLead,
  getReputation,
  addReputation,
  getBotUsageStats,
  
  // Settings
  getUserSettings,
  saveUserSettings,
  getSystemSettings,
  saveSystemSettings,
  
  // Analytics
  getAnalyticalData,
  getRecentActivity,
  updateTicket,
  getTickets,
  getBotLogs,
  updateBotConfig,
  getDashboardSummary,
  getDailyActiveUsers
};