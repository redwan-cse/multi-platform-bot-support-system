/**
 * Direct Admin Password Reset Script
 * 
 * A simpler, more direct approach to reset the admin password 
 * with a simpler password that doesn't contain special characters.
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Using a simpler password without special characters
const SIMPLE_PASSWORD = 'Password123';

// Database path
const dbPath = path.join(projectRoot, 'data', 'database.sqlite');

console.log(`Directly resetting admin password in: ${dbPath}`);

// Ensure database file exists
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

// Open the database
const db = new sqlite3.Database(dbPath);

// Generate a new hash for the simpler password
bcrypt.hash(SIMPLE_PASSWORD, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    db.close();
    process.exit(1);
  }
  
  console.log(`Generated new hash for '${SIMPLE_PASSWORD}'`);

  // First check if user exists
  db.get('SELECT * FROM users WHERE email = ?', ['admin@redwan.work'], (err, user) => {
    if (err) {
      console.error('Error checking for user:', err);
      db.close();
      process.exit(1);
    }

    if (user) {
      // Update existing user with new password hash
      console.log('Admin user found, updating password...');
      
      db.run(
        'UPDATE users SET password = ? WHERE email = ?',
        [hash, 'admin@redwan.work'],
        function(err) {
          if (err) {
            console.error('Error updating password:', err);
            db.close();
            process.exit(1);
          }
          console.log(`Admin password reset successfully (${this.changes} record updated)`);
          
          // Verify user still exists and password works
          verifyUser(hash);
        }
      );
    } else {
      // Create new user with new password hash
      console.log('Admin user not found, creating new admin user...');
      
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
      ], function(err) {
        if (err) {
          console.error('Error creating admin user:', err);
          db.close();
          process.exit(1);
        }
        console.log('Admin user created successfully!');
        
        // Verify user was created and password works
        verifyUser(hash);
      });
    }
  });
});

// Verify the user exists and password works
function verifyUser(passwordHash) {
  db.get('SELECT * FROM users WHERE email = ?', ['admin@redwan.work'], (err, user) => {
    if (err) {
      console.error('Error retrieving user:', err);
      db.close();
      process.exit(1);
    }
    
    if (!user) {
      console.error('Admin user not found after update!');
      db.close();
      process.exit(1);
    }
    
    console.log('Admin user verified:');
    console.log({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
    
    // Verify the password hash matches
    bcrypt.compare(SIMPLE_PASSWORD, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error verifying password:', err);
      } else if (isMatch) {
        console.log('\n✅ Password verification succeeded!');
      } else {
        console.error('\n❌ Password verification failed!');
      }
      
      console.log('\nYour admin password is now set to:', SIMPLE_PASSWORD);
      console.log('Please login with email: admin@redwan.work');
      
      db.close();
    });
  });
}