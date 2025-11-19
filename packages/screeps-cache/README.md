# @ralphschuler/screeps-cache

A generalized solution for heap and memory caching in Screeps.

## Installation

```bash
npm install @ralphschuler/screeps-cache
```

## Usage

```typescript
import { heapCacheGetter, memoryCacheGetter, memoryCache, keyById } from '@ralphschuler/screeps-cache';

class CachedContainer {
  constructor(public id: Id<StructureContainer>) {}

  @memoryCacheGetter(keyById, (i: CachedContainer) => Game.getObjectById(i.id)?.pos)
  public pos?: RoomPosition;

  @heapCacheGetter((i: CachedContainer) => Game.getObjectById(i.id)?.hits)
  public hits?: number;

  @memoryCache(keyById)
  public isSource?: boolean;
}
```

## API

### Decorators

- `@memoryCache(key, rehydrater?)` - Caches property in Memory
- `@memoryCacheGetter(key, getter, rehydrater?, invalidateCache?)` - Caches getter result in Memory
- `@heapCacheGetter(getter, invalidateCache?)` - Caches getter result in heap

### Helpers

- `keyById(instance)` - Keys cache by instance.id
- `keyByName(instance)` - Keys cache by instance.name
- `asRoomPosition(pos)` - Rehydrates RoomPosition objects

## License

MIT
