# Screeps Dashboard

Docker Compose setup for [screeps-dashboard](https://github.com/canisminor1990/screeps-dashboard), a web-based dashboard for monitoring your Screeps colony.

![Dashboard Preview](https://raw.githubusercontent.com/canisminor1990/screeps-dashboard/master/preview.png)

## Features

- Global GCL and upgrade time estimation
- Market buy/sell records and inter-room transfer history
- Room RCL and upgrade time estimation
- Storage and Terminal monitoring with capacity alerts
- Spawn queue and Creep details (Position, Parts, Carry)
- Lab Order/Offer status
- Mobile-responsive design

## Quick Start

### 1. Configure your Screeps token

Copy the example configuration and add your Screeps API token:

```bash
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "token": "YOUR_SCREEPS_API_TOKEN",
  "grafana": "",
  "shard": ["shard3"]
}
```

> **Note**: You can generate a Screeps API token at https://screeps.com/a/#!/account/auth-tokens

### 2. Start the dashboard

```bash
docker compose up -d
```

The dashboard will be available at http://localhost:9000

### 3. Stop the dashboard

```bash
docker compose down
```

## Development Mode

For development with source mounting:

```bash
docker compose --profile dev up dashboard-dev
```

This runs the backend API at http://localhost:9000

> **Note**: For frontend development, clone the original screeps-dashboard repository and run `npm run start` locally.

## Configuration

### config.json

| Field | Description |
|-------|-------------|
| `token` | Your Screeps API authentication token |
| `grafana` | (Optional) Grafana token for additional metrics |
| `shard` | Array of shards to monitor (e.g., `["shard3"]`) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |

## Integration with Main Project

This dashboard can be used alongside the main Screeps GPT bot to monitor colony performance. The dashboard reads Memory data from the Screeps API to display real-time information about your bot's activities.

## Troubleshooting

### Dashboard not loading data

1. Verify your Screeps API token is valid
2. Check the shard configuration matches your bot's location
3. Ensure your bot is writing data to Memory that the dashboard expects

### Container fails to start

Check the logs:

```bash
docker compose logs dashboard
```

### Port conflicts

If port 9000 is in use, modify `docker-compose.yml`:

```yaml
ports:
  - "9001:9000"  # Change 9001 to an available port
```

## License

MIT - Based on [canisminor1990/screeps-dashboard](https://github.com/canisminor1990/screeps-dashboard)
