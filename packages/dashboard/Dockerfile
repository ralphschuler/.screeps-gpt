# Build stage for the React frontend
# Note: Using Node.js 18 for compatibility with screeps-dashboard dependencies
# (roadhog, older React/Babel versions require Node.js 16-18)
FROM node:18-alpine AS builder

WORKDIR /app

# Install git for cloning the repository
RUN apk add --no-cache git

# Clone the screeps-dashboard repository at a specific commit for reproducibility
# Pinned to commit 5e50869cf1e1789158a10e9673b8a6d6a5906148
ARG DASHBOARD_COMMIT=5e50869cf1e1789158a10e9673b8a6d6a5906148
RUN git clone https://github.com/canisminor1990/screeps-dashboard.git . && \
    git checkout ${DASHBOARD_COMMIT}

# Install dependencies
RUN npm install --legacy-peer-deps

# Build the frontend
RUN npm run build

# Production stage
# Note: Using Node.js 18 for compatibility with screeps-dashboard dependencies
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy the built frontend assets
COPY --from=builder /app/dist ./dist

# Copy the server directory
COPY --from=builder /app/server ./server

# Install server dependencies
WORKDIR /app/server
RUN npm install --legacy-peer-deps

WORKDIR /app

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose the server port
EXPOSE 9000

# Start the server
CMD ["node", "server/server.js"]
