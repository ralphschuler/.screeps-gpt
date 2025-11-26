# Screeps Private Server

This private server setup is based on [Jomik/screeps-server](https://github.com/Jomik/screeps-server), which provides a modern Docker-based Screeps private server with improved architecture.

## Why Jomik's Server?

Unlike the traditional screepers/screeps-launcher, this implementation:
- Performs all installation and setup during the Docker build stage
- Only starts the server during container runtime
- Manages mods and bots through a simple `config.yml` file
- Invokes npm only when configuration changes are detected

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Steam API Key ([Get one here](https://steamcommunity.com/dev/apikey))

### Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Steam API key:
   ```
   STEAM_KEY="your_steam_key_here"
   ```

3. Review and customize `config.yml` to configure:
   - Mods to load
   - Bots to include
   - Launcher options

### Available Commands

```bash
npm run start        # Start the server in detached mode
npm run start:logs   # Start server and tail logs
npm run stop         # Stop the server
npm run restart      # Restart the Screeps service
npm run restart:logs # Restart and tail logs
npm run reset        # Stop and remove containers
npm run reset:hard   # Stop and remove containers with volumes
npm run logs         # View server logs
npm run shell        # Open a shell in the Screeps container
npm run redis-cli    # Open redis CLI
npm run cli          # Open Screeps CLI
npm run update       # Update mods to latest versions
npm run check        # Run TypeScript type checking
```

## Configuration

### Mods and Bots

This setup uses both `config.yml` and `bots.yml` for configuration:

#### config.yml - Mods, Bot Packages, and Server Settings

```yaml
mods:
  - screepsmod-auth
  - screepsmod-admin-utils
  # ... add more mods

bots:
  botname: npm-package-name
  # ... add more bots

launcherOptions:
  autoUpdate: false
  logConsole: true

serverConfig:
  tickRate: 200
  socketUpdateRate: 200
  shardName: "test"
  constants:
    UPGRADE_POWER: 10
  welcomeText: |
    <h1>Welcome</h1>
  gclToCPU: true
  maxCPU: 100
  baseCPU: 20
  stepCPU: 10
```

#### bots.yml - Bot User Configuration

Used by screepsmod-bots to preconfigure bot users with spawn positions:

```yaml
version: 1
bots:
  - username: botuser
    botName: bot-package-name
    position: x,y,RoomName
    cpu: 200
    gcl: 1
    log_console: false
```

### Custom Changes

This setup includes the following customizations from the base Jomik repository:

- **MongoDB 8** instead of 4.4.18 for latest features
- **Enhanced healthchecks** with longer start periods (180s for Screeps)
- **Additional mods** configured for testing and development
- **Multiple test bots** (choreographer, overmind, toolangle, screeps-gpt)
- **Persistent Redis data** with AOF enabled
- **Custom bots.yml** for preconfigured bot users with spawn positions
- **serverConfig section** in config.yml for server-specific settings (tick rate, constants, etc.)

## Architecture

The server uses a multi-stage Docker build:
1. **Build stage** - Installs Screeps and dependencies
2. **Runtime stage** - Copies artifacts and sets up the server

Mods and bots are managed dynamically:
- The `screeps-start.cjs` script reads `config.yml`
- It installs/removes packages as needed in the `mods/` directory
- Changes are detected automatically and applied on startup

## Troubleshooting

### Server won't start
- Check logs with `npm run logs`
- Verify your Steam API key is correct
- Ensure MongoDB and Redis are healthy

### Mods not loading
- Check `config.yml` syntax
- View mod installation logs in server output
- Verify mod names match npm package names

### Performance issues
- Adjust `launcherOptions` in `config.yml`
- Monitor container resources with `docker stats`

## References

- [Jomik/screeps-server](https://github.com/Jomik/screeps-server) - Base repository
- [Jomik/screeps-server Wiki](https://github.com/Jomik/screeps-server/wiki) - Detailed documentation
- [Screeps Documentation](https://docs.screeps.com/) - Game API and concepts
