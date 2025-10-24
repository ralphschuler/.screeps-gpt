import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Spawn Monitor Workflow Structure", () => {
  const workflowPath = join(process.cwd(), ".github/workflows/screeps-spawn-monitor.yml");
  const workflowContent = readFileSync(workflowPath, "utf-8");

  it("should have scheduled trigger for 30-minute intervals", () => {
    // Verify the workflow runs every 30 minutes
    expect(workflowContent).toContain("schedule:");
    expect(workflowContent).toContain('cron: "*/30 * * * *"');
  });

  it("should support manual triggering", () => {
    // Verify workflow_dispatch is enabled for testing
    expect(workflowContent).toContain("workflow_dispatch:");
  });

  it("should use the screeps-autospawner action", () => {
    // Verify integration with existing autospawner action
    expect(workflowContent).toContain("uses: ./.github/actions/screeps-autospawner");
  });

  it("should pass required secrets to autospawner", () => {
    // Verify all necessary secrets are passed
    expect(workflowContent).toContain("secrets.SCREEPS_TOKEN");
    expect(workflowContent).toContain("vars.SCREEPS_HOST");
    expect(workflowContent).toContain("vars.SCREEPS_PORT");
    expect(workflowContent).toContain("vars.SCREEPS_PROTOCOL");
    expect(workflowContent).toContain("vars.SCREEPS_PATH");
  });

  it("should send push notifications for spawn loss", () => {
    // Verify notification on respawn event
    expect(workflowContent).toContain("Notify on spawn loss");
    expect(workflowContent).toContain("action-taken == 'respawned'");
    expect(workflowContent).toContain("send-push-notification");
    expect(workflowContent).toContain("Bot lost all spawns");
  });

  it("should send push notifications for spawn placement", () => {
    // Verify notification on spawn placement
    expect(workflowContent).toContain("Notify on spawn placement");
    expect(workflowContent).toContain("action-taken == 'spawn_placed'");
  });

  it("should send push notifications on failures", () => {
    // Verify notification on failure
    expect(workflowContent).toContain("Notify on spawn check failure");
    expect(workflowContent).toContain("if: failure()");
    expect(workflowContent).toContain("Manual intervention required");
  });

  it("should have appropriate permissions", () => {
    // Verify minimal permissions are set
    expect(workflowContent).toContain("permissions:");
    expect(workflowContent).toContain("contents: read");
    expect(workflowContent).toContain("issues: write");
  });

  it("should use priority 5 for critical notifications", () => {
    // Verify high priority for spawn loss and failures
    expect(workflowContent).toMatch(/priority:\s*["']5["']/);
  });

  it("should include workflow run links in notifications", () => {
    // Verify notifications link back to the workflow run
    expect(workflowContent).toContain("github.run_id");
    expect(workflowContent).toContain("actions/runs");
  });
});
