# Copilot Instructions for Multi-Platform Bot Support Dashboard

This document provides a comprehensive, step-by-step prompt for generating the entire Multi-Platform Bot Support Dashboard project. The project is a self-hosted solution for deploying and managing multiple chatbots (Discord, Telegram, WhatsApp, Messenger, Instagram Chat, etc.) via a modern web-based dashboard. It is designed for deployment on Ubuntu servers and via Docker, using Node.js 22.14.0, Express.js with Tailwind CSS for the dashboard, and a custom login system. Supported database engines include SQLite (default for development), PostgreSQL, and MongoDB. Bots are not deployed by default; the administrator creates and deploys bots via the dashboard, which launches them as child processes and monitors them (using PM2 for process management).

**Default Admin Credentials:**
- Email: admin@redwan.work
- Password: Pa$$w0rd

Proceed sequentially through each phase and confirm completion manually before moving on.

---

## Important Instructions

- Use Node.js version 22.14.0.
- Install packages using:
  npm install package_name  
  (This ensures the latest secure versions are installed.)
- Build the dashboard using Express.js for the backend and Tailwind CSS for the frontend.
- Implement a custom login system (no open signup). A predefined administrator account is created on installation using the credentials above; only the admin can create and manage additional users.
- Use the following libraries for the login system:
  - bcrypt for password hashing (hash passwords before storage)
  - jsonwebtoken for session management (issue a short-lived access token, e.g., 15 minutes; store a refresh token in an httpOnly cookie)
  - speakeasy for optional two-factor authentication (2FA via authenticator apps)
  - cookie-parser for secure cookie handling
- Enhance security with rate limiting (express-rate-limit), CSRF protection (csurf middleware), input validation, and HTTPS enforcement.
- Database selection is controlled via the DB_ENGINE environment variable (options: SQLITE, POSTGRESQL, MONGODB). SQLite is the default for development.
- For Discord, implement slash (/) commands for interactions.
- Secure all API endpoints with JWT authentication and role-based access control (RBAC).
- Deployment options:
  - Ubuntu Server Setup using an installation script downloaded with curl (example below).
  - Docker Deployment using a docker-compose.yml file that sets up the full application stack and supports DB engine selection via environment variables.
- Automated testing is provided only as placeholders; the /tests folder is omitted.
- Directory structure follows a Next.js-like pattern with a source folder (/src) for application code; keep /public, /deployment, and /wiki at the root.
- The /wiki directory must be git-ignored and its content maintained manually.
- Repository Details:
  - GitHub Repo: https://github.com/redwan-cse/multi-platform-bot-support-system.git
  - DockerHub Repo: https://hub.docker.com/r/redwancse/multi-platform-bot-support-system
- Do not include Dependabot configuration.

---

## Phase 1: Repository Initialization & Directory Structure

Task:
- Initialize the repository using the provided GitHub URL.
- Create the following directory structure:

  /src  
  ├── /bots  
  │    ├── discordBot.js       // Standard Discord chatbot using slash commands (e.g., /help, /ticket) for auto-reply and lead collection  
  │    ├── discordModBot.js    // Discord moderation bot with advanced features (e.g., /ticket for support, /rep for reputation; only admin can assign bonus reputation)  
  │    ├── telegramBot.js  
  │    ├── whatsappBot.js  
  │    ├── messengerBot.js  
  │    └── instagramBot.js  
  ├── /utils  
  │    ├── dbUtils.js          // Database CRUD operations; include sample connection strings for PostgreSQL/MongoDB  
  │    ├── csvExport.js        // Generate CSV reports from database queries  
  │    └── logging.js          // Centralized logging utilities  
  ├── /api  
  │    └── apiRouter.js        // API routing and webhook handlers; enforce JWT authentication and RBAC  
  └── /dashboard              // Frontend code for the admin panel (vite-react-ts, React with TypeScript)
  
At the root level, create:
- /public                  // For static assets
- /deployment              // Deployment configurations; subfolders: ubuntu, docker
- /wiki                   // Documentation (git-ignored)
- env.example             // Lists all required environment variables and sample connection strings

Confirm that the repository structure is complete and documented.

---

## Phase 2: Functional Login System Development

Task:
- Develop a secure, custom login system using our own database.
- Use the following libraries:
  - bcrypt for password hashing
  - jsonwebtoken for session management
  - speakeasy for optional two-factor authentication (2FA)
  - cookie-parser for secure cookie handling
- Enhance security by adding:
  - Rate limiting (express-rate-limit) on login and API requests
  - CSRF protection (csurf middleware) for form submissions
  - Input validation and sanitization (e.g., express-validator)
- The login system must:
  - Automatically create a predefined administrator account on first installation using the credentials:
    - Email: admin@redwan.work
    - Password: Pa$$w0rd
  - Require the administrator to log in and change their username, email, and password.
  - Disable open signup; only the administrator can create additional user accounts.
  - Provide user management functionality to create, update, suspend, delete, and reactivate accounts with roles: Administrator, Manager, and Normal User.
- Document the login system with clear inline comments and secure coding practices.

Confirm that the login system is complete and manually tested.

---

## Phase 3: Dashboard and Web Interface Development

Task:
- Build the admin panel frontend using vite-react-ts (React with TypeScript) and Tailwind CSS, served by an Express.js backend.
- The dashboard must include the following pages:
  - Home:
    - Display overall system status, bot health, error logs, and performance metrics.
  - Bot Management:
    - By default, no bots are deployed.
    - Allow the administrator to create a new bot by:
      - Selecting the platform and bot type (e.g., Discord Standard, Discord Moderation, Telegram, etc.)
      - Entering a bot name
      - Providing necessary credentials (e.g., bot secret key, bot ID, guild ID, invite links, page links, etc.)
    - Immediately deploy the bot as a child process (using Node.js's child_process module) with process monitoring via PM2.
  - User Management:
    - Enable the administrator to create, update, suspend, delete, and reactivate user accounts.
    - Display a list of users with their roles and statuses.
  - Monitoring & Reporting:
    - Display real-time logs and performance metrics.
    - Provide an option to export data (e.g., leads) in CSV format.
- Ensure that all dashboard routes are protected by the custom login system.
- The UI should be modern, responsive, and intuitive. Use Lucide React for icons and include stock photos from Unsplash via valid URLs in <img> tags where appropriate.
- Document all UI components and security features, including JWT-protected routes and CSRF protection.

Confirm that the dashboard and its features are fully functional and integrated with the login system.

---

## Phase 4: Bot Modules and API Integration

Task:
- Bot Modules:
  - Discord Bots:
    - In discordBot.js:
      - Implement slash command handling for commands such as:
        - /help: Reply with an embedded message listing available commands.
        - /ticket: Log the ticket request in the database and send a DM with support instructions.
      - Log interactions and errors.
    - In discordModBot.js:
      - Implement advanced moderation features using slash commands:
        - /ticket: Create a ticket in a support channel and send a DM with the ticket number.
        - /rep: Allow users to query their reputation (e.g., /rep me) and allow only administrators to assign bonus reputation (e.g., /rep add @user 10).
      - Ensure robust error handling and logging.
  - Other Bots:
    - In telegramBot.js, whatsappBot.js, messengerBot.js, and instagramBot.js:
      - Implement auto-reply functionality (e.g., reply to "help" with a support message).
      - Collect lead information (store data such as user ID, platform, message, timestamp) and log interactions.
- Database Utilities:
  - In dbUtils.js, implement functions for connecting to the centralized database and performing CRUD operations.
  - Support three database engines: SQLite (default for development), PostgreSQL, and MongoDB (support both local and remote connection strings).
  - Define a unified schema for storing leads, reputation scores, interactions, and tickets.
- CSV Export Module:
  - In csvExport.js, implement functionality to generate CSV files from database queries.
  - Use "npm install csv-writer" to add the CSV library.
  - Provide an API function to export CSV data.
- API Routing:
  - In apiRouter.js, define endpoints:
    - /webhook/discord
    - /webhook/telegram
    - /webhook/meta (for WhatsApp, Messenger, Instagram)
    - /export/csv
  - Secure these endpoints using JWT authentication and role-based access control.
  - Validate incoming requests and route them to the appropriate modules.

Confirm that all bot modules and API integrations are complete and well-documented.

---

## Phase 5: Deployment, Dockerization, and Setup Scripts

Task:
- Ubuntu Server Deployment:
  - Create an install.sh script that downloads from a remote URL using:
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  - The script should prompt for DB engine selection via the DB_ENGINE environment variable (options: SQLITE, POSTGRESQL, MONGODB) and configure the project to run on an available port (starting at 3000).
- Docker Deployment:
  - Create a Dockerfile that uses Node.js 22.14.0, installs dependencies using "npm install package_name", copies project files, and exposes necessary ports. Use multi-stage builds for optimization.
  - Create a docker-compose.yml file that sets up the full application stack, supports DB engine selection via environment variables, and starts the system with a single "docker-compose up" command.
- GitHub Actions Workflow:
  - Create a workflow file (e.g., .github/workflows/docker-publish.yml) that checks out the repository, builds the Docker image, performs vulnerability scanning, and pushes the image to Docker Hub (https://hub.docker.com/r/redwancse/multi-platform-bot-support-system).
  - Note: Automated tests are provided only as placeholders and are not executed in production.

Confirm that deployment scripts, Docker configurations, and CI/CD workflows are complete and well-documented.

---

## Phase 6: Monitoring and Final Documentation

Task:
- Monitoring and Logging:
  - Integrate logging across all modules using a library such as Winston.
  - Develop dashboard widgets to display real-time metrics (bot health, error logs, performance statistics).
  - Implement rate limiting on API endpoints and configure placeholders for critical failure alerts (e.g., email notifications).
- Final Documentation:
  - Update README.md with a comprehensive project overview, detailed installation instructions, and deployment guides.
  - Ensure the /wiki directory exists and is git-ignored; maintain its content manually.
  - Include support contact details: contact@redwan.work and security@redwan.work.
  - Document all security practices, including:
    - Custom login system (bcrypt, JWT, speakeasy, cookie-parser)
    - HTTPS enforcement and SSL/TLS via Let's Encrypt
    - Cloudflare integration
    - Backup and rate limiting policies
- Testing:
  - The /tests directory is omitted or left empty, as automated testing integration is deferred.

Confirm that monitoring, final documentation, and security practices are complete.

---

## Final Review and Confirmation

After all phases are complete:
- Review all code to ensure modules are modular, secure, and well-documented.
- Verify that the project is self-contained, deployable, and all features function as expected.
- Manually test all functionalities (login, dashboard, bot creation, API endpoints, CSV export).
- Finalize the README, documentation, and internal guides.
- Once all checks are complete, the project is ready for release.

Proceed sequentially through each phase and confirm completion manually before moving on.
