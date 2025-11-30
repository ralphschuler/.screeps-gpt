---
title: "Release 0.197.11: Type-Safe Runtime with Comprehensive Type Guards"
date: 2025-11-30T12:15:40.000Z
categories:
  - Release Notes
tags:
  - release
  - runtime
  - type-safety
  - refactoring
---

## Introduction

Screeps GPT 0.197.11 delivers a major leap forward in runtime type safety by introducing a comprehensive type guard system that dramatically reduces unsafe type assertions across the codebase. This release eliminates 40+ instances of unsafe `as` type casts in behavior controllers—replacing them with validated type guards and centralized helper functions. The result is a more maintainable, reliable runtime that catches type errors early and provides clear failure modes when objects don't match expected types.

<!-- more -->

## Key Features

### Type Guards Module

**New file: `packages/bot/src/runtime/types/typeGuards.ts`**

This release introduces a complete suite of runtime type validation utilities that replace scattered, unsafe type assertions throughout the codebase. The new type guards module includes:

- **Predicate-based type guards**: Functions like `isCreep()`, `isSource()`, `isStructure()`, `isSpawn()`, `isContainer()`, and `isTower()` that return boolean values and narrow TypeScript types
- **Validation helpers**: Functions like `asCreep()` that throw `TypeError` with descriptive messages instead of silently passing invalid objects through the system
- **Type-safe `room.find()` wrappers**: Convenience functions like `findActiveSources()`, `findAllSources()`, `findMySpawns()`, `findHostileCreeps()`, `findMyCreeps()`, `findDroppedResources()`, `findContainers()`, and `findTowers()` that combine room queries with type validation in a single call

All type guards follow a consistent pattern:

```typescript
// Predicate-based guard
function isCreep(obj: unknown): obj is Creep {
  return obj instanceof Creep;
}

// Validation helper that throws
function asCreep(obj: unknown, context?: string): Creep {
  if (!isCreep(obj)) {
    throw new TypeError(`Expected Creep but got ${typeof obj}${context ? ` in ${context}` : ""}`);
  }
  return obj;
}

// Type-safe room.find wrapper
function findActiveSources(room: Room): Source[] {
  return room.find(FIND_SOURCES_ACTIVE).filter(isSource);
}
```

This approach provides three levels of safety:
1. **Zero-overhead checks** when types are statically known
2. **Runtime validation** when types are uncertain
3. **Clear error messages** when validation fails

### Behavior Controller Refactoring

**Reduced unsafe type assertions from 50+ to ~10 instances (#1565)**

The introduction of the type guards module enabled a systematic cleanup of unsafe type assertions across 14 role controllers. This refactoring addresses a long-standing technical debt issue where type safety was sacrificed for convenience.

**Before (unsafe):**
```typescript
const creep = Game.creeps[creepName] as Creep;
const sources = room.find(FIND_SOURCES_ACTIVE) as Source[];
const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
```

**After (type-safe):**
```typescript
const creep = asCreep(Game.creeps[creepName], `role controller ${role}`);
const sources = findActiveSources(room);
const spawns = findMySpawns(room);
```

The refactoring focused on:
- **HarvesterController, HaulerController, UpgraderController, BuilderController, RepairerController**: Replaced `creep as Creep` with validated `asCreep()` helper
- **helpers.ts**: Consolidated scattered type assertions into centralized, reusable type-safe helpers
- **All role controllers**: Replaced array type assertions (`as Source[]`, `as StructureSpawn[]`) with type-safe find wrappers

### Test Coverage

**24 unit tests added for type guards functionality**

The type guards module includes comprehensive test coverage validating:
- All predicate-based type guards return correct boolean values
- All validation helpers throw `TypeError` with descriptive messages for invalid inputs
- All type-safe find wrappers correctly filter and validate results
- Edge cases like `null`, `undefined`, and incorrect object types

## Technical Details

### Design Rationale

The type guard system was designed to solve a specific problem in the Screeps GPT codebase: **unsafe type assertions that masked runtime errors**. Prior to this release, the codebase relied heavily on TypeScript's `as` operator to cast game objects to specific types. While this satisfied the type checker at compile time, it provided zero runtime safety—if the object wasn't actually the expected type, the code would fail silently or crash with cryptic errors.

This pattern was particularly problematic in behavior controllers, where:
- **Creep lookup failures** (`Game.creeps[name]` returning `undefined`) would pass through unchecked
- **Room queries** could return unexpected object types when structures were destroyed or replaced
- **Error messages** were unhelpful because the failure occurred deep in the call stack, far from the type assertion

The type guard system addresses these issues by:
1. **Centralizing type validation** in a single module with consistent patterns
2. **Providing explicit validation points** where objects enter the system
3. **Generating clear error messages** that include context about where validation failed
4. **Enabling incremental adoption** through both predicate and validation helper patterns

### Implementation Choices

#### Why Not Use Zod or Other Runtime Validation Libraries?

While libraries like Zod provide powerful runtime validation, they come with significant overhead in bundle size and CPU usage—critical concerns in the Screeps environment where every byte and CPU tick matters. The type guard system provides the essential validation needed for game objects without the cost of a full validation framework.

#### Why Both Predicates and Validation Helpers?

The dual approach (predicates like `isCreep()` + validation helpers like `asCreep()`) serves different use cases:

- **Predicates** are used in filtering and conditional logic where you want to handle both valid and invalid cases
- **Validation helpers** are used at system boundaries where an invalid object indicates a bug that should halt execution immediately

This gives developers flexibility to choose the appropriate validation strategy for their specific context.

#### Why Type-Safe Find Wrappers?

Screeps' `room.find()` API returns arrays of game objects, but TypeScript's type system can't guarantee those objects are actually the expected type at runtime. The type-safe wrappers combine the query with validation in a single call, reducing boilerplate and ensuring type safety at the query boundary.

### Architectural Improvements

This release establishes several architectural patterns that improve code quality across the repository:

1. **Centralized type validation**: All type checks now flow through a single module, making it easy to audit and enhance validation logic
2. **Consistent error handling**: All validation failures throw `TypeError` with descriptive messages, making debugging easier
3. **Testable validation**: Type guards are pure functions that can be tested in isolation without mocking the Screeps API
4. **Progressive migration**: The existing unsafe type assertions remain in place (reduced to ~10 instances) until they can be safely migrated to type guards

### Files Changed

- **New file**: `packages/bot/src/runtime/types/typeGuards.ts` - Type guard utilities (24 unit tests)
- **Modified**: 14 role controller files - Replaced unsafe type assertions with validated helpers
- **Modified**: `packages/bot/src/runtime/behavior/helpers.ts` - Migrated to type guard utilities

## Impact

### Code Maintainability

The type guard system dramatically improves code maintainability by:
- **Reducing cognitive load**: Developers no longer need to mentally track whether objects have been validated
- **Preventing silent failures**: Invalid objects now fail fast with clear error messages instead of causing cryptic errors downstream
- **Centralizing validation logic**: All type checking happens in one module, making it easy to enhance or audit

### Runtime Reliability

By catching type errors early at system boundaries, the type guard system prevents entire classes of bugs:
- **Undefined creep lookups**: `asCreep()` throws immediately if a creep doesn't exist, instead of letting `undefined` propagate
- **Invalid room queries**: Type-safe find wrappers filter out unexpected objects before they enter business logic
- **Clear failure modes**: When validation fails, the error message includes context about where and why

### Development Velocity

The type guard system accelerates development by:
- **Reducing debugging time**: Clear error messages point directly to the source of type mismatches
- **Enabling safer refactoring**: Type guards provide guardrails when restructuring code
- **Improving test coverage**: Type guards are easy to test in isolation, improving overall test quality

## What's Next

This release establishes the foundation for further type safety improvements:

1. **Complete migration**: The remaining ~10 unsafe type assertions will be migrated to type guards in future releases
2. **Enhanced validation**: Additional type guards can be added for other game object types (links, labs, observers, etc.)
3. **Performance optimization**: Type guard overhead can be measured and optimized if needed
4. **Broader adoption**: Type-safe patterns established here can be applied to other parts of the codebase

The type guard system also unblocks work on the state machine migration (#1267) by providing reliable type validation for state machine inputs and outputs.

---

**Release Date**: 2025-11-30  
**Commits**: See [CHANGELOG.md](https://github.com/ralphschuler/.screeps-gpt/blob/main/CHANGELOG.md#01971---2025-11-30) for full details  
**Issue Reference**: #1565
