import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

interface WorkflowTest {
  readonly name: string;
  readonly workflowPath: string;
  readonly eventName: string;
  readonly eventFile: string;
  readonly extraArgs?: readonly string[];
}

async function runCommand(command: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit"
    });
    child.on("error", error => rejectPromise(error));
    child.on("exit", code => {
      if (code && code !== 0) {
        rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      } else {
        resolvePromise();
      }
    });
  });
}

async function ensureActBinary(binary: string): Promise<void> {
  try {
    await runCommand(binary, ["--version"]);
  } catch (error) {
    throw new Error(
      `The act CLI is required to validate workflows. Install it from https://github.com/nektos/act and ensure '${binary}' is on your PATH.`
    );
  }
}

async function testWorkflows(): Promise<void> {
  await runCommand("pnpm", ["run", "format:check"]);
  await runCommand("pnpm", ["run", "lint"]);

  if ((process.env.ACT_SKIP ?? "").toLowerCase() === "true") {
    console.warn("ACT_SKIP is set; skipping act workflow checks.");
    return;
  }

  const actBinary = process.env.ACT_BINARY ?? "act";
  await ensureActBinary(actBinary);

  const secretsFile = resolve("tests/actions/secrets.env");
  try {
    await access(secretsFile);
  } catch (error) {
    throw new Error(`Missing secrets file for act at ${secretsFile}`);
  }

  const workflows: WorkflowTest[] = [
    {
      name: "Quality Gate",
      workflowPath: ".github/workflows/quality-gate.yml",
      eventName: "pull_request",
      eventFile: "tests/actions/events/pull_request.json"
    },
    {
      name: "Post Merge Release",
      workflowPath: ".github/workflows/post-merge-release.yml",
      eventName: "push",
      eventFile: "tests/actions/events/push_main.json"
    },
    {
      name: "Deploy Screeps AI",
      workflowPath: ".github/workflows/deploy.yml",
      eventName: "push",
      eventFile: "tests/actions/events/push_tag.json"
    },
    {
      name: "Docs Pages",
      workflowPath: ".github/workflows/docs-pages.yml",
      eventName: "push",
      eventFile: "tests/actions/events/push_main.json"
    },
    {
      name: "Copilot Email Triage",
      workflowPath: ".github/workflows/copilot-email-triage.yml",
      eventName: "repository_dispatch",
      eventFile: "tests/actions/events/repository_dispatch_email.json"
    }
  ];

  for (const workflow of workflows) {
    const args = [
      "--dryrun",
      workflow.eventName,
      "-W",
      workflow.workflowPath,
      "-e",
      workflow.eventFile,
      "--secret-file",
      secretsFile,
      "--actor",
      "actions-tester",
      "--env",
      "SCREEPS_DEPLOY_DRY_RUN=true"
    ];
    if (workflow.extraArgs) {
      args.push(...workflow.extraArgs);
    }

    console.log(`\n▶︎ Validating ${workflow.name} (${workflow.workflowPath})`);
    await runCommand(actBinary, args);
  }
}

testWorkflows().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
