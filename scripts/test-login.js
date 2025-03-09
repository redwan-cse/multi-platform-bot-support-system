/**
 * Login Test Script
 * 
 * Simple standalone script to test the password verification
 * without having to go through the web interface.
 */

import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Database path
const dbPath = path.join(projectRoot, 'data', 'database.sqlite');

// Fixed, known-good bcrypt hash for "Password123"
const KNOWN_GOOD_HASH = '$2b$10$dwJkM5QRuLCQc4JiLNxQ.eiVN3XyO5j5mEU7EPj1U3jxDdxzDmuTy';

// Test credentials
const EMAIL = 'admin@redwan.work';
const PASSWORD = "Password123";

console.log('Running login test with standard bcrypt verification...');
console.log(`Database path: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found!');
  process.exit(1);
}

// First step: Reset the admin password to a known good hash
const db = new sqlite3.Database(dbPath);

// 1. First make sure we're using the known good hash
db.run('UPDATE users SET password = ? WHERE email = ?', 
  [KNOWN_GOOD_HASH, EMAIL], 
  function(err) {
    if (err) {
      console.error('Error updating password:', err);
      db.close();
      process.exit(1);
    }
    
    console.log(`Password reset to known hash (${this.changes} records updated)`);
    
    // 2. Now test verification using exact same parameters as login endpoint
    db.get('SELECT * FROM users WHERE email = ?', [EMAIL], async (err, user) => {
      if (err) {
        console.error('Error retrieving user:', err);
        db.close();
        process.exit(1);
      }
      
      if (!user) {
        console.error('User not found!');
        db.close();
        process.exit(1);
      }
      
      console.log('User found:');
      console.log({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });
      
      try {
        // Test verification
        console.log('Testing bcrypt.compare with password and hash:');
        console.log('Password:', PASSWORD);
        console.log('Hash:', user.password.substring(0, 20) + '...');
        
        // Generate a new hash for the password (to compare formats)
        const newHash = await bcrypt.hash(PASSWORD, 10);
        console.log('Newly generated hash:', newHash.substring(0, 20) + '...');
        
        // Perform the verification
        const isValid = await bcrypt.compare(PASSWORD, user.password);
        console.log('\nPassword verification result:', isValid);
        
        if (isValid) {
          console.log('\n✅ SUCCESS: Password verification works correctly');
        } else {
          console.log('\n❌ ERROR: Password verification failed');
          
          // Try with a hardcoded string comparison as a fallback
          if (user.password === KNOWN_GOOD_HASH) {
            console.log('   - But direct string comparison of hashes succeeded');
            console.log('   - This suggests a potential bcrypt implementation issue');
          } else {
            console.log('   - Direct string comparison of hashes also failed');
            console.log('   - Hash in DB may be corrupted or different than expected');
          }
        }
      } catch (error) {
        console.error('Error during bcrypt verification:', error);
      } finally {
        db.close();
      }
    });
  }
);