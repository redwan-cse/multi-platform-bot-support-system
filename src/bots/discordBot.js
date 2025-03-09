/**
 * Standard Discord Bot
 * 
 * This bot implements basic slash commands for auto-reply and lead collection.
 * Commands:
 * - /help: Displays available commands
 * - /ticket: Creates a support ticket and logs the interaction
 */
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import logger from '../utils/logging.js';
import * as dbUtils from '../utils/dbUtils.js';

class DiscordBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
      ]
    });
    
    this.commands = [
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands'),
      new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option => 
          option.setName('issue')
            .setDescription('Describe your issue')
            .setRequired(true))
    ];
  }
  
  async registerCommands() {
    try {
      logger.info('Registering slash commands for Discord bot');
      
      const rest = new REST({ version: '10' }).setToken(this.config.token);
      
      await rest.put(
        Routes.applicationGuildCommands(this.client.application.id || this.config.clientId, this.config.guildId),
        { body: this.commands }
      );
      
      logger.info('Successfully registered slash commands');
    } catch (error) {
      logger.error('Error registering slash commands:', error);
    }
  }
  
  async start() {
    try {
      // Register event handlers
      this.client.on('ready', () => {
        logger.info(`Discord bot logged in as ${this.client.user.tag}`);
        this.registerCommands();
      });
      
      this.client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;
        
        try {
          const { commandName } = interaction;
          
          if (commandName === 'help') {
            await this.handleHelpCommand(interaction);
          } else if (commandName === 'ticket') {
            await this.handleTicketCommand(interaction);
          }
        } catch (error) {
          logger.error('Error handling command:', error);
          await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true
          });
        }
      });
      
      // Login to Discord
      await this.client.login(this.config.token);
      logger.info('Discord bot started successfully');
    } catch (error) {
      logger.error('Error starting Discord bot:', error);
      throw error;
    }
  }
  
  async stop() {
    try {
      if (this.client) {
        this.client.destroy();
        logger.info('Discord bot stopped');
      }
    } catch (error) {
      logger.error('Error stopping Discord bot:', error);
    }
  }
  
  async handleHelpCommand(interaction) {
    const embed = {
      color: 0x0099ff,
      title: 'Available Commands',
      description: 'Here are the commands you can use:',
      fields: [
        {
          name: '/help',
          value: 'Shows this help message'
        },
        {
          name: '/ticket',
          value: 'Creates a support ticket'
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Bot Support System'
      }
    };
    
    await interaction.reply({ embeds: [embed] });
    
    // Log the interaction
    await dbUtils.logInteraction({
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      command: 'help',
      timestamp: new Date()
    });
  }
  
  async handleTicketCommand(interaction) {
    const issue = interaction.options.getString('issue');
    const ticketId = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit ticket number
    
    // Store the ticket in the database
    await dbUtils.createTicket({
      ticketId: `DISC-${ticketId}`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      issue: issue,
      status: 'open',
      createdAt: new Date()
    });
    
    // Reply to the user
    await interaction.reply({
      content: `Your ticket has been created! Ticket ID: DISC-${ticketId}`,
      ephemeral: true
    });
    
    // Send a DM with support instructions
    try {
      await interaction.user.send({
        embeds: [{
          color: 0x0099ff,
          title: `Ticket Created: DISC-${ticketId}`,
          description: `Thank you for submitting a ticket. Our support team will review your issue: "${issue}"`,
          fields: [
            {
              name: 'What happens next?',
              value: 'A support representative will contact you soon. Please keep this ticket ID for reference.'
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Bot Support System'
          }
        }]
      });
    } catch (error) {
      logger.error('Error sending DM to user:', error);
      await interaction.followUp({
        content: 'I couldn\'t send you a DM with the ticket details. Please make sure your DMs are open.',
        ephemeral: true
      });
    }
    
    // Log the interaction
    await dbUtils.logInteraction({
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      command: 'ticket',
      details: { ticketId: `DISC-${ticketId}`, issue },
      timestamp: new Date()
    });
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
    
    logger.info(`Successfully retrieved Discord bot configuration from database for bot: ${botName} (${botId})`);
    
    // Validate that we have required token
    if (!botConfig.token) {
      throw new Error('Bot configuration is missing required token');
    }
    
    logger.info(`Starting Discord bot process for bot: ${botName} (${botId})`);
    
    // Create and start the bot instance
    const bot = new DiscordBot(botConfig);
    
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
    logger.error('Failed to initialize Discord bot:', error);
    process.exit(1);
  }
};

// Run the initialization function
initializeBot().catch(err => {
  logger.error('Fatal error during Discord bot initialization:', err);
  process.exit(1);
});

// ES module export
export default DiscordBot;