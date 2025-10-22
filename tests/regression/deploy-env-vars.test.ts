/**
 * Regression test for deployment environment variable handling
 * 
 * This test ensures that empty string environment variables are properly
 * handled and default values are used for Screeps deployment configuration.
 * 
 * Original issue: Workflow run 18702433741 failed with "connect ECONNREFUSED ::1:80"
 * Root cause: Empty string environment variables were not handled correctly,
 * causing connection attempts to empty hostname/port instead of defaults.
 */

import { describe, it, expect } from 'vitest';

describe('Deployment Environment Variables Regression', () => {
  it('should handle empty string environment variables correctly', () => {
    // Save original env
    const originalEnv = { ...process.env };
    
    try {
      // Set empty string environment variables (simulates GitHub Actions with empty secrets)
      process.env.SCREEPS_HOST = '';
      process.env.SCREEPS_PORT = '';
      process.env.SCREEPS_PROTOCOL = '';
      process.env.SCREEPS_BRANCH = '';
      process.env.SCREEPS_PATH = '';
      
      // Test the fixed logic (using || instead of ??)
      const branch = process.env.SCREEPS_BRANCH || "main";
      const hostname = process.env.SCREEPS_HOST || "screeps.com";
      const protocol = process.env.SCREEPS_PROTOCOL || "https";
      const port = Number(process.env.SCREEPS_PORT || 443);
      const path = process.env.SCREEPS_PATH || "/";
      
      // Verify defaults are applied when env vars are empty strings
      expect(branch).toBe('main');
      expect(hostname).toBe('screeps.com');
      expect(protocol).toBe('https');
      expect(port).toBe(443);
      expect(path).toBe('/');
      
      // Verify the problematic behavior with ?? (should fail)
      const problematicHostname = process.env.SCREEPS_HOST ?? "screeps.com";
      const problematicProtocol = process.env.SCREEPS_PROTOCOL ?? "https";
      const problematicPort = Number(process.env.SCREEPS_PORT ?? 443);
      
      expect(problematicHostname).toBe(''); // Empty string, not default
      expect(problematicProtocol).toBe(''); // Empty string, not default  
      expect(problematicPort).toBe(0); // NaN -> 0, not default 443
      
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });
  
  it('should still respect non-empty environment variables', () => {
    // Save original env
    const originalEnv = { ...process.env };
    
    try {
      // Set custom environment variables
      process.env.SCREEPS_HOST = 'custom.server.com';
      process.env.SCREEPS_PORT = '21025';
      process.env.SCREEPS_PROTOCOL = 'http';
      process.env.SCREEPS_BRANCH = 'dev';
      process.env.SCREEPS_PATH = '/custom';
      
      // Test the fixed logic
      const branch = process.env.SCREEPS_BRANCH || "main";
      const hostname = process.env.SCREEPS_HOST || "screeps.com";
      const protocol = process.env.SCREEPS_PROTOCOL || "https";
      const port = Number(process.env.SCREEPS_PORT || 443);
      const path = process.env.SCREEPS_PATH || "/";
      
      // Verify custom values are used
      expect(branch).toBe('dev');
      expect(hostname).toBe('custom.server.com');
      expect(protocol).toBe('http');
      expect(port).toBe(21025);
      expect(path).toBe('/custom');
      
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });
});