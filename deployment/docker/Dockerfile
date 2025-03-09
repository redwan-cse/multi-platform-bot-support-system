# Multi-stage build for Multi-Platform Bot Support Dashboard

# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /opt/app

# Create app directories
RUN mkdir -p /opt/app/data /opt/app/logs

# Copy built assets from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Expose the application port
EXPOSE 3000

# Set user to non-root (optional, for better security)
# USER node

# Start the application
CMD ["node", "src/server.js"]