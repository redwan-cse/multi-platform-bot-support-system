/**
 * Discord Moderation Bot
 * 
 * This bot implements advanced moderation features using slash commands.
 * Commands:
 * - /ticket: Creates a ticket in a support channel and sends a DM with the ticket number
 * - /rep: Allows users to query reputation; only administrators can assign bonus reputation
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logging');
const db = require('../utils/dbUtils');

class DiscordModBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
      ]
    });
    
    this.commands = [
      new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option => 
          option.setName('issue')
            .setDescription('Describe your issue')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('priority')
            .setDescription('Ticket priority')
            .setRequired(false)
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' }
            )),
      new SlashCommandBuilder()
        .setName('rep')
        .setDescription('Reputation system')
        .addSubcommand(subcommand =>
          subcommand
            .setName('me')
            .setDescription('Check your reputation'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('user')
            .setDescription('Check another user\'s reputation')
            .addUserOption(option => 
              option.setName('target')
                .setDescription('The user to check')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add reputation points to a user (Admin only)')
            .addUserOption(option => 
              option.setName('target')
                .setDescription('The user to add points to')
                .setRequired(true))
            .addIntegerOption(option => 
              option.setName('points')
                .setDescription('Number of points to add')
                .setRequired(true)))
    ];
  }
  
  async registerCommands() {
    try {
      logger.info('Registering slash commands for Discord Moderation bot');
      
      const rest = new REST({ version: '10' }).setToken(this.config.token);
      
      await rest.put(
        Routes.applicationGuildCommands(this.config.clientId, this.config.guildId),
        { body: this.commands }
      );
      
      logger.info('Successfully registered slash commands for moderation bot');
    } catch (error) {
      logger.error('Error registering slash commands for moderation bot:', error);
    }
  }
  
  async start() {
    try {
      // Register event handlers
      this.client.on('ready', () => {
        logger.info(`Discord Moderation bot logged in as ${this.client.user.tag}`);
        this.registerCommands();
      });
      
      this.client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;
        
        try {
          const { commandName } = interaction;
          
          if (commandName === 'ticket') {
            await this.handleTicketCommand(interaction);
          } else if (commandName === 'rep') {
            await this.handleRepCommand(interaction);
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
    } catch (error) {
      logger.error('Error starting Discord Moderation bot:', error);
      throw error;
    }
  }
  
  async stop() {
    try {
      if (this.client) {
        this.client.destroy();
        logger.info('Discord Moderation bot stopped');
      }
    } catch (error) {
      logger.error('Error stopping Discord Moderation bot:', error);
    }
  }
  
  async handleTicketCommand(interaction) {
    const issue = interaction.options.getString('issue');
    const priority = interaction.options.getString('priority') || 'medium';
    const ticketId = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit ticket number
    
    // Store the ticket in the database
    await db.createTicket({
      ticketId: `MOD-${ticketId}`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      issue: issue,
      priority: priority,
      status: 'open',
      createdAt: new Date()
    });
    
    // Try to find or create a support channel
    let supportChannel = interaction.guild.channels.cache.find(channel => 
      channel.name === 'support-tickets' && channel.type === 0
    );
    
    if (!supportChannel) {
      try {
        supportChannel = await interaction.guild.channels.create({
          name: 'support-tickets',
          type: 0, // Text channel
          permissionOverwrites: [
            {
              id: interaction.guild.id, // @everyone role
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.guild.roles.cache.find(role => role.name === 'Moderator')?.id,
              allow: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.guild.roles.cache.find(role => role.name === 'Admin')?.id,
              allow: [PermissionFlagsBits.ViewChannel]
            }
          ]
        });
      } catch (error) {
        logger.error('Error creating support channel:', error);
        // Continue without the channel
      }
    }
    
    // Post the ticket in the support channel if it exists
    if (supportChannel) {
      await supportChannel.send({
        embeds: [{
          color: priority === 'high' ? 0xff0000 : priority === 'medium' ? 0xffaa00 : 0x00aa00,
          title: `New Ticket: MOD-${ticketId}`,
          description: `A new support ticket has been created.`,
          fields: [
            {
              name: 'User',
              value: interaction.user.tag
            },
            {
              name: 'Issue',
              value: issue
            },
            {
              name: 'Priority',
              value: priority.charAt(0).toUpperCase() + priority.slice(1)
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Moderation Bot'
          }
        }]
      });
    }
    
    // Reply to the user
    await interaction.reply({
      content: `Your ticket has been created! Ticket ID: MOD-${ticketId}`,
      ephemeral: true
    });
    
    // Send a DM with support instructions
    try {
      await interaction.user.send({
        embeds: [{
          color: 0x0099ff,
          title: `Ticket Created: MOD-${ticketId}`,
          description: `Thank you for submitting a ticket. Our moderation team will review your issue: "${issue}"`,
          fields: [
            {
              name: 'Priority',
              value: priority.charAt(0).toUpperCase() + priority.slice(1)
            },
            {
              name: 'What happens next?',
              value: 'A moderator will contact you soon. Please keep this ticket ID for reference.'
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Moderation Bot'
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
    await db.logInteraction({
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      command: 'ticket',
      details: { ticketId: `MOD-${ticketId}`, issue, priority },
      timestamp: new Date()
    });
  }
  
  async handleRepCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'me') {
      // Get user's reputation
      const reputation = await db.getReputation(interaction.user.id) || { points: 0, level: 'Newcomer' };
      
      await interaction.reply({
        embeds: [{
          color: 0x0099ff,
          title: 'Your Reputation',
          description: `You have ${reputation.points} reputation points.`,
          fields: [
            {
              name: 'Level',
              value: reputation.level
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Moderation Bot'
          }
        }]
      });
      
    } else if (subcommand === 'user') {
      const target = interaction.options.getUser('target');
      
      // Get target user's reputation
      const reputation = await db.getReputation(target.id) || { points: 0, level: 'Newcomer' };
      
      await interaction.reply({
        embeds: [{
          color: 0x0099ff,
          title: `${target.username}'s Reputation`,
          description: `${target.username} has ${reputation.points} reputation points.`,
          fields: [
            {
              name: 'Level',
              value: reputation.level
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Moderation Bot'
          }
        }]
      });
      
    } else if (subcommand === 'add') {
      // Check if user has admin permissions
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
      
      if (!isAdmin) {
        return interaction.reply({
          content: 'You need administrator permissions to add reputation points.',
          ephemeral: true
        });
      }
      
      const target = interaction.options.getUser('target');
      const points = interaction.options.getInteger('points');
      
      if (points <= 0) {
        return interaction.reply({
          content: 'You must add at least 1 point.',
          ephemeral: true
        });
      }
      
      // Update user's reputation
      await db.addReputation(target.id, points, interaction.user.id);
      
      // Get updated reputation
      const updatedRep = await db.getReputation(target.id);
      
      await interaction.reply({
        embeds: [{
          color: 0x00ff00,
          title: 'Reputation Added',
          description: `Added ${points} reputation points to ${target.username}.`,
          fields: [
            {
              name: 'New Total',
              value: `${updatedRep.points} points`
            },
            {
              name: 'Level',
              value: updatedRep.level
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Moderation Bot'
          }
        }]
      });
      
      // Try to notify the user via DM
      try {
        await target.send({
          embeds: [{
            color: 0x00ff00,
            title: 'You Received Reputation Points!',
            description: `An administrator has added ${points} reputation points to your profile.`,
            fields: [
              {
                name: 'New Total',
                value: `${updatedRep.points} points`
              },
              {
                name: 'Level',
                value: updatedRep.level
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Moderation Bot'
            }
          }]
        });
      } catch (error) {
        logger.error('Error sending DM to user about reputation update:', error);
      }
    }
    
    // Log the interaction
    await db.logInteraction({
      userId: interaction.user.id,
      username: interaction.user.tag,
      platform: 'Discord',
      command: `rep ${subcommand}`,
      timestamp: new Date()
    });
  }
}

module.exports = DiscordModBot;