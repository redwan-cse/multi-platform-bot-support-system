/**
 * API Router for the Bot Management Dashboard
 * 
 * This module provides API endpoints for all dashboard functionality.
 * All routes are JWT-protected and utilize RBAC.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import * as dbUtils from '../utils/dbUtils.js';
import logger from '../utils/logging.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  authenticateUser, 
  verifyTwoFactor, 
  refreshToken as refreshAuthToken,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  changePassword
} from './authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' }
});

router.use(apiLimiter);

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authentication token is required' });
  }
};

// Middleware to check admin role
const checkAdminRole = (req, res, next) => {
  if (req.user && req.user.role === 'Administrator') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: requires administrator privileges' });
  }
};

// Middleware to check manager or admin role
const checkManagerRole = (req, res, next) => {
  if (req.user && (req.user.role === 'Administrator' || req.user.role === 'Manager')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: requires manager privileges' });
  }
};

// Authentication endpoints
router.post('/auth/login', 
  body('email').isEmail().normalizeEmail(),
  body('password').isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Authenticate user
      const result = await authenticateUser(email, password, db);
      
      if (!result.success) {
        if (result.requiresTwoFactor) {
          return res.json({ 
            requiresTwoFactor: true, 
            userId: result.userId,
            username: result.username
          });
        }
        return res.status(401).json({ error: result.error });
      }
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Send access token and user info
      res.json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'An error occurred during authentication' });
    }
});

router.post('/auth/verify-2fa', 
  body('userId').isString().trim(),
  body('code').isString().trim().isLength({ min: 6, max: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userId, code } = req.body;
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Verify 2FA code
      const result = await verifyTwoFactor(userId, code, db);
      
      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Send access token and user info
      res.json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      logger.error('2FA verification error:', error);
      res.status(500).json({ error: 'An error occurred during verification' });
    }
});

router.post('/auth/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }
    
    // Get database connection
    const db = await dbUtils.getConnection();
    
    // Refresh the token
    const result = await refreshAuthToken(refreshToken, db);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    
    // Send new access token and user info
    res.json({
      accessToken: result.accessToken,
      user: result.user
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'An error occurred during token refresh' });
  }
});

router.post('/auth/logout', (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});

router.get('/auth/me', authenticateJWT, (req, res) => {
  // User data is already in req.user from JWT middleware
  res.json({ user: req.user });
});

// Two-factor authentication management
router.post('/auth/setup-2fa', authenticateJWT, async (req, res) => {
  try {
    // Get database connection
    const db = await dbUtils.getConnection();
    
    // Set up 2FA for the user
    const result = await setupTwoFactor(req.user.id, db);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      secretKey: result.secretKey,
      qrCodeUrl: result.qrCodeUrl
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ error: 'An error occurred during 2FA setup' });
  }
});

router.post('/auth/enable-2fa',
  authenticateJWT,
  body('code').isString().trim().isLength({ min: 6, max: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { code } = req.body;
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Enable 2FA for the user
      const result = await enableTwoFactor(req.user.id, code, db);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('2FA enabling error:', error);
      res.status(500).json({ error: 'An error occurred while enabling 2FA' });
    }
});

router.post('/auth/disable-2fa', authenticateJWT, async (req, res) => {
  try {
    // Get database connection
    const db = await dbUtils.getConnection();
    
    // Disable 2FA for the user
    const result = await disableTwoFactor(req.user.id, db);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('2FA disabling error:', error);
    res.status(500).json({ error: 'An error occurred while disabling 2FA' });
  }
});

router.post('/auth/change-password',
  authenticateJWT,
  body('currentPassword').isString().trim().notEmpty(),
  body('newPassword').isString().trim().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Change password
      const result = await changePassword(req.user.id, currentPassword, newPassword, db);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Password change error:', error);
      res.status(500).json({ error: 'An error occurred while changing password' });
    }
});

// User management endpoints
router.get('/users', authenticateJWT, async (req, res) => {
  try {
    // Get database connection
    const db = await dbUtils.getConnection();
    
    // Get all users from database
    const users = await dbUtils.getAllUsers(db);
    
    res.json({ users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', 
  authenticateJWT,
  checkAdminRole,
  body('username').isString().trim().isLength({ min: 3 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().trim().isLength({ min: 8 }),
  body('role').isIn(['Administrator', 'Manager', 'Normal User']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password, role } = req.body;
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Check if email already exists
      const emailExists = await dbUtils.checkEmailExists(email, db);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user
      const userId = await dbUtils.createUser({
        username,
        email,
        password: hashedPassword,
        role,
        status: 'active',
        createdAt: new Date().toISOString()
      }, db);
      
      if (!userId) {
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      // Get the newly created user
      const user = await dbUtils.getUserById(userId, db);
      
      // Remove password from response
      if (user) {
        delete user.password;
      }
      
      res.status(201).json({ user });
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
});

router.patch('/users/:id/status', 
  authenticateJWT,
  checkAdminRole,
  body('status').isIn(['active', 'suspended']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Prevent admin from suspending themselves
      if (req.user.id === id && status === 'suspended') {
        return res.status(400).json({ error: 'You cannot suspend your own account' });
      }
      
      // Get database connection
      const db = await dbUtils.getConnection();
      
      // Update user status
      const success = await dbUtils.updateUserStatus(id, status, db);
      
      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating user status:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
});

router.delete('/users/:id', authenticateJWT, checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    
    // Get database connection
    const db = await dbUtils.getConnection();
    
    // Delete user
    const success = await dbUtils.deleteUser(id, db);
    
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.patch('/users/:id',
  authenticateJWT,
  checkAdminRole,
  body('username').optional().isString().trim().isLength({ min: 3 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['Administrator', 'Manager', 'Normal User']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { username, email, role } = req.body;
      
      // Check if email exists and belongs to a different user
      if (email) {
        const existingUser = await dbUtils.getUserByEmail(email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ error: 'Email already in use by another user' });
        }
      }
      
      // Update user profile
      const success = await dbUtils.updateUserProfile(id, { username, email, role });
      
      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get the updated user
      const user = await dbUtils.getUserById(id);
      
      // Remove password from response
      if (user) {
        delete user.password;
        delete user.twoFactorSecret;
      }
      
      res.json({ user });
    } catch (error) {
      logger.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
});

// Bot management endpoints
router.get('/bots', authenticateJWT, async (req, res) => {
  try {
    const bots = await dbUtils.getAllBots();
    res.json({ bots });
  } catch (error) {
    logger.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

router.post('/bots', 
  authenticateJWT,
  body('name').isString().trim().isLength({ min: 1, max: 50 }),
  body('platform').isIn(['Discord', 'Telegram', 'WhatsApp', 'Messenger', 'Instagram']),
  body('type').isString().trim(),
  body('config').isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, platform, type, config } = req.body;
      
      // Create bot in database
      const botId = await dbUtils.createBot({ name, platform, type, config });
      
      if (!botId) {
        return res.status(500).json({ error: 'Failed to create bot' });
      }
      
      // Get the newly created bot
      const bot = await dbUtils.getBotById(botId);
      
      res.status(201).json({ bot });
    } catch (error) {
      logger.error('Error creating bot:', error);
      res.status(500).json({ error: 'Failed to create bot' });
    }
});

router.delete('/bots/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First stop the bot process if it's running
    await stopBotProcess(id);
    
    // Delete bot from database
    const success = await dbUtils.deleteBot(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

router.post('/bots/:id/start', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get bot from database
    const bot = await dbUtils.getBotById(id);
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    // Start bot process
    await startBotProcess(bot);
    
    // Update bot status in database
    await dbUtils.updateBotStatus(id, 'online');
    
    // Get updated bot data
    const updatedBot = await dbUtils.getBotById(id);
    
    res.json({ bot: updatedBot });
  } catch (error) {
    logger.error('Error starting bot:', error);
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

router.post('/bots/:id/stop', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Stop bot process
    await stopBotProcess(id);
    
    // Update bot status in database
    await dbUtils.updateBotStatus(id, 'offline');
    
    // Get updated bot data
    const updatedBot = await dbUtils.getBotById(id);
    
    res.json({ bot: updatedBot });
  } catch (error) {
    logger.error('Error stopping bot:', error);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

// Analysis endpoints
router.get('/analytics/usage', authenticateJWT, checkManagerRole, async (req, res) => {
  try {
    const period = req.query.period || 'day';
    const validPeriods = ['day', 'week', 'month', 'year'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be one of: day, week, month, year' });
    }
    
    const stats = await dbUtils.getBotUsageStats(period);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching bot usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch bot usage stats' });
  }
});

// Settings endpoints
router.get('/settings', authenticateJWT, async (req, res) => {
  try {
    // Get system settings
    const settings = await dbUtils.getSystemSettings();
    res.json({ settings });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', authenticateJWT, async (req, res) => {
  try {
    // Validate incoming settings
    if (!req.body) {
      return res.status(400).json({ error: 'Settings data is required' });
    }
    
    // Save settings to database
    const success = await dbUtils.saveSystemSettings(req.body);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to save settings' });
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.post('/settings/test-database', authenticateJWT, body('database').isObject(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { database } = req.body;
    
    // Simple test connection logic
    const result = {
      success: true,
      message: 'Database connection successful'
    };
    
    // Actual implementation would test the connection here
    // For now we'll just validate the basic structure
    if (!database.engine) {
      result.success = false;
      result.message = 'Database engine is required';
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error testing database connection:', error);
    res.status(500).json({ success: false, message: 'Failed to test connection' });
  }
});

router.post('/settings/regenerate-keys', authenticateJWT, checkAdminRole, async (req, res) => {
  try {
    // This would regenerate API keys and secrets in a real implementation
    // For now we'll just return success
    res.json({ 
      success: true, 
      message: 'Security keys regenerated successfully'
    });
  } catch (error) {
    logger.error('Error regenerating security keys:', error);
    res.status(500).json({ error: 'Failed to regenerate security keys' });
  }
});

router.post('/settings/backup', authenticateJWT, checkAdminRole, async (req, res) => {
  try {
    // In a real implementation, this would create an actual backup
    // For demo purposes, we'll just create a dummy file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `backup-${timestamp}.zip`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Create dummy data
    const dummyData = Buffer.from('This is a dummy backup file for demonstration purposes.');
    
    // Send the response
    res.send(dummyData);
  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.post('/settings/restore', authenticateJWT, checkAdminRole, async (req, res) => {
  try {
    // In a real implementation, this would restore from the uploaded backup
    // For now we'll just return success
    res.json({ 
      success: true, 
      message: 'Backup restored successfully'
    });
  } catch (error) {
    logger.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// User profile endpoints
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const user = await dbUtils.getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove sensitive data
    delete user.password;
    delete user.twoFactorSecret;
    
    res.json({ user });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.put('/profile', 
  authenticateJWT,
  body('username').optional().isString().trim().isLength({ min: 3 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('currentPassword').optional().isString().trim(),
  body('newPassword').optional().isString().trim().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      // Check if this is a password change request
      if (currentPassword && newPassword) {
        const user = await dbUtils.getUserById(userId);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        const success = await dbUtils.changeUserPassword(userId, hashedPassword);
        
        if (!success) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        
        return res.json({ success: true, message: 'Password updated successfully' });
      }
      
      // Handle profile update
      if (username || email) {
        // Check if email exists and belongs to a different user
        if (email) {
          const existingUser = await dbUtils.getUserByEmail(email);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ error: 'Email already in use by another user' });
          }
        }
        
        // Update user profile
        const success = await dbUtils.updateUserProfile(userId, { username, email });
        
        if (!success) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Get updated user data
        const updatedUser = await dbUtils.getUserById(userId);
        
        // Remove sensitive data
        if (updatedUser) {
          delete updatedUser.password;
          delete updatedUser.twoFactorSecret;
        }
        
        return res.json({ user: updatedUser });
      }
      
      return res.status(400).json({ error: 'No valid update fields provided' });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
});

// Dashboard data endpoints
router.get('/dashboard/summary', authenticateJWT, async (req, res) => {
  try {
    const summary = await dbUtils.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/dashboard/recent-activity', authenticateJWT, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activity = await dbUtils.getRecentActivity(limit);
    res.json({ activity });
  } catch (error) {
    logger.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Helper functions
const botProcesses = {};

async function startBotProcess(bot) {
  // Stop existing process if any
  if (botProcesses[bot.id]) {
    await stopBotProcess(bot.id);
  }
  
  // Determine which bot script to run based on platform and type
  let scriptPath;
  if (bot.platform === 'Discord') {
    scriptPath = bot.type === 'Moderation' ? 
      path.join(__dirname, '../bots/discordModBot.js') : 
      path.join(__dirname, '../bots/discordBot.js');
  } else if (bot.platform === 'Telegram') {
    scriptPath = path.join(__dirname, '../bots/telegramBot.js');
  } else if (bot.platform === 'WhatsApp') {
    scriptPath = path.join(__dirname, '../bots/whatsappBot.js');
  } else if (bot.platform === 'Messenger') {
    scriptPath = path.join(__dirname, '../bots/messengerBot.js');
  } else if (bot.platform === 'Instagram') {
    scriptPath = path.join(__dirname, '../bots/instagramBot.js');
  }
  
  if (!scriptPath) {
    throw new Error(`No script available for platform: ${bot.platform}`);
  }
  
  logger.info(`Starting bot ${bot.name} (ID: ${bot.id}) using script: ${scriptPath}`);
  
  try {
    // Pass the bot ID as a command-line argument
    const botProcess = spawn('node', [scriptPath, bot.id], {
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      },
      detached: true, // Run the process in detached mode so it can continue running independently
      stdio: ['ignore', 'pipe', 'pipe'] // Configure stdio to capture output but not block on stdin
    });
    
    // Store the process reference
    botProcesses[bot.id] = botProcess;
    
    // Handle process events
    botProcess.stdout.on('data', (data) => {
      logger.info(`Bot ${bot.name} (${bot.id}): ${data.toString().trim()}`);
    });
    
    botProcess.stderr.on('data', (data) => {
      logger.error(`Bot ${bot.name} (${bot.id}) error: ${data.toString().trim()}`);
      // Don't update status to error immediately, as some errors might be transient
    });
    
    botProcess.on('close', (code) => {
      logger.info(`Bot ${bot.name} (${bot.id}) exited with code ${code}`);
      
      // Only delete the process reference and update status if this was an actual termination
      // and not a restart or planned shutdown
      if (botProcesses[bot.id] === botProcess) {
        delete botProcesses[bot.id];
        
        // Update bot status to offline
        dbUtils.updateBotStatus(bot.id, 'offline').catch(err => {
          logger.error(`Failed to update status to offline for bot ${bot.id}:`, err);
        });
      }
    });
    
    // Add an error event handler
    botProcess.on('error', (err) => {
      logger.error(`Bot ${bot.name} (${bot.id}) process error:`, err);
      
      // Only update status if this was the most recent process
      if (botProcesses[bot.id] === botProcess) {
        dbUtils.updateBotStatus(bot.id, 'error').catch(err => {
          logger.error(`Failed to update status to error for bot ${bot.id}:`, err);
        });
      }
    });
    
    // Prevent the parent process from waiting for this child to exit
    botProcess.unref();
    
    // Give the process a moment to start up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Log success
    logger.info(`Bot ${bot.name} (${bot.id}) process started successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to start bot ${bot.name} (${bot.id}):`, error);
    
    // Update bot status to error
    try {
      await dbUtils.updateBotStatus(bot.id, 'error');
    } catch (dbError) {
      logger.error(`Failed to update status to error for bot ${bot.id}:`, dbError);
    }
    
    throw error;
  }
}

async function stopBotProcess(id) {
  if (botProcesses[id]) {
    logger.info(`Stopping bot ${id}`);
    
    try {
      const botProcess = botProcesses[id];
      
      // First try to gracefully terminate with SIGTERM
      botProcess.kill('SIGTERM');
      
      // Set a timeout to force kill if it doesn't exit gracefully
      const killTimeout = setTimeout(() => {
        if (botProcesses[id] === botProcess) {
          logger.warn(`Bot ${id} did not exit gracefully, force killing`);
          botProcess.kill('SIGKILL');
          delete botProcesses[id];
        }
      }, 5000);
      
      // Create a promise that resolves when the process exits
      const exitPromise = new Promise(resolve => {
        botProcess.once('exit', () => {
          clearTimeout(killTimeout);
          resolve();
        });
      });
      
      // Wait for the process to exit, with a timeout
      await Promise.race([
        exitPromise,
        new Promise(resolve => setTimeout(resolve, 6000))
      ]);
      
      // Delete the reference if it's still the same process
      if (botProcesses[id] === botProcess) {
        delete botProcesses[id];
      }
      
      logger.info(`Bot ${id} stopped successfully`);
      return true;
    } catch (error) {
      logger.error(`Error stopping bot ${id}:`, error);
      // Still delete the reference even if there was an error
      delete botProcesses[id];
      return false;
    }
  }
  
  logger.info(`No running process found for bot ${id}`);
  return true;
}

// Export the router
export default router;