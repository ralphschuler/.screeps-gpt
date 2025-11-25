/**
 * Reset Spawn Recovery Circuit Breaker
 *
 * Utility script to manually reset the circuit breaker after manual intervention.
 * Should only be used after spawn has been manually placed and bot is operational.
 */
import { resetCircuitBreaker, getRecoveryStats } from "./spawn-recovery-tracker.js";

async function main(): Promise<void> {
  console.log("🔧 Resetting spawn recovery circuit breaker...");

  // Get current stats before reset
  const statsBefore = await getRecoveryStats();
  console.log("\nCurrent state:");
  console.log(`  Circuit breaker active: ${statsBefore.circuitBreakerActive}`);
  console.log(`  Recent attempts: ${statsBefore.recentAttempts}`);
  console.log(`  Total attempts: ${statsBefore.totalAttempts}`);
  console.log(`  Successful: ${statsBefore.successfulAttempts}`);
  console.log(`  Failed: ${statsBefore.failedAttempts}`);

  if (!statsBefore.circuitBreakerActive) {
    console.log("\n✅ Circuit breaker is not currently active. No reset needed.");
    return;
  }

  // Reset the circuit breaker
  await resetCircuitBreaker();

  // Get stats after reset
  const statsAfter = await getRecoveryStats();
  console.log("\n✅ Circuit breaker reset successfully!");
  console.log(`  Circuit breaker active: ${statsAfter.circuitBreakerActive}`);
  console.log(`  Next spawn recovery attempt will be allowed.`);

  console.log("\n⚠️  Important:");
  console.log("  - Ensure spawn has been manually placed before resetting");
  console.log("  - Verify bot is operational before next scheduled check");
  console.log("  - Monitor logs for successful operation");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("❌ Failed to reset circuit breaker:", error);
    process.exit(1);
  });
}
