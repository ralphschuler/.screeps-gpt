# Screeps Agent Docker Image
# 
# This Dockerfile creates a container for running the autonomous Screeps agent
# with all necessary dependencies and the Node.js runtime.

FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache \
    git \
    bash \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./
COPY tsconfig.test.json ./

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/

# Install dependencies
RUN npm install --production=false

# Build TypeScript
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV AGENT_NAME=screeps-agent
ENV AGENT_VERSION=0.1.0

# Default command
CMD ["node", "dist/agent.js", "--task=run_tests"]
