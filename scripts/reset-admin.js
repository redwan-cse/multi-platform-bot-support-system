/**
 * Admin Password Reset Script
 * 
 * This script manually resets the admin password in the database
 * to address character encoding issues with the special characters.
 */

import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__filename));

// Database path
const dbPath = join(projectRoot, 'data', 'database.sqlite');

// Default admin credentials
const defaultPassword = "Password123";

// Ensure database file exists
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

console.log(`Resetting admin password in: ${dbPath}`);

// Open the database
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  try {
    // Generate new password hash
    const saltRounds = 10;
    const hash = await bcrypt.hash(defaultPassword, saltRounds);
    
    // Update admin password
    db.run(
      'UPDATE users SET password = ? WHERE email = ?',
      [hash, 'admin@redwan.work'],
      function(err) {
        if (err) {
          console.error('Error updating password:', err);
          process.exit(1);
        }
        
        if (this.changes === 0) {
          console.log('Admin user not found. Creating new admin user...');
          
          // Create admin user if not exists
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
              process.exit(1);
            }
            console.log('New admin user created successfully!');
            
            // Verify the password hash works
            verifyPassword();
          });
        } else {
          console.log(`Admin password reset successfully (${this.changes} record updated)`);
          
          // Verify the password hash works
          verifyPassword();
        }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});

// Function to verify the password works
function verifyPassword() {
  db.get('SELECT * FROM users WHERE email = ?', ['admin@redwan.work'], async (err, user) => {
    if (err) {
      console.error('Error retrieving user:', err);
      process.exit(1);
    }
    
    if (!user) {
      console.error('User not found after reset!');
      process.exit(1);
    }
    
    try {
      const isValid = await bcrypt.compare(defaultPassword, user.password);
      console.log(`Verification: Password valid = ${isValid}`);
      
      if (!isValid) {
        console.error('Password reset failed: bcrypt verification returned false');
      } else {
        console.log('Password reset and verification successful!');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
    } finally {
      // Close the database connection
      db.close();
    }
  });
}