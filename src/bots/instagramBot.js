/**
 * Instagram Bot
 * 
 * This bot implements auto-reply functionality and lead collection for Instagram DMs.
 * Note: This uses the Facebook Graph API since Instagram messaging is part of the Facebook ecosystem.
 */
import { Botly } from 'botly';
import logger from '../utils/logging.js';
import * as dbUtils from '../utils/dbUtils.js';

class InstagramBot {
  constructor(config) {
    this.config = config;
    this.botly = new Botly({
      accessToken: config.accessToken,
      verifyToken: config.verifyToken,
      webHookPath: config.webHookPath || '/webhook/instagram',
      notificationType: 'REGULAR' // or 'SILENT_PUSH', 'NO_PUSH'
    });
  }
  
  async start() {
    try {
      // Set up event handlers
      this.botly.on('message', this.handleMessage.bind(this));
      
      logger.info('Instagram bot started successfully');
      return this.botly;
    } catch (error) {
      logger.error('Error starting Instagram bot:', error);
      throw error;
    }
  }
  
  async stop() {
    try {
      logger.info('Instagram bot stopped');
      // No specific stop method for Botly
    } catch (error) {
      logger.error('Error stopping Instagram bot:', error);
    }
  }
  
  async handleMessage(sender, message) {
    try {
      // Check if this is an Instagram message
      if (!message.message || !message.message.is_echo === false) {
        return;
      }
      
      // Get message content
      const content = message.message.text ? message.message.text.toLowerCase() : '';
      
      // Simple keyword-based auto-replies
      if (content.includes('hello') || content.includes('hi')) {
        await this.sendTextMessage(sender.id, 'Hello! Thanks for reaching out on Instagram. How can I help you today?');
      } else if (content.includes('help')) {
        await this.sendHelpMessage(sender.id);
      } else if (content.includes('ticket') || content.includes('support')) {
        await this.createTicket(sender.id, content);
      } else if (content.includes('contact') || content.includes('email')) {
        await this.sendTextMessage(sender.id, 'You can contact our support team at support@example.com or DM us here on Instagram.');
      } else {
        // Default response
        await this.sendTextMessage(sender.id, 'Thanks for your message! I\'m an automated assistant. I can help with support tickets and general inquiries. Type "help" to see what I can do!');
      }
      
      // Log the interaction and collect lead information
      await this.logInteraction(sender.id, content);
    } catch (error) {
      logger.error('Error handling Instagram message:', error);
    }
  }
  
  async sendTextMessage(userId, text) {
    return new Promise((resolve, reject) => {
      this.botly.sendText({
        id: userId,
        text: text
      }, (err, data) => {
        if (err) {
          logger.error('Error sending Instagram text message:', err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
  
  async sendHelpMessage(userId) {
    const helpText = `
Here's how I can help you:
• Send "ticket" followed by your issue to create a support ticket
• Send "contact" to get our contact information
• Send "help" to see this message again
What would you like to do?
    `;
    
    return this.sendTextMessage(userId, helpText);
  }
  
  async createTicket(userId, content) {
    try {
      // Extract the issue from the message
      const issue = content.replace('ticket', '').trim() || 'No issue specified';
      
      // Generate a ticket ID
      const ticketId = Math.floor(1000 + Math.random() * 9000);
      
      // Store the ticket in the database
      await dbUtils.createTicket({
        ticketId: `IG-${ticketId}`,
        userId: userId,
        username: 'Instagram User', // We don't have the username from the API
        platform: 'Instagram',
        issue: issue,
        status: 'open',
        createdAt: new Date()
      });
      
      // Reply to the user
      await this.sendTextMessage(userId, `
Your ticket has been created!
Ticket ID: IG-${ticketId}
Issue: ${issue}
Our support team will get back to you soon. Please keep this ticket ID for reference.
      `);
      
      // Log the interaction with ticket details
      await this.logInteraction(userId, content, { ticketId: `IG-${ticketId}`, issue });
    } catch (error) {
      logger.error('Error creating ticket:', error);
      await this.sendTextMessage(userId, 'Sorry, there was an error creating your ticket. Please try again later.');
    }
  }
  
  async logInteraction(userId, message, details = {}) {
    try {
      // Log the interaction
      await dbUtils.logInteraction({
        userId,
        username: 'Instagram User', // We don't have the username from the API
        platform: 'Instagram',
        command: 'message',
        details: { ...details, message },
        timestamp: new Date()
      });
      
      // Store lead information
      await dbUtils.storeLead({
        userId,
        username: 'Instagram User',
        platform: 'Instagram',
        source: 'message',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error logging interaction:', error);
    }
  }
}

// Enhanced initialization code to run when this script is executed directly
// This will read configuration directly from the database
const initializeBot = async () => {
  try {
    let botConfig;
    let botId;
    let botName;
    
    // Get the bot ID from command arguments or the script filename
    const args = process.argv.slice(2);
    const potentialBotId = args[0] || process.env.BOT_ID;
    
    if (!potentialBotId) {
      throw new Error('No bot ID provided. Please provide a bot ID as a command line argument or set BOT_ID environment variable.');
    }
    
    botId = potentialBotId;
    
    // Get database connection
    logger.info(`Attempting to load bot configuration from database for bot ID: ${botId}`);
    const db = await dbUtils.getConnection();
    
    // Get bot details from database
    const botDetails = await dbUtils.getBotById(botId, db);
    
    if (!botDetails) {
      throw new Error(`Bot with ID ${botId} not found in database`);
    }
    
    botName = botDetails.name;
    botConfig = botDetails.config;
    
    logger.info(`Successfully retrieved Instagram bot configuration from database for bot: ${botName} (${botId})`);
    
    // Validate that we have required tokens
    if (!botConfig.accessToken || !botConfig.verifyToken) {
      throw new Error('Bot configuration is missing required accessToken or verifyToken');
    }
    
    logger.info(`Starting Instagram bot process for bot: ${botName} (${botId})`);
    
    // Create and start the bot instance
    const bot = new InstagramBot(botConfig);
    
    // Start the bot
    await bot.start();
    
    // Update status in database to 'online'
    try {
      await dbUtils.updateBotStatus(botId, 'online');
      logger.info(`Updated bot status to 'online' for bot ${botName} (${botId})`);
    } catch (err) {
      logger.error(`Failed to update bot status for ${botName} (${botId}):`, err);
    }
    
    // Handle process termination signals
    process.on('SIGINT', async () => {
      logger.info(`Received SIGINT for bot ${botName} (${botId}), shutting down...`);
      await bot.stop();
      try {
        await dbUtils.updateBotStatus(botId, 'offline');
      } catch (err) {
        logger.error(`Failed to update bot status to 'offline' for ${botName} (${botId}):`, err);
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info(`Received SIGTERM for bot ${botName} (${botId}), shutting down...`);
      await bot.stop();
      try {
        await dbUtils.updateBotStatus(botId, 'offline');
      } catch (err) {
        logger.error(`Failed to update bot status to 'offline' for ${botName} (${botId}):`, err);
      }
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to initialize Instagram bot:', error);
    process.exit(1);
  }
};

// Run the initialization function
initializeBot().catch(err => {
  logger.error('Fatal error during Instagram bot initialization:', err);
  process.exit(1);
});

// ES module export
export default InstagramBot;