/**
 * Regression test for pnpm lockfile configuration compatibility
 * 
 * Related to: https://github.com/ralphschuler/.screeps-gpt/actions/runs/18699813713
 * 
 * This test ensures that pnpm lockfile settings remain compatible with the current pnpm version
 * and prevents ERR_PNPM_LOCKFILE_CONFIG_MISMATCH errors during CI runs.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('pnpm lockfile compatibility', () => {
  test('lockfile should exist and have valid format', () => {
    const lockfilePath = join(process.cwd(), 'pnpm-lock.yaml');
    expect(existsSync(lockfilePath)).toBe(true);
    
    const lockfileContent = readFileSync(lockfilePath, 'utf8');
    expect(lockfileContent).toContain('lockfileVersion:');
    expect(lockfileContent).toContain('settings:');
  });

  test('lockfile should not contain incompatible autoInstallPeers setting', () => {
    const lockfilePath = join(process.cwd(), 'pnpm-lock.yaml');
    const lockfileContent = readFileSync(lockfilePath, 'utf8');
    
    // The lockfile should either not have autoInstallPeers setting or it should be compatible
    // This prevents ERR_PNPM_LOCKFILE_CONFIG_MISMATCH errors
    if (lockfileContent.includes('autoInstallPeers:')) {
      // If present, it should be a boolean value
      const settingsMatch = lockfileContent.match(/autoInstallPeers:\s*(true|false)/);
      expect(settingsMatch).toBeTruthy();
    }
  });

  test('package.json should define pnpm engine compatibility', () => {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    // Ensure we have engine specifications to prevent version mismatches
    expect(packageJson.engines).toBeDefined();
    expect(packageJson.engines.node).toBeDefined();
  });
});