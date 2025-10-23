# Screeps AutoSpawner Action

A composite GitHub Action that automatically checks spawn status and triggers respawn if needed after deployment.

## Description

This action checks the Screeps bot's spawn status using the Screeps API and exits early if the bot is already active. If the bot needs respawning (all spawns destroyed or not yet placed after respawn), the action will log a warning and exit with an error code to signal manual intervention is required.

## Inputs

### `screeps-token`

**Required**: Yes  
**Description**: Screeps API token for authentication  
**Default**: None

Get your token from: https://screeps.com/a/#!/account/auth-tokens

### `screeps-host`

**Required**: No  
**Description**: Screeps server hostname  
**Default**: `screeps.com`

For PTR (Public Test Realm), use `screeps.com` with `screeps-path: /ptr`

### `screeps-protocol`

**Required**: No  
**Description**: Protocol (http or https)  
**Default**: `https`

### `screeps-port`

**Required**: No  
**Description**: Screeps server port  
**Default**: `443`

### `screeps-path`

**Required**: No  
**Description**: Screeps server path  
**Default**: `/`

For PTR, set to `/ptr`

## Outputs

### `status`

**Description**: Spawn status after check  
**Possible values**:

- `normal` - Bot is already spawned and active
- `lost` - All spawns destroyed, manual respawn needed
- `empty` - Respawned but spawn not yet placed, manual action needed

### `action-taken`

**Description**: Action taken by the autospawner  
**Possible values**:

- `none` - No action taken (bot already active or manual intervention required)
- `respawned` - Automatic respawn triggered (not yet implemented)

## Exit Behavior

- **Exit code 0**: Bot is already spawned and active (status: "normal")
- **Exit code 1**: Manual intervention required (status: "lost" or "empty")

## Usage Example

### Basic Usage

```yaml
- name: Check spawn status
  uses: ./.github/actions/screeps-autospawner
  with:
    screeps-token: ${{ secrets.SCREEPS_TOKEN }}
```

### With Custom Configuration

```yaml
- name: Check spawn status on PTR
  uses: ./.github/actions/screeps-autospawner
  with:
    screeps-token: ${{ secrets.SCREEPS_PTR_TOKEN }}
    screeps-host: screeps.com
    screeps-path: /ptr
```

### Post-Deployment Integration

```yaml
- name: Deploy to Screeps
  run: bun run deploy
  env:
    SCREEPS_TOKEN: ${{ secrets.SCREEPS_TOKEN }}

- name: Check spawn status and auto-respawn
  if: success()
  uses: ./.github/actions/screeps-autospawner
  with:
    screeps-token: ${{ secrets.SCREEPS_TOKEN }}
```

## Implementation Details

### API Integration

Uses the `screeps-api` npm package to interact with the Screeps REST API:

- Endpoint: `GET /api/user/world-status`
- Returns: `{ ok: 1, status: "normal" | "lost" | "empty" }`

### Early Exit Logic

The action checks spawn status and exits early to prevent unnecessary API calls:

1. **Status: "normal"** → Bot is active, exit with success (0)
2. **Status: "lost"** → All spawns destroyed, exit with error (1)
3. **Status: "empty"** → Respawned but not placed, exit with error (1)

### Error Handling

- Network errors are caught and logged with details
- Authentication failures provide clear error messages
- API response validation ensures data integrity

## Current Limitations

- **Manual Respawn Required**: The action currently only checks spawn status. Automatic respawn logic (selecting suitable room and placing spawn) is not yet implemented.
- **Single Shard**: Only checks the default shard. Multi-shard support not implemented.

## Future Enhancements

- [ ] Automatic room selection based on terrain and resources
- [ ] Automatic spawn placement at optimal location
- [ ] Multi-shard support
- [ ] Integration with push notifications for spawn failures

## Development

### Running Tests Locally

```bash
# Set test token
export SCREEPS_TOKEN="your-test-token"

# Run the script
bun run tsx scripts/screeps-autospawn.ts
```

### Linting

```bash
bun run lint
bun run format:write
```

## Security

- Never commit API tokens to source code
- Use GitHub Secrets to store `SCREEPS_TOKEN`
- Token is passed securely through environment variables
- No token logging in workflow output

## Related Documentation

- [Automation Overview](../../../docs/automation/overview.md)
- [Deployment Workflow](../../../.github/workflows/deploy.yml)
- [Screeps API Documentation](https://docs.screeps.com/api/)
- [screeps-api npm package](https://www.npmjs.com/package/screeps-api)
