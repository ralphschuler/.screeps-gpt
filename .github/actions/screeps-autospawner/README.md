# Screeps AutoSpawner Action

A composite GitHub Action that automatically checks spawn status and triggers respawn if needed after deployment.

## Description

This action automatically manages Screeps bot spawning:

- **Checks spawn status** using the Screeps API
- **Early exits** if bot is already active (no unnecessary API calls)
- **Automatically respawns** when all spawns are destroyed (status: "lost")
- **Places spawns** when respawn triggered but not yet placed (status: "empty")
- **Intelligent room selection** using worldStartRoom API
- **Optimal spawn placement** through terrain analysis

The action eliminates manual intervention by fully automating the respawn process, including room selection and spawn placement.

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

- `normal` - Bot is spawned and active (or successfully respawned)
- `lost` - All spawns destroyed (respawn attempted)
- `empty` - Respawned but spawn not placed (placement attempted)

### `action-taken`

**Description**: Action taken by the autospawner  
**Possible values**:

- `none` - No action taken (bot already active)
- `respawned` - Full automatic respawn completed (respawn + room selection + spawn placement)
- `spawn_placed` - Spawn automatically placed after manual/previous respawn
- `failed` - Respawn or spawn placement failed (manual intervention required)

## Exit Behavior

- **Exit code 0**: Bot is active OR automatic respawn/placement succeeded
- **Exit code 1**: Automatic respawn/placement failed (manual intervention required)

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

### Automatic Respawn Logic

The action performs different actions based on spawn status:

1. **Status: "normal"** → Bot is active, early exit with success (0), no API calls
2. **Status: "lost"** → All spawns destroyed, triggers full automatic respawn:
   - Calls `/api/user/respawn` to trigger respawn
   - Gets suitable room via `/api/user/world-start-room`
   - Analyzes terrain with `/api/game/room-terrain`
   - Places spawn at optimal location via `/api/game/place-spawn`
   - Returns success with action="respawned"
3. **Status: "empty"** → Respawned but spawn not placed, places spawn:
   - Gets start room (skips respawn call since already triggered)
   - Analyzes terrain for optimal location
   - Places spawn automatically
   - Returns success with action="spawn_placed"

### Spawn Placement Algorithm

The action uses an intelligent algorithm to find the best spawn location:

- Searches in expanding circles from room center (25, 25)
- Prioritizes plain terrain (0) over swamp (2) and walls (1, 3)
- Avoids edges with 3-tile buffer from boundaries
- Searches up to 10-tile radius from center
- Falls back to center location if no plain terrain found

### Error Handling

Comprehensive error handling at each step:

- Network errors are caught and logged with details
- Authentication failures provide clear error messages
- API response validation ensures data integrity
- Room selection failures are handled gracefully
- Terrain fetch errors trigger fallback behavior
- Spawn placement failures exit with clear error messages

## Current Limitations

- **Single Shard**: Only works with default shard. Multi-shard support not implemented.
- **Basic Room Selection**: Uses `worldStartRoom` API which provides a single recommended room. Does not compare multiple rooms.

## Future Enhancements

- [ ] Multi-shard support for distributed bot management
- [ ] Advanced room scoring (multiple candidates, energy analysis, distance metrics)
- [ ] Integration with push notifications for spawn failures
- [ ] Respawn analytics and success rate tracking

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
