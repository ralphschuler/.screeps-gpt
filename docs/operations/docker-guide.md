# Docker Development Guide

This guide covers containerized development workflows for Screeps GPT, including testing, building, and running a private Screeps server.

## Available Docker Images

The repository provides multiple Dockerfiles for different purposes:

### Testing & Development Images

- **`Dockerfile.test`** - Node.js 20 + Python 2 for general testing
- **`Dockerfile.mockup`** - Node.js 16 + Python 2 for screeps-server-mockup tests
- **`Dockerfile.build`** - Node.js 20 for production builds
- **`Dockerfile.performance`** - screepers/screeps-launcher for performance benchmarking

### Screeps Server Image

- **`Dockerfile.screeps-server`** - Custom private Screeps server with Node.js 16 + Python 2

## Quick Start

### Build All Images

```bash
bun run docker:build
```

### Run Tests in Docker

```bash
# Run unit tests
bun run docker:test:unit

# Run e2e tests
bun run docker:test:e2e

# Run mockup tests (requires Node.js 16)
bun run docker:test:mockup

# Run regression tests
bun run docker:test:regression

# Run with coverage
bun run docker:test:coverage
```

### Build the Bot

```bash
bun run docker:build:ai
```

### Linting & Formatting

```bash
# Run linter
bun run docker:lint

# Check formatting
bun run docker:format
```

## Private Screeps Server

### Starting the Server

The `screeps-server` service provides a complete private Screeps server instance using the official `screeps` npm package.

**Start the server:**

```bash
docker compose up screeps-server
```

The server will be available at `http://localhost:21025`

**Run in background:**

```bash
docker compose up -d screeps-server
```

**View logs:**

```bash
docker compose logs -f screeps-server
```

**Stop the server:**

```bash
docker compose down screeps-server
```

### Server Configuration

The screeps-server service uses:

- **Base Image**: `screepers/screeps-launcher:latest` (community-maintained server with Node.js 16 + Python 2)
- **Server Package**: screeps-launcher (wrapper around screeps server with enhanced features)
- **Port**: 21025 (default Screeps server port)
- **Data Volume**: `./server-data` (persisted server state and database)

### Server Data Persistence

Server data is stored in the `./server-data` directory and persists across container restarts. This includes:

- World database
- User accounts
- Room terrain
- Server configuration

**Reset server data:**

```bash
# Stop the server
docker compose down screeps-server

# Remove server data
rm -rf ./server-data

# Start fresh
docker compose up screeps-server
```

### Accessing the Server

Once running, access the server:

1. **Web Interface**: Open `http://localhost:21025` in your browser
2. **Create Account**: Click "Sign Up" to create a local account
3. **Upload Bot**: Use the in-game code editor or Screeps API to upload your bot

**Using screeps-api to deploy:**

```bash
# Set environment variables
export SCREEPS_HOST=localhost
export SCREEPS_PORT=21025
export SCREEPS_PROTOCOL=http

# Deploy
bun run deploy
```

## Advanced Docker Compose Features

### Development with Hot-Reload

Start the development environment with automatic rebuilding:

```bash
bun run docker:dev
```

This mounts your source code and watches for changes, rebuilding automatically.

### Interactive Shell

Get a bash shell inside the test container:

```bash
bun run docker:shell
```

This is useful for debugging or running one-off commands inside the container environment.

### Custom Service Combinations

Run multiple services together:

```bash
# Start server and development environment
docker compose up screeps-server dev

# Run tests with server available
docker compose up screeps-server test
```

## Docker Compose Services Reference

### Available Services

| Service | Dockerfile | Purpose | Command |
|---------|-----------|---------|---------|
| `dev` | Dockerfile.test | Hot-reload development | `npm run build:watch` |
| `test` | Dockerfile.test | Unit testing | `npm run test:unit` |
| `mockup` | Dockerfile.mockup | Mockup tests (Node 16) | `npm run test:mockup` |
| `build` | Dockerfile.build | Production builds | `npm run build` |
| `lint` | Dockerfile.test | Code linting | `npm run lint` |
| `format` | Dockerfile.test | Format checking | `npm run format:check` |
| `screeps-server` | Dockerfile.screeps-server | Private Screeps server | `screeps start` |
| `screeps-agent` | packages/screeps-agent/Dockerfile | Screeps agent | Custom agent tasks |

### Environment Variables

Configure services with environment variables:

**Screeps Server:**

```bash
# Use custom port
SCREEPS_PORT=21026 docker compose up screeps-server
```

**Testing:**

```bash
# Set test environment
NODE_ENV=test docker compose run test
```

**Agent Service:**

```bash
# Configure agent
SCREEPS_TOKEN=your_token \
SCREEPS_SHARD=shard3 \
docker compose up screeps-agent
```

## Technical Details

### Node.js 16 + Python 2 Requirement

The `screeps-server` and `mockup` images use Node.js 16 with Python 2 because:

1. **isolated-vm dependency**: The screeps server uses isolated-vm for sandboxed code execution
2. **Native module compilation**: isolated-vm requires node-gyp with Python 2
3. **Node.js compatibility**: isolated-vm works best with Node.js 16.x

The images install:

- Node.js 16.20.2
- Python 2.7 + python2.7-dev
- build-essential (gcc, g++, make)
- git for package installation

### Python 2 Configuration

The Dockerfiles configure Python 2 as the default for node-gyp:

```dockerfile
RUN ln -sf /usr/bin/python2.7 /usr/bin/python
ENV PYTHON=/usr/bin/python2.7
```

This ensures native modules compile correctly.

### Volume Mounts

The docker-compose.yml uses volume mounts strategically:

- **Source code mounts**: Enable hot-reloading and iterative development
- **node_modules exclusion**: Prevent host/container conflicts
- **Server data persistence**: Preserve server state across restarts

Example:

```yaml
volumes:
  - .:/workspace           # Mount source code
  - /workspace/node_modules # Use container's node_modules
  - ./server-data:/screeps  # Persist server data
```

## Troubleshooting

### Server Won't Start

**Check logs:**

```bash
docker compose logs screeps-server
```

**Common issues:**

1. **Port already in use**: Another process is using port 21025
   ```bash
   # Check what's using the port
   lsof -i :21025
   
   # Use different port
   docker compose run -p 21026:21025 screeps-server
   ```

2. **Permission issues**: Server data directory not writable
   ```bash
   # Fix permissions
   chmod -R 755 ./server-data
   ```

3. **Corrupted data**: Reset server data
   ```bash
   docker compose down screeps-server
   rm -rf ./server-data
   docker compose up screeps-server
   ```

### Build Failures

**Clean rebuild:**

```bash
# Remove all containers and images
docker compose down
docker system prune -a

# Rebuild
bun run docker:build
```

**Python 2 installation issues:**

If Python 2 installation fails, the Debian repositories may have changed. Check the Dockerfile and update package names if needed.

### Test Failures

**Interactive debugging:**

```bash
# Start a shell in the test container
docker compose run --rm test bash

# Run tests manually
npm run test:unit -- --reporter=verbose
```

**Check dependencies:**

```bash
# Verify installations
docker compose run --rm test npm list
```

### Network Issues

**Container can't reach external services:**

Check Docker network configuration:

```bash
docker network inspect bridge
```

**Server not accessible from host:**

Ensure port mapping is correct:

```bash
docker compose ps
```

Should show `0.0.0.0:21025->21025/tcp`

## Performance Considerations

### Image Size

The screeps-server image is larger due to:

- Node.js 16 runtime
- Python 2.7 + build tools
- Native module compilation

**Optimize builds:**

```bash
# Build without cache for clean image
docker compose build --no-cache screeps-server
```

### Resource Limits

Set resource constraints:

```yaml
# docker-compose.yml
services:
  screeps-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## CI/CD Integration

The repository uses Docker images in GitHub Actions workflows:

- **Guard workflows**: Use Dockerfile.test for testing
- **Performance tests**: Use Dockerfile.performance for benchmarking
- **Build workflow**: Uses Dockerfile.build for production builds

See [Automation Overview](../automation/overview.md) for workflow details.

## Related Documentation

- [Performance Testing with Private Server](../testing/private-server.md)
- [Deployment Troubleshooting](deployment-troubleshooting.md)
- [Automation Overview](../automation/overview.md)
- [Getting Started Guide](../getting-started.md)

## See Also

- [screeps npm package](https://www.npmjs.com/package/screeps) - Official standalone server
- [screepers/screeps-launcher](https://hub.docker.com/r/screepers/screeps-launcher) - Community Docker image
- [Docker Compose documentation](https://docs.docker.com/compose/)
