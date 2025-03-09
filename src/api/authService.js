/**
 * Authentication Service
 * 
 * This module provides authentication functions for the application.
 * It uses JWT for token-based authentication and connects with the database.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import logger from '../utils/logging.js';
import * as dbUtils from '../utils/dbUtils.js';

// User authentication
async function authenticateUser(email, password, dbConnection) {
  try {
    // Find user in database by email
    const user = await dbUtils.getUserByEmail(email, dbConnection);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Check if user is suspended
    if (user.status !== 'active') {
      return { success: false, error: 'This account has been suspended' };
    }
    
    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return { 
        success: false, 
        requiresTwoFactor: true, 
        userId: user.id,
        username: user.username
      };
    }
    
    // Update last login timestamp
    await dbUtils.updateLastLogin(user.id, dbConnection);
    
    // Generate JWT
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    logger.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// Verify two-factor authentication
async function verifyTwoFactor(userId, token, dbConnection) {
  try {
    // Find user in database by id
    const user = await dbUtils.getUserById(userId, dbConnection);
    
    if (!user || !user.twoFactorSecret) {
      return { success: false, error: 'Invalid user or 2FA not set up' };
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 period before/after for clock drift
    });
    
    if (!verified) {
      return { success: false, error: 'Invalid verification code' };
    }
    
    // Update last login timestamp
    await dbUtils.updateLastLogin(user.id, dbConnection);
    
    // Generate JWT
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    logger.error('2FA verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

// Refresh access token using refresh token
async function refreshToken(token, dbConnection) {
  try {
    // Verify refresh token
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key');
    
    // Find user in database by id
    const user = await dbUtils.getUserById(decoded.id, dbConnection);
    
    if (!user) {
      return { success: false, error: 'Invalid refresh token' };
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(user);
    
    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    logger.error('Token refresh error:', error);
    return { success: false, error: 'Token refresh failed' };
  }
}

// Generate access token (short-lived)
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '15m' }
  );
}

// Generate refresh token (long-lived)
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
    { expiresIn: '7d' }
  );
}

// Setup two-factor authentication for a user
async function setupTwoFactor(userId, dbConnection) {
  try {
    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: process.env.APP_NAME || 'Bot Management Dashboard'
    });
    
    // Save the secret to the database
    const success = await dbUtils.setupTwoFactorAuth(userId, secret.base32, dbConnection);
    
    if (!success) {
      return { success: false, error: 'Failed to set up two-factor authentication' };
    }
    
    // Generate QR code URL for scanning with authenticator app
    const qrCodeUrl = secret.otpauth_url;
    
    return { 
      success: true, 
      secretKey: secret.base32,
      qrCodeUrl
    };
  } catch (error) {
    logger.error('Error setting up 2FA:', error);
    return { success: false, error: 'Failed to set up two-factor authentication' };
  }
}

// Enable two-factor authentication for a user after verification
async function enableTwoFactor(userId, token, dbConnection) {
  try {
    // Find user in database by id
    const user = await dbUtils.getUserById(userId, dbConnection);
    
    if (!user || !user.twoFactorSecret) {
      return { success: false, error: 'Invalid user or 2FA not set up' };
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 period before/after for clock drift
    });
    
    if (!verified) {
      return { success: false, error: 'Invalid verification code' };
    }
    
    // Enable 2FA for the user
    const success = await dbUtils.toggleTwoFactorAuth(userId, true, dbConnection);
    
    if (!success) {
      return { success: false, error: 'Failed to enable two-factor authentication' };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error enabling 2FA:', error);
    return { success: false, error: 'Failed to enable two-factor authentication' };
  }
}

// Disable two-factor authentication for a user
async function disableTwoFactor(userId, dbConnection) {
  try {
    const success = await dbUtils.toggleTwoFactorAuth(userId, false, dbConnection);
    
    if (!success) {
      return { success: false, error: 'Failed to disable two-factor authentication' };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    return { success: false, error: 'Failed to disable two-factor authentication' };
  }
}

// Change user password
async function changePassword(userId, currentPassword, newPassword, dbConnection) {
  try {
    // Find user in database by id
    const user = await dbUtils.getUserById(userId, dbConnection);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordMatch) {
      return { success: false, error: 'Current password is incorrect' };
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password in database
    const success = await dbUtils.changeUserPassword(userId, hashedPassword, dbConnection);
    
    if (!success) {
      return { success: false, error: 'Failed to update password' };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error changing password:', error);
    return { success: false, error: 'Failed to change password' };
  }
}

export {
  authenticateUser,
  verifyTwoFactor,
  refreshToken,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  changePassword,
  generateAccessToken,
  generateRefreshToken
};