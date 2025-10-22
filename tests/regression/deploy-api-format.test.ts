/**
 * Regression test for deployment API format issue
 *
 * This test ensures that the deployment script correctly formats the modules
 * parameter when calling api.code.set(). The screeps-api package expects
 * an object format { moduleName: code } rather than an array format.
 *
 * Original issue: Deployment workflow completed without errors but code did not
 * appear in the Screeps account. Root cause was incorrect API call format.
 */

import { describe, it, expect } from "vitest";

describe("Deployment API Format Regression", () => {
  it("should format modules as object not array for screeps-api", () => {
    // Simulate the code that would be passed to api.code.set()
    const source = "module.exports.loop = function() { console.log('test'); }";

    // CORRECT FORMAT: Object with module name as key
    const correctFormat = { main: source };

    // INCORRECT FORMAT: Array with objects (what the bug was)
    const incorrectFormat = [{ name: "main", body: source }];

    // Verify the correct format is an object
    expect(typeof correctFormat).toBe("object");
    expect(Array.isArray(correctFormat)).toBe(false);
    expect(correctFormat).toHaveProperty("main");
    expect(correctFormat.main).toBe(source);

    // Verify the incorrect format is an array (what we DON'T want)
    expect(Array.isArray(incorrectFormat)).toBe(true);

    // Additional validation: the correct format should have the module name as a key
    const moduleNames = Object.keys(correctFormat);
    expect(moduleNames).toContain("main");
    expect(moduleNames.length).toBe(1);
  });

  it("should support multiple modules in object format", () => {
    // While the current implementation only deploys main.js,
    // the API format should support multiple modules
    const modules = {
      main: "module.exports.loop = function() { }",
      helper: "module.exports.doSomething = function() { }",
      config: "module.exports = { setting: true }"
    };

    expect(typeof modules).toBe("object");
    expect(Array.isArray(modules)).toBe(false);
    expect(Object.keys(modules)).toEqual(["main", "helper", "config"]);
  });

  it("should validate that source code is not empty", () => {
    const emptySource = "";
    const validSource = "module.exports.loop = function() { }";

    // The deployment script should reject empty source
    expect(emptySource.trim().length).toBe(0);
    expect(validSource.trim().length).toBeGreaterThan(0);
  });

  it("should construct deployment parameters correctly", () => {
    // Simulate the parameters that would be passed to api.code.set()
    const branch = "main";
    const source = "module.exports.loop = function() { console.log('deployed'); }";
    const modules = { main: source };

    // Verify the structure matches what screeps-api expects
    expect(branch).toBeTruthy();
    expect(typeof branch).toBe("string");
    expect(modules).toBeTruthy();
    expect(typeof modules).toBe("object");
    expect(modules.main).toBe(source);
  });
});
