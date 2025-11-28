# Documentation References

This directory contains external reference materials and resources used in the development of the Screeps GPT bot.

## Contents

### Energy Collection Guide

**File**: `energy-collection-guide.pdf`

**Description**: Comprehensive guide to energy collection and distribution strategies for Screeps bots, covering:

- Static harvesting with containers
- Hauler architecture and logistics
- Energy distribution priority systems
- Container placement and management
- Performance optimization techniques

**Integration**: Content from this guide has been integrated into the repository documentation at `docs/runtime/energy-management.md`.

**Related Issues**:

- #607 - Spawn container energy depletion prevents larger creep spawning
- #614 - Upgraders should prioritize filling spawn/extensions before upgrading controller
- #638 - Implement energy priority system for spawn/tower containers before controller upgrades

**Source**: Provided by repository owner in issue discussion.

## Usage

These reference materials provide foundational knowledge for bot development and strategy design. When implementing features based on these resources:

1. Review the reference material thoroughly
2. Integrate relevant concepts into appropriate documentation files
3. Create implementation issues for high-priority strategies
4. Cross-reference the source material in documentation and issues
5. Update this README when adding new references

## Adding New References

When adding new reference materials to this directory:

1. Use descriptive filenames (e.g., `topic-name-guide.pdf`)
2. Update this README with a description and integration status
3. Create or update relevant documentation files with the content
4. Add cross-references in related issues or PRs
5. Ensure the reference is accessible to developers and agents

## License and Attribution

Reference materials in this directory may have their own licenses and copyright. Ensure proper attribution when using content from these resources in documentation or code.
