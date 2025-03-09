# Multi-Platform Bot Support Dashboard

A comprehensive, self-hosted solution to deploy and manage multiple chatbots (Discord, Telegram, WhatsApp, Messenger, Instagram Chat) via a modern web-based dashboard.

## Features

- **Multi-Platform Support**: Deploy and manage bots across Discord, Telegram, WhatsApp, Messenger, and Instagram
- **Unified Dashboard**: Monitor all your bots from a single, intuitive interface
- **Secure Authentication**: Custom login system with role-based access control and optional 2FA
- **Flexible Database Options**: Choose between SQLite (default), PostgreSQL, or MongoDB
- **Lead Collection**: Automatically collect and export user information from bot interactions
- **Ticket System**: Create and manage support tickets across all platforms
- **Monitoring & Reporting**: Real-time logs, performance metrics, and CSV exports
- **Docker Support**: Easy deployment with Docker and docker-compose
- **Ubuntu Server Setup**: Simple installation script for Ubuntu servers

## System Requirements

- Node.js 22.x
- One of the following databases:
  - SQLite (default, no additional setup required)
  - PostgreSQL
  - MongoDB
- For production:
  - Ubuntu Server 20.04+ or Docker

## Quick Start

### Docker Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/redwan-cse/multi-platform-bot-support-system.git
   cd multi-platform-bot-support-system
   ```

2. Create a `.env` file in the root directory with your configuration (see `env.example` for reference).

3. Start the application with Docker Compose:
   ```bash
   cd deployment/docker
   docker-compose up -d
   ```

4. Access the dashboard at `http://localhost:3000` (or your configured port).

### Ubuntu Server Setup

1. Run the installation script:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

2. Follow the prompts to configure your installation.

3. Access the dashboard at the URL provided at the end of the installation.

## Default Admin Credentials

- **Username**: redwan
- **Email**: redwan@redwan.work
- **Password**: Pa$$w0rd

**IMPORTANT**: Change the default password after first login!

## Bot Configuration

### Discord Bot

1. Create a new bot on the [Discord Developer Portal](https://discord.com/developers/applications)
2. Get your bot token and add it to the dashboard
3. Invite the bot to your server using the OAuth2 URL generator

### Telegram Bot

1. Create a new bot with [@BotFather](https://t.me/botfather)
2. Get your bot token and add it to the dashboard

### WhatsApp Bot

1. Add your WhatsApp credentials to the dashboard
2. Scan the QR code when prompted

### Messenger & Instagram Bots

1. Create a Facebook App on the [Facebook Developer Portal](https://developers.facebook.com/)
2. Configure the Messenger and Instagram settings
3. Add your credentials to the dashboard

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/redwan-cse/multi-platform-bot-support-system.git
   cd multi-platform-bot-support-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (see `env.example` for reference).

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Access the dashboard at `http://localhost:3000`.

## Security

- All API endpoints are secured with JWT authentication
- Role-based access control for different user types
- Rate limiting to prevent brute force attacks
- CSRF protection for dashboard actions
- Input validation and sanitization
- HTTPS enforcement in production

## Support

For support, please contact:

- Email: contact@redwan.work
- Security issues: security@redwan.work

## License

This project is licensed under the MIT License - see the LICENSE file for details.