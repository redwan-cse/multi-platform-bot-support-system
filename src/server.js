/**
 * Main Server
 * 
 * This is the entry point for the application server.
 */

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import * as db from './utils/dbUtils.js';
import logger from './utils/logging.js';
import apiRouter from './api/apiRouter.js';

// Load environment variables
dotenv.config();

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
const httpServer = createServer(app);

// Set port
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ 
  contentSecurityPolicy: false // Disable CSP in development
})); 

// Configure CORS to allow requests from the React dev server
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // Default: 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // Default: 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// API routes
app.use('/api', apiRouter);

// Debug route to verify server is working
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// In development mode, redirect to the Vite dev server
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.redirect('http://localhost:5173');
  });
}

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // In development, handle all other routes with a redirect to the Vite dev server
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.redirect(`http://localhost:5173${req.path}`);
    } else {
      res.status(404).send('API endpoint not found');
    }
  });
}

// Bot manager
const bots = new Map();

async function startBot(bot) {
  try {
    logger.info(`Starting bot: ${bot.name} (${bot.platform})`);
    
    let botProcess;
    
    switch (bot.platform) {
      case 'Discord':
        if (bot.type === 'Standard') {
          const DiscordBot = await import('./bots/discordBot.js');
          const discordBot = new DiscordBot.default(bot.config);
          await discordBot.start();
          botProcess = discordBot;
        } else if (bot.type === 'Moderation') {
          const DiscordModBot = await import('./bots/discordModBot.js');
          const discordModBot = new DiscordModBot.default(bot.config);
          await discordModBot.start();
          botProcess = discordModBot;
        }
        break;
      
      case 'Telegram':
        const TelegramBot = await import('./bots/telegramBot.js');
        const telegramBot = new TelegramBot.default(bot.config);
        await telegramBot.start();
        botProcess = telegramBot;
        break;
      
      case 'WhatsApp':
        const WhatsAppBot = await import('./bots/whatsappBot.js');
        const whatsappBot = new WhatsAppBot.default(bot.config);
        await whatsappBot.start();
        botProcess = whatsappBot;
        break;
      
      case 'Messenger':
        const MessengerBot = await import('./bots/messengerBot.js');
        const messengerBot = new MessengerBot.default(bot.config);
        await messengerBot.start();
        botProcess = messengerBot;
        break;
      
      case 'Instagram':
        const InstagramBot = await import('./bots/instagramBot.js');
        const instagramBot = new InstagramBot.default(bot.config);
        await instagramBot.start();
        botProcess = instagramBot;
        break;
      
      default:
        throw new Error(`Unsupported platform: ${bot.platform}`);
    }
    
    // Store bot process
    bots.set(bot.id, botProcess);
    
    // Update bot status
    await db.updateBotStatus(bot.id, 'online');
    
    logger.info(`Bot started: ${bot.name} (${bot.platform})`);
  } catch (error) {
    logger.error(`Error starting bot ${bot.name}:`, error);
    await db.updateBotStatus(bot.id, 'error');
  }
}

async function stopBot(botId) {
  try {
    const botProcess = bots.get(botId);
    
    if (botProcess) {
      await botProcess.stop();
      bots.delete(botId);
      await db.updateBotStatus(botId, 'offline');
      logger.info(`Bot stopped: ${botId}`);
    }
  } catch (error) {
    logger.error(`Error stopping bot ${botId}:`, error);
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await db.initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API available at http://localhost:${PORT}/api`);
      logger.info(`Frontend dev server running at http://localhost:5173`);
    });
    
    // Start active bots
    const activeBots = await db.getActiveBots();
    if (activeBots && activeBots.length > 0) {
      logger.info(`Starting ${activeBots.length} active bots...`);
      
      for (const bot of activeBots) {
        await startBot(bot);
      }
    }
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      // Stop all bots
      for (const [botId] of bots) {
        await stopBot(botId);
      }
      
      // Close database connection
      await db.closeDatabase();
      
      // Close server
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing
export {
  app,
  httpServer,
  startBot,
  stopBot
};