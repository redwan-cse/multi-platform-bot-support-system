/**
 * Telegram Bot
 * 
 * This bot implements auto-reply functionality, lead collection, and support ticket creation.
 * Features include:
 * - Test command to verify bot status
 * - Command handling for various user requests
 * - Interactive keyboard for common actions
 * - FAQ responses
 * - Lead tracking and interaction logging
 */
import { Telegraf, Markup } from 'telegraf';
import logger from '../utils/logging.js';
import * as dbUtils from '../utils/dbUtils.js';

class TelegramBot {
  constructor(config) {
    this.config = config;
    this.bot = new Telegraf(config.apiKey || config.token);
    this.startTime = Date.now();
    this.messageCount = 0;
    this.commandCount = 0;
    
    // Log successful initialization
    logger.info('Telegram bot initialized with configuration', { 
      platform: 'Telegram',
      hasToken: Boolean(config.apiKey || config.token)
    });
  }
  
  // Register available commands with Telegram
  async registerCommands() {
    try {
      // Define commands
      const commands = [
        { command: 'start', description: 'Start the bot and get welcome message' },
        { command: 'help', description: 'Show available commands and help' },
        { command: 'test', description: 'Test if the bot is working properly' },
        { command: 'status', description: 'Show bot status and uptime' },
        { command: 'ticket', description: 'Create a support ticket' },
        { command: 'faq', description: 'Show frequently asked questions' }
      ];
      
      // Register commands both globally and for the current chat
      logger.info('Registering Telegram bot commands...');
      
      // Set commands globally for all chats
      await this.bot.telegram.setMyCommands(commands);
      
      // Also try to set commands for private chats specifically
      // This makes commands more visible in the command menu
      try {
        await this.bot.telegram.setMyCommands(commands, {
          scope: { type: 'all_private_chats' }
        });
      } catch (err) {
        // This is optional and might not be supported by older bot tokens
        logger.warn('Could not set private chat commands, continuing anyway:', err.message);
      }
      
      logger.info('Telegram bot commands registered successfully');
    } catch (error) {
      logger.error('Failed to register Telegram bot commands:', error);
      // Just log the error, don't throw, so the bot can still function
    }
  }
  
  async start() {
    try {
      // Enhanced logging
      logger.info('Setting up Telegram bot command handlers...');
      
      // Debug logging for the /start command
      this.bot.command('start', async (ctx) => {
        try {
          logger.info(`/start command received from user ${ctx.from.id} (${ctx.from.username || 'unknown'})`);
          await this.handleStartCommand(ctx);
        } catch (error) {
          logger.error(`Error in /start command handler: ${error.message}`, error);
          try {
            // Attempt to send an error message to the user
            await ctx.reply('Sorry, I encountered an error while processing your command. Please try again later.');
          } catch (replyError) {
            logger.error('Could not send error message to user:', replyError);
          }
        }
      });
      
      this.bot.help(this.handleHelpCommand.bind(this));
      
      // Explicitly register test command handler
      this.bot.command('test', async (ctx) => {
        try {
          this.commandCount++;
          logger.info('Test command received from user', { userId: ctx.from.id });
          await ctx.reply('✅ Bot is up and running! Connection to the server is working properly.');
          await this.logInteraction(ctx, 'test');
        } catch (error) {
          logger.error(`Error in /test command handler: ${error.message}`, error);
          try {
            await ctx.reply('Sorry, I encountered an error while processing your test command.');
          } catch (replyError) {
            logger.error('Could not send error message to user:', replyError);
          }
        }
      });
      
      this.bot.command('ticket', this.handleTicketCommand.bind(this));
      this.bot.command('status', this.handleStatusCommand.bind(this));
      this.bot.command('faq', this.handleFaqCommand.bind(this));
      
      // Handle callback queries (button presses)
      this.bot.action(/faq_(.+)/, this.handleFaqCallback.bind(this));
      
      // Handle text messages
      this.bot.on('text', this.handleTextMessage.bind(this));
      
      // Handle errors - enhance with more details
      this.bot.catch((err, ctx) => {
        const updateType = ctx ? ctx.updateType : 'unknown';
        const userId = ctx && ctx.from ? ctx.from.id : 'unknown';
        logger.error(`Telegram bot error for ${updateType} from user ${userId}:`, err);
      });
      
      // Log startup
      logger.info('Launching Telegram bot in polling mode...');
      
      // Start the bot with more configuration details
      await this.bot.launch({
        allowedUpdates: ['message', 'callback_query'],
        dropPendingUpdates: true
      });
      
      logger.info('Telegram bot started successfully');
      
      // IMPORTANT: Register commands after bot is launched and authenticated
      // This ensures the bot has the necessary permissions to register commands
      await this.registerCommands();
      
      return this.bot;
    } catch (error) {
      logger.error('Error starting Telegram bot:', error);
      throw error;
    }
  }
  
  async stop() {
    try {
      // Stop the bot
      this.bot.stop('SIGINT');
      logger.info('Telegram bot stopped');
    } catch (error) {
      logger.error('Error stopping Telegram bot:', error);
    }
  }
  
  async handleStartCommand(ctx) {
    try {
      this.commandCount++;
      logger.info(`Processing /start command for user ${ctx.from.id}`);
      
      const message = `👋 Welcome to our support bot!\n\nI can help you with various tasks. Use /help to see available commands or press one of the buttons below.`;
      
      // Create a keyboard with common actions
      await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback('📚 FAQ', 'faq_list')],
        [Markup.button.callback('🎫 Create ticket', 'faq_ticket')],
        [Markup.button.callback('📊 Bot status', 'faq_status')]
      ]));
      
      logger.info(`Sent welcome message to user ${ctx.from.id}`);
      
      // Log the interaction and collect lead information
      try {
        await this.logInteraction(ctx, 'start');
        logger.info(`Logged start interaction for user ${ctx.from.id}`);
      } catch (dbError) {
        logger.error(`Failed to log interaction for user ${ctx.from.id}:`, dbError);
        // Continue execution even if logging fails
      }
      
      logger.info(`Successfully completed /start command handling for user ${ctx.from.id}`);
    } catch (error) {
      logger.error(`Error handling start command from user ${ctx.from?.id || 'unknown'}:`, error);
      // Try to send a basic error message if possible
      try {
        await ctx.reply('Sorry, I encountered an error while processing your command. Please try again later.');
      } catch (replyError) {
        // Nothing more we can do if this fails too
        logger.error('Could not send error message to user:', replyError);
      }
    }
  }
  
  async handleHelpCommand(ctx) {
    try {
      this.commandCount++;
      const message = `
📋 Available commands:
/start - Start the bot and show welcome message
/help - Show this help message
/test - Test if the bot is working
/status - Show bot uptime and statistics
/ticket [issue] - Create a support ticket
/faq - Show frequently asked questions

You can also just send me a message, and I'll try to help!
      `;
      await ctx.reply(message);
      
      // Log the interaction
      await this.logInteraction(ctx, 'help');
    } catch (error) {
      logger.error('Error handling help command:', error);
    }
  }
  
  async handleStatusCommand(ctx) {
    try {
      this.commandCount++;
      
      // Calculate uptime
      const uptime = this.calculateUptime();
      
      // Generate status message
      const message = `
🤖 Bot Status Report:
✅ Status: Online and operational
⏱ Uptime: ${uptime}
📊 Messages processed: ${this.messageCount}
🔢 Commands executed: ${this.commandCount}

Server time: ${new Date().toLocaleString()}
      `;
      
      await ctx.reply(message);
      
      // Log the interaction
      await this.logInteraction(ctx, 'status');
    } catch (error) {
      logger.error('Error handling status command:', error);
    }
  }
  
  async handleFaqCommand(ctx) {
    try {
      this.commandCount++;
      
      await ctx.reply('📚 Frequently Asked Questions', Markup.inlineKeyboard([
        [Markup.button.callback('How do I create a ticket?', 'faq_howticket')],
        [Markup.button.callback('What can this bot do?', 'faq_botcapabilities')],
        [Markup.button.callback('How to contact support?', 'faq_contact')],
        [Markup.button.callback('Where is documentation?', 'faq_docs')]
      ]));
      
      // Log the interaction
      await this.logInteraction(ctx, 'faq');
    } catch (error) {
      logger.error('Error handling FAQ command:', error);
    }
  }
  
  async handleFaqCallback(ctx) {
    try {
      // Extract the FAQ topic from the callback data
      const topic = ctx.match[1];
      
      let response = '';
      
      switch (topic) {
        case 'list':
          return this.handleFaqCommand(ctx);
        
        case 'ticket':
          response = 'To create a ticket, use the /ticket command followed by your issue description. For example: /ticket Need help with login';
          break;
        
        case 'howticket':
          response = 'To create a ticket, use the /ticket command followed by your issue description. For example: /ticket Need help with login';
          break;
        
        case 'botcapabilities':
          response = 'This bot can help with creating support tickets, answering common questions, and connecting you with our support team. Try using commands like /help, /status, or just ask me a question!';
          break;
        
        case 'contact':
          response = 'You can reach our support team by creating a ticket using the /ticket command, or by emailing support@example.com. Our working hours are Monday to Friday, 9 AM - 5 PM EST.';
          break;
        
        case 'docs':
          response = 'Our documentation is available at https://docs.example.com. You can find user guides, API documentation, and troubleshooting tips there.';
          break;
        
        case 'status':
          return this.handleStatusCommand(ctx);
        
        default:
          response = 'I don\'t have information on that topic yet. Please try another option or contact support.';
      }
      
      await ctx.reply(response);
      
      // Log the interaction
      await this.logInteraction(ctx, 'faq_callback', { topic });
      
    } catch (error) {
      logger.error('Error handling FAQ callback:', error);
    }
  }
  
  async handleTicketCommand(ctx) {
    try {
      this.commandCount++;
      // Extract the issue from the message text
      const messageText = ctx.message.text;
      const issue = messageText.replace('/ticket', '').trim() || 'No issue specified';
      
      // Generate a ticket ID
      const ticketId = Math.floor(1000 + Math.random() * 9000);
      
      // Store the ticket in the database
      await dbUtils.createTicket({
        ticketId: `TG-${ticketId}`,
        userId: ctx.from.id.toString(),
        username: ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim(),
        platform: 'Telegram',
        issue: issue,
        status: 'open',
        priority: this.determinePriority(issue),
        createdAt: new Date().toISOString()
      });
      
      // Reply to the user
      await ctx.reply(`
✅ Your ticket has been created!
🎫 Ticket ID: TG-${ticketId}
📝 Issue: ${issue}
⏱ Status: Open

Our support team will get back to you soon. Please keep this ticket ID for reference.
      `);
      
      // Log the interaction
      await this.logInteraction(ctx, 'ticket', { ticketId: `TG-${ticketId}`, issue });
    } catch (error) {
      logger.error('Error handling ticket command:', error);
      await ctx.reply('Sorry, there was an error creating your ticket. Please try again later.');
    }
  }
  
  async handleTextMessage(ctx) {
    try {
      this.messageCount++;
      const message = ctx.message.text.toLowerCase();
      let responded = false;
      
      // More sophisticated keyword-based auto-replies
      if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        const username = ctx.from.first_name || 'there';
        await ctx.reply(`Hello ${username}! How can I help you today?`);
        responded = true;
      } else if (message.includes('help') || message.includes('assist')) {
        await this.handleHelpCommand(ctx);
        responded = true;
      } else if (message.includes('ticket') || message.includes('support') || message.includes('issue')) {
        await ctx.reply('Need help? Create a support ticket with the /ticket command followed by your issue.');
        responded = true;
      } else if (message.includes('contact') || message.includes('email') || message.includes('phone')) {
        await ctx.reply('You can contact our support team at support@example.com or call us at +1-555-123-4567.');
        responded = true;
      } else if (message.includes('status') || message.includes('uptime') || message.includes('online')) {
        await this.handleStatusCommand(ctx);
        responded = true;
      } else if (message.includes('faq') || message.includes('question')) {
        await this.handleFaqCommand(ctx);
        responded = true;
      } else if (message.includes('test') || message.includes('working') || message.includes('alive')) {
        // Direct test message handling
        await ctx.reply('✅ Bot is up and running! Connection to the server is working properly.');
        await this.logInteraction(ctx, 'test');
        responded = true;
      } else if (message.includes('thank') || message.includes('thanks')) {
        await ctx.reply('You\'re welcome! Is there anything else I can help you with?');
        responded = true;
      } else if (message.includes('bye') || message.includes('goodbye')) {
        await ctx.reply('Goodbye! Feel free to message again if you need anything else.');
        responded = true;
      } else if (!responded) {
        // Default response with suggested actions
        await ctx.reply('I\'m not sure how to respond to that. Here are some things I can help with:', 
          Markup.inlineKeyboard([
            [Markup.button.callback('📚 FAQ', 'faq_list')],
            [Markup.button.callback('🎫 Create ticket', 'faq_ticket')],
            [Markup.button.callback('📊 Bot status', 'faq_status')]
          ])
        );
      }
      
      // Log the interaction and collect lead information
      await this.logInteraction(ctx, 'text_message', { message: ctx.message.text });
    } catch (error) {
      logger.error('Error handling text message:', error);
    }
  }
  
  async logInteraction(ctx, type, details = {}) {
    try {
      // Extract user information
      const userId = ctx.from.id.toString();
      const username = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
      
      logger.info(`Logging ${type} interaction for user ${userId}`);
      
      // Log the interaction
      try {
        await dbUtils.logInteraction({
          userId,
          username,
          platform: 'Telegram',
          command: type,
          details,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Failed to log interaction in database: ${error.message}`, error);
        // Continue execution even if this specific operation fails
      }
      
      // Store lead information
      try {
        await dbUtils.storeLead({
          userId,
          username,
          platform: 'Telegram',
          source: type,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Failed to store lead in database: ${error.message}`, error);
        // Continue execution even if this specific operation fails
      }
      
      // Add reputation points based on interaction type
      const points = this.getReputationPoints(type);
      if (points > 0) {
        try {
          await dbUtils.addReputation(userId, points, 'bot');
        } catch (error) {
          logger.error(`Failed to add reputation points: ${error.message}`, error);
          // Continue execution even if this specific operation fails
        }
      }
    } catch (error) {
      logger.error('Error in logInteraction method:', error);
      // Don't throw the error up to avoid breaking the command handling
    }
  }
  
  // Determine priority based on keywords in the issue
  determinePriority(issue) {
    const lowercaseIssue = issue.toLowerCase();
    
    if (
      lowercaseIssue.includes('urgent') || 
      lowercaseIssue.includes('emergency') || 
      lowercaseIssue.includes('critical') ||
      lowercaseIssue.includes('immediately')
    ) {
      return 'high';
    } else if (
      lowercaseIssue.includes('problem') ||
      lowercaseIssue.includes('error') || 
      lowercaseIssue.includes('broken') ||
      lowercaseIssue.includes('not working')
    ) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  // Calculate bot uptime in human-readable format
  calculateUptime() {
    const uptimeMs = Date.now() - this.startTime;
    
    const seconds = Math.floor((uptimeMs / 1000) % 60);
    const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
    const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    
    let uptime = '';
    if (days > 0) uptime += `${days} day${days > 1 ? 's' : ''} `;
    if (hours > 0) uptime += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0) uptime += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    if (seconds > 0) uptime += `${seconds} second${seconds > 1 ? 's' : ''}`;
    
    return uptime.trim();
  }
  
  // Reputation points for different interaction types
  getReputationPoints(type) {
    switch (type) {
      case 'ticket':
        return 10;
      case 'start':
        return 5;
      case 'help':
      case 'status':
      case 'faq':
      case 'test':
        return 2;
      case 'text_message':
        return 1;
      default:
        return 0;
    }
  }
}

// Enhanced initialization code to run when this script is executed directly
// This will read configuration from the database
const initializeBot = async () => {
  try {
    let botConfig;
    let botId;
    let botName;
    
    // Get the bot ID from command arguments or the script filename
    // For example, if the script is run as "node telegramBot.js 12345" or the ID is in the filename
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
    
    logger.info(`Successfully retrieved Telegram bot configuration from database for bot: ${botName} (${botId})`);
    
    // Validate that we have a token or API key
    if (!botConfig.token && !botConfig.apiKey) {
      throw new Error('Bot configuration is missing required token or apiKey');
    }
    
    logger.info(`Starting Telegram bot process for bot: ${botName} (${botId})`);
    
    // Create and start the bot instance
    const bot = new TelegramBot(botConfig);
    
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
    logger.error('Failed to initialize Telegram bot:', error);
    process.exit(1);
  }
};

// Run the initialization function
initializeBot().catch(err => {
  logger.error('Fatal error during Telegram bot initialization:', err);
  process.exit(1);
});

// ES module export
export default TelegramBot;