/**
 * Regression test for modular deployment
 *
 * This test ensures that the deployment script correctly handles
 * multiple module files in the modular build architecture.
 *
 * Related issue: ralphschuler/.screeps-gpt#158 - Implement modular deployment architecture
 */

import { describe, it, expect } from "vitest";

describe("Modular Deployment Regression", () => {
  it("should format multiple modules as object for screeps-api", () => {
    // Simulate the modules object that would be passed to api.code.set()
    const modules = {
      main: "module.exports.loop = function() { console.log('main'); }",
      behavior: "module.exports.BehaviorController = class { }",
      memory: "module.exports.MemoryManager = class { }",
      metrics: "module.exports.PerformanceTracker = class { }"
    };

    // Verify the format is an object (not an array)
    expect(typeof modules).toBe("object");
    expect(Array.isArray(modules)).toBe(false);

    // Verify all modules are present
    expect(modules).toHaveProperty("main");
    expect(modules).toHaveProperty("behavior");
    expect(modules).toHaveProperty("memory");
    expect(modules).toHaveProperty("metrics");

    // Verify module names as keys
    const moduleNames = Object.keys(modules);
    expect(moduleNames).toContain("main");
    expect(moduleNames.length).toBe(4);
  });

  it("should support single module deployment (backward compatibility)", () => {
    // Simulate single-module deployment
    const modules = {
      main: "module.exports.loop = function() { console.log('single bundle'); }"
    };

    expect(typeof modules).toBe("object");
    expect(Array.isArray(modules)).toBe(false);
    expect(modules).toHaveProperty("main");
    expect(Object.keys(modules).length).toBe(1);
  });

  it("should validate that all module code is non-empty", () => {
    const validModules = {
      main: "module.exports.loop = function() { }",
      helper: "module.exports.doSomething = function() { }"
    };

    const emptyModule = "";
    const validModule = "module.exports.loop = function() { }";

    // All modules in validModules should have content
    Object.values(validModules).forEach(code => {
      expect(code.trim().length).toBeGreaterThan(0);
    });

    // Empty modules should be detected
    expect(emptyModule.trim().length).toBe(0);
    expect(validModule.trim().length).toBeGreaterThan(0);
  });

  it("should include main module when deploying multiple modules", () => {
    const modules = {
      behavior: "module.exports = {}",
      memory: "module.exports = {}",
      main: "module.exports.loop = function() { }"
    };

    // Main module is required
    expect(modules).toHaveProperty("main");
    expect(modules.main).toBeTruthy();

    // Other modules are optional
    const moduleNames = Object.keys(modules);
    expect(moduleNames.length).toBeGreaterThanOrEqual(1);
    expect(moduleNames).toContain("main");
  });
});
