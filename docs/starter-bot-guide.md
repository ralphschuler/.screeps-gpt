# Starter Bot Guide

This repository includes a comprehensive starter Screeps bot that provides essential functionality for new users or as a foundation for further development.

## Core Features

### Auto-Spawning System

The bot automatically manages creep population based on role requirements:

- **Harvesters**: Minimum of 2 creeps that collect energy from sources
- **Upgraders**: Minimum of 1 creep that upgrades the room controller
- **Energy-aware**: Only spawns when sufficient energy is available
- **Spawn management**: Intelligently uses available spawns and handles spawn failures

### Auto-Harvesting Behavior

Harvester creeps follow a sophisticated energy collection pattern:

1. **Energy Collection**: Automatically locate and harvest from active energy sources
2. **Pathfinding**: Use intelligent pathing to reach sources efficiently  
3. **Energy Distribution**: Transfer collected energy to spawns and extensions
4. **Fallback Upgrading**: Upgrade controller when no transfer targets are available
5. **Error Handling**: Gracefully handle edge cases like depleted sources or pathfinding failures

### Auto-Upgrading Functionality

Upgrader creeps maintain continuous controller development:

1. **Energy Withdrawal**: Collect energy from spawns and extensions when empty
2. **Controller Upgrading**: Efficiently upgrade the room controller
3. **Smart Recharging**: Only withdraw energy when structures have sufficient reserves (>50 energy)
4. **Movement Optimization**: Automatically move to targets when not in range

### Error Handling and Robustness

The starter bot includes comprehensive error handling:

- **Spawn Failures**: Clear error messages for spawn failures (insufficient energy, busy spawn, etc.)
- **Resource Scarcity**: Graceful handling when no energy sources are available
- **Creep Errors**: Error state tracking for creeps that encounter issues
- **Unknown Roles**: Safe handling of creeps with unrecognized roles
- **Edge Cases**: Protection against common Screeps API edge cases

## Usage

The starter bot is automatically active when you deploy the codebase. No manual configuration is required.

### Monitoring

The bot provides detailed logging and metrics:

- Spawn events with creep names and spawn locations
- Task execution summaries (harvest, supply, upgrade counts)
- Error conditions with detailed descriptions
- Performance metrics including CPU usage and execution times

### Customization

You can customize the starter bot behavior by modifying `src/runtime/behavior/BehaviorController.ts`:

- **Role Minimums**: Adjust the `minimum` values in `ROLE_DEFINITIONS`
- **Body Parts**: Modify the `body` arrays for different creep configurations
- **Behavior Logic**: Enhance the `runHarvester()` and `runUpgrader()` functions
- **New Roles**: Add additional role definitions with custom behaviors

## Testing

The starter bot includes comprehensive test coverage in `tests/unit/behaviorController.test.ts`:

- Auto-spawning system validation
- Harvesting behavior verification
- Upgrading functionality testing
- Error handling and edge case coverage
- Integration testing for the complete energy cycle

Run tests with:
```bash
npm run test:unit
```

## Architecture Integration

The starter bot is fully integrated with the repository's architecture:

- **Kernel System**: Managed by the runtime kernel for consistent execution
- **Memory Management**: Automatic role bookkeeping and memory cleanup
- **Performance Tracking**: CPU usage monitoring and performance metrics
- **System Evaluation**: Health reports and improvement recommendations

## Next Steps

This starter bot provides a solid foundation for Screeps development. Consider these enhancements:

1. **Advanced Roles**: Add builders, repairers, or defenders
2. **Room Planning**: Implement construction site management
3. **Multi-Room**: Extend operations to multiple rooms
4. **Optimization**: Fine-tune CPU usage and movement efficiency
5. **Strategy**: Add combat, economy, or expansion strategies

See the main repository documentation for guidance on extending the AI with more sophisticated behaviors.