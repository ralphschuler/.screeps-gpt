#!/usr/bin/env tsx
/**
 * GitHub Projects Configuration Validator
 *
 * This script validates that the GitHub Projects integration is properly configured
 * and can access the specified project board. It helps diagnose issues like:
 * - Project doesn't exist
 * - Permissions insufficient
 * - Project number mismatch
 * - Missing repository variables
 *
 * Usage:
 *   npm run validate:project-config
 *   tsx scripts/validate-project-config.ts --project-number 1 --project-owner username
 *
 * Environment Variables:
 *   GITHUB_TOKEN - GitHub token with project scope (required)
 *   PROJECT_NUMBER - Project number to validate (optional, uses arg if provided)
 *   PROJECT_OWNER - Project owner username/org (optional, uses arg if provided)
 */

import { spawnSync } from "child_process";

interface ValidationResult {
  success: boolean;
  message: string;
  details?: string;
}

interface ProjectInfo {
  id: string;
  title: string;
  number: number;
  url: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { projectNumber?: string; projectOwner?: string } {
  const args = process.argv.slice(2);
  const result: { projectNumber?: string; projectOwner?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-number" && args[i + 1]) {
      result.projectNumber = args[i + 1];
      i++;
    } else if (args[i] === "--project-owner" && args[i + 1]) {
      result.projectOwner = args[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
function checkGitHubCLI(): ValidationResult {
  const result = spawnSync("gh", ["--version"], {
    encoding: "utf-8"
  });

  if (result.status !== 0) {
    return {
      success: false,
      message: "GitHub CLI (gh) is not installed",
      details: "Install from: https://cli.github.com/ or run: brew install gh / apt install gh"
    };
  }

  const authResult = spawnSync("gh", ["auth", "status"], {
    encoding: "utf-8"
  });

  if (authResult.status !== 0) {
    return {
      success: false,
      message: "GitHub CLI is not authenticated",
      details: "Run: gh auth login or set GITHUB_TOKEN environment variable"
    };
  }

  return {
    success: true,
    message: "GitHub CLI is installed and authenticated"
  };
}

/**
 * Check for GITHUB_TOKEN environment variable
 */
function checkGitHubToken(): ValidationResult {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    return {
      success: false,
      message: "GITHUB_TOKEN environment variable is not set",
      details: "Set GITHUB_TOKEN or GH_TOKEN with a token that has 'project' scope"
    };
  }

  return {
    success: true,
    message: "GITHUB_TOKEN is set"
  };
}

/**
 * Get project configuration from environment or arguments
 */
function getProjectConfig(args: { projectNumber?: string; projectOwner?: string }): {
  projectNumber: string | null;
  projectOwner: string | null;
} {
  return {
    projectNumber: args.projectNumber || process.env.PROJECT_NUMBER || null,
    projectOwner: args.projectOwner || process.env.PROJECT_OWNER || null
  };
}

/**
 * List available projects for a user/organization
 */
function listProjects(owner: string): ProjectInfo[] {
  const result = spawnSync("gh", ["project", "list", "--owner", owner, "--format", "json"], {
    encoding: "utf-8"
  });

  if (result.status !== 0) {
    console.error("Failed to list projects:", result.stderr);
    return [];
  }

  try {
    const output = result.stdout;
    const projects = JSON.parse(output);
    return projects.projects || [];
  } catch (error) {
    console.error("Failed to parse project list:", error);
    return [];
  }
}

/**
 * Validate project access using GraphQL API
 */
function validateProjectAccess(owner: string, projectNumber: string): ValidationResult {
  // Validate owner format to prevent injection
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) {
    return {
      success: false,
      message: "Invalid owner format",
      details: "Owner must contain only alphanumeric characters and hyphens"
    };
  }

  // Validate projectNumber is numeric
  if (!/^\d+$/.test(projectNumber)) {
    return {
      success: false,
      message: "Invalid project number format",
      details: "Project number must be numeric"
    };
  }

  const query = `
    query {
      user(login: "${owner}") {
        projectV2(number: ${projectNumber}) {
          id
          title
          number
          url
        }
      }
    }
  `;

  const result = spawnSync("gh", ["api", "graphql", "-f", `query=${query}`], {
    encoding: "utf-8"
  });

  if (result.status !== 0) {
    const errorOutput = result.stderr;
    return {
      success: false,
      message: `Cannot access project ${projectNumber} for ${owner}`,
      details: errorOutput
    };
  }

  try {
    const output = JSON.parse(result.stdout);
    if (output.data?.user?.projectV2) {
      const project = output.data.user.projectV2;
      return {
        success: true,
        message: `Successfully accessed project ${projectNumber}`,
        details: `Project: "${project.title}" (${project.url})`
      };
    } else if (output.errors) {
      return {
        success: false,
        message: `GraphQL error accessing project ${projectNumber}`,
        details: JSON.stringify(output.errors, null, 2)
      };
    } else {
      return {
        success: false,
        message: `Project ${projectNumber} not found for ${owner}`,
        details: "Project may not exist or may be organization-scoped"
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to parse API response",
      details: String(error)
    };
  }
}

/**
 * Main validation function
 */
function main() {
  console.log("🔍 GitHub Projects Configuration Validator\n");

  const args = parseArgs();

  // Step 1: Check GitHub CLI
  console.log("1️⃣  Checking GitHub CLI...");
  const cliCheck = checkGitHubCLI();
  console.log(cliCheck.success ? "   ✅" : "   ❌", cliCheck.message);
  if (cliCheck.details) console.log("      ", cliCheck.details);
  if (!cliCheck.success) {
    process.exit(1);
  }
  console.log();

  // Step 2: Check GitHub Token
  console.log("2️⃣  Checking GitHub token...");
  const tokenCheck = checkGitHubToken();
  console.log(tokenCheck.success ? "   ✅" : "   ❌", tokenCheck.message);
  if (tokenCheck.details) console.log("      ", tokenCheck.details);
  if (!tokenCheck.success) {
    console.log("      Note: Token is optional if gh CLI is authenticated\n");
  }
  console.log();

  // Step 3: Get project configuration
  console.log("3️⃣  Reading project configuration...");
  const config = getProjectConfig(args);

  if (!config.projectNumber || !config.projectOwner) {
    console.log("   ⚠️  Project configuration incomplete");
    console.log("       PROJECT_NUMBER:", config.projectNumber || "NOT SET");
    console.log("       PROJECT_OWNER:", config.projectOwner || "NOT SET");
    console.log("\n   💡 Set repository variables or pass as arguments:");
    console.log("       bun scripts/validate-project-config.ts --project-number 1 --project-owner username\n");
    process.exit(1);
  }

  console.log("   ✅ Configuration found");
  console.log("       PROJECT_NUMBER:", config.projectNumber);
  console.log("       PROJECT_OWNER:", config.projectOwner);
  console.log();

  // Step 4: List available projects
  console.log(`4️⃣  Listing projects for ${config.projectOwner}...`);
  const projects = listProjects(config.projectOwner);

  if (projects.length === 0) {
    console.log("   ⚠️  No projects found or unable to list projects");
    console.log("       This could indicate permission issues or no projects exist\n");
  } else {
    console.log(`   ✅ Found ${projects.length} project(s):`);
    projects.forEach(project => {
      const isCurrent = project.number === parseInt(config.projectNumber!);
      console.log(`       ${isCurrent ? "→" : " "} #${project.number}: ${project.title}`);
    });
    console.log();
  }

  // Step 5: Validate access to specific project
  console.log(`5️⃣  Validating access to project #${config.projectNumber}...`);
  const validation = validateProjectAccess(config.projectOwner, config.projectNumber);

  console.log(validation.success ? "   ✅" : "   ❌", validation.message);
  if (validation.details) {
    console.log("      ", validation.details);
  }
  console.log();

  if (!validation.success) {
    console.log("❌ Validation failed\n");
    console.log("💡 Troubleshooting steps:");
    console.log("   1. Verify the project number is correct (check available projects above)");
    console.log("   2. Ensure the project is user-scoped (not organization-scoped)");
    console.log("   3. Check that your GitHub token has 'project' scope");
    console.log("   4. Verify the PROJECT_OWNER matches the project owner");
    console.log("   5. See: docs/automation/github-projects-setup.md\n");
    process.exit(1);
  }

  console.log("✅ Validation successful!");
  console.log("   Project configuration is correct and accessible\n");
}

main();
