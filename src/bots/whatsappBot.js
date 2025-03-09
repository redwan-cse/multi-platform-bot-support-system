/**
 * WhatsApp Bot
 * 
 * This bot implements auto-reply functionality and lead collection.
 */
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from '../utils/logging.js';
import * as dbUtils from '../utils/dbUtils.js';

class WhatsAppBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: config.clientId || 'bot-support-system' }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
  }
  
  async start() {
    try {
      // Set up event handlers
      this.client.on('qr', (qr) => {
        logger.info('WhatsApp QR code received. Scan with your phone to authenticate.');
        qrcode.generate(qr, { small: true });
      });
      
      this.client.on('ready', () => {
        logger.info('WhatsApp bot is ready');
      });
      
      this.client.on('authenticated', () => {
        logger.info('WhatsApp bot authenticated');
      });
      
      this.client.on('auth_failure', (msg) => {
        logger.error('WhatsApp authentication failed:', msg);
      });
      
      this.client.on('message', this.handleMessage.bind(this));
      
      // Initialize the client
      await this.client.initialize();
      logger.info('WhatsApp bot started successfully');
      
      return this.client;
    } catch (error) {
      logger.error('Error starting WhatsApp bot:', error);
      throw error;
    }
  }
  
  async stop() {
    try {
      if (this.client) {
        await this.client.destroy();
        logger.info('WhatsApp bot stopped');
      }
    } catch (error) {
      logger.error('Error stopping WhatsApp bot:', error);
    }
  }
  
  async handleMessage(message) {
    try {
      // Ignore messages from groups and non-text messages
      if (message.isGroupMsg || !message.body) {
        return;
      }
      
      const content = message.body.toLowerCase();
      const chat = await message.getChat();
      const contact = await message.getContact();
      const username = contact.pushname || 'WhatsApp User';
      
      // Simple keyword-based auto-replies
      if (content.includes('hello') || content.includes('hi')) {
        await chat.sendMessage('Hello! How can I help you today?');
      } else if (content.includes('help')) {
        await this.sendHelpMessage(chat);
      } else if (content.includes('ticket') || content.includes('support')) {
        await this.createTicket(chat, message, username);
      } else if (content.includes('contact') || content.includes('email')) {
        await chat.sendMessage('You can contact our support team at support@example.com');
      } else {
        // Default response
        await chat.sendMessage('I\'m an automated assistant. I can help with support tickets and general inquiries. Type "help" to see what I can do!');
      }
      
      // Log the interaction and collect lead information
      await this.logInteraction(message.from, username, content);
    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
    }
  }
  
  async sendHelpMessage(chat) {
    const helpText = `
Here's how I can help you:
• Send "ticket" followed by your issue to create a support ticket
• Send "contact" to get our contact information
• Send "help" to see this message again
What would you like to do?
    `;
    
    await chat.sendMessage(helpText);
  }
  
  async createTicket(chat, message, username) {
    try {
      // Extract the issue from the message
      const issue = message.body.replace(/ticket/i, '').trim() || 'No issue specified';
      
      // Generate a ticket ID
      const ticketId = Math.floor(1000 + Math.random() * 9000);
      
      // Store the ticket in the database
      await dbUtils.createTicket({
        ticketId: `WA-${ticketId}`,
        userId: message.from,
        username: username,
        platform: 'WhatsApp',
        issue: issue,
        status: 'open',
        createdAt: new Date()
      });
      
      // Reply to the user
      await chat.sendMessage(`
Your ticket has been created!
Ticket ID: WA-${ticketId}
Issue: ${issue}
Our support team will get back to you soon. Please keep this ticket ID for reference.
      `);
      
      // Log the interaction with ticket details
      await this.logInteraction(message.from, username, message.body, { ticketId: `WA-${ticketId}`, issue });
    } catch (error) {
      logger.error('Error creating ticket:', error);
      await chat.sendMessage('Sorry, there was an error creating your ticket. Please try again later.');
    }
  }
  
  async logInteraction(userId, username, message, details = {}) {
    try {
      // Log the interaction
      await dbUtils.logInteraction({
        userId,
        username,
        platform: 'WhatsApp',
        command: 'message',
        details: { ...details, message },
        timestamp: new Date()
      });
      
      // Store lead information
      await dbUtils.storeLead({
        userId,
        username,
        platform: 'WhatsApp',
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
    
    logger.info(`Successfully retrieved WhatsApp bot configuration from database for bot: ${botName} (${botId})`);
    
    logger.info(`Starting WhatsApp bot process for bot: ${botName} (${botId})`);
    
    // Create and start the bot instance
    const bot = new WhatsAppBot(botConfig);
    
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
    logger.error('Failed to initialize WhatsApp bot:', error);
    process.exit(1);
  }
};

// Run the initialization function
initializeBot().catch(err => {
  logger.error('Fatal error during WhatsApp bot initialization:', err);
  process.exit(1);
});

// ES module export
export default WhatsAppBot;