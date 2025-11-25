# Build stage for the React frontend
FROM node:16-alpine AS builder

WORKDIR /app

# Install git for cloning the repository
RUN apk add --no-cache git

# Clone the screeps-dashboard repository
RUN git clone --depth 1 https://github.com/canisminor1990/screeps-dashboard.git .

# Install dependencies
RUN npm install --legacy-peer-deps

# Build the frontend
RUN npm run build

# Production stage
FROM node:16-alpine

WORKDIR /app

# Copy the built frontend assets
COPY --from=builder /app/dist ./dist

# Copy the server directory
COPY --from=builder /app/server ./server

# Install server dependencies
WORKDIR /app/server
RUN npm install --legacy-peer-deps

WORKDIR /app

# Expose the server port
EXPOSE 9000

# Start the server
CMD ["node", "server/server.js"]
