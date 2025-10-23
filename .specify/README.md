# Spec-Kit Integration

This directory contains the spec-kit configuration and templates for specification-driven development (SDD) in the Screeps GPT project.

## Overview

[Spec-kit](https://github.com/github/spec-kit) is GitHub's toolkit for Spec-Driven Development, enabling structured development workflows where specifications become executable through AI-assisted implementation.

## Directory Structure

```
.specify/
├── README.md                   # This file
├── memory/
│   └── constitution.md         # Project principles and governance
├── scripts/                    # Helper scripts for spec-kit workflows
│   └── setup-prerequisites.sh  # Verify spec-kit installation
├── specs/                      # Feature specifications (one per feature)
│   └── XXX-feature-name/
│       ├── spec.md             # Functional requirements
│       ├── plan.md             # Technical implementation plan
│       └── tasks.md            # Task breakdown
└── templates/                  # Templates for specifications
    ├── spec-template.md        # Specification template
    ├── plan-template.md        # Implementation plan template
    └── tasks-template.md       # Task breakdown template
```

## Getting Started

### Prerequisites

1. **Install uv package manager** (required for spec-kit):

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install spec-kit CLI**:

   ```bash
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```

3. **Verify installation**:
   ```bash
   specify check
   ```

### Initial Setup

The spec-kit structure is already initialized in this repository. To work with spec-kit:

1. **Review the constitution**:

   ```bash
   cat .specify/memory/constitution.md
   ```

   This defines the project's development principles and guidelines.

2. **Launch your AI assistant** (GitHub Copilot, Claude Code, etc.):

   ```bash
   # For GitHub Copilot in VS Code
   code .

   # For Claude Code CLI
   claude

   # For other AI assistants, refer to spec-kit documentation
   ```

3. **Verify slash commands are available**:
   You should see these commands in your AI assistant:
   - `/speckit.constitution` - Update project principles
   - `/speckit.specify` - Create feature specifications
   - `/speckit.plan` - Generate technical plans
   - `/speckit.tasks` - Break down into actionable tasks
   - `/speckit.implement` - Execute implementation

## Spec-Driven Development Workflow

### 1. Define Requirements (`/speckit.specify`)

Create a new feature specification:

```bash
/speckit.specify Build a new creep behavior that optimizes energy harvesting by calculating the most efficient path between sources and spawn points, considering traffic and source depletion rates.
```

This creates a new specification in `.specify/specs/XXX-feature-name/spec.md`.

### 2. Create Technical Plan (`/speckit.plan`)

Define the technical approach:

```bash
/speckit.plan Use TypeScript strict mode, integrate with existing src/runtime/behavior/ modules, add CPU tracking via src/runtime/metrics/, persist state using src/runtime/memory/ helpers, and include Vitest unit tests in tests/unit/.
```

This generates `plan.md` with architecture details, file structure, and testing strategy.

### 3. Generate Task Breakdown (`/speckit.tasks`)

Break the plan into actionable tasks:

```bash
/speckit.tasks
```

This creates `tasks.md` with ordered, dependency-aware tasks ready for implementation.

### 4. Implement Feature (`/speckit.implement`)

Execute all tasks systematically:

```bash
/speckit.implement
```

The AI assistant will:

- Execute tasks in correct order
- Respect dependencies and parallel execution
- Follow TDD approach
- Run tests and validation
- Update documentation

### 5. Clarify Requirements (Optional)

Before planning, use clarification to resolve ambiguities:

```bash
/speckit.clarify
```

This runs structured questioning to fill gaps in the specification.

## Integration with Existing Automation

Spec-kit integrates seamlessly with the repository's automation:

### GitHub Actions Integration

- **Copilot Todo PR** (`copilot-todo-pr.yml`): Issues labeled `Todo` can reference spec-kit specifications
- **Copilot Exec** (`.github/actions/copilot-exec`): Spec-kit prompts can be rendered through this action
- **Quality Gates**: All spec-kit generated code goes through existing lint, format, and test checks

### MCP Server Support

The `copilot-exec` action supports spec-kit through:

- GitHub MCP server for repository operations
- Automatic prompt rendering
- Result caching for efficiency

### Documentation Workflow

Spec-kit updates integrate with:

- `CHANGELOG.md` - Add features to [Unreleased] section
- `docs/` - Technical documentation updates
- `README.md` - User-facing feature documentation

## Best Practices

### Specification Quality

- **Be explicit**: Define what, why, and user impact clearly
- **Use concrete examples**: Real scenarios help AI understand intent
- **Define success metrics**: How will you measure completion?
- **Document constraints**: Technical, performance, compatibility

### Planning Quality

- **Reference existing code**: Point to `src/` modules to integrate with
- **Specify test strategy**: Unit, integration, and regression tests
- **Consider performance**: CPU, memory, build time impacts
- **Document dependencies**: Both internal and external

### Implementation Quality

- **Follow constitution**: Align with project principles
- **Make minimal changes**: Surgical fixes over rewrites
- **Write tests first**: TDD approach for all features
- **Validate incrementally**: Test at each checkpoint

## Troubleshooting

### Spec-kit commands not available

1. Verify spec-kit is installed: `specify check`
2. Ensure you're in the project root directory
3. Check `.specify/` directory exists and has correct structure
4. Restart your AI assistant to reload configuration

### AI assistant not following templates

1. Review `.specify/memory/constitution.md` for guidelines
2. Explicitly reference templates in prompts:
   ```
   Follow the spec-template.md format in .specify/templates/
   ```
3. Use `/speckit.constitution` to reinforce principles

### Integration with existing code failing

1. Review existing code structure in `src/`
2. Reference specific modules in technical plan
3. Use internal utilities from `src/shared/` and `src/runtime/`
4. Run tests incrementally: `npm run test:unit`

### Quality gate failures

1. Run checks locally before committing:
   ```bash
   npm run lint
   npm run format:write
   npm run test:unit
   npm run build
   ```
2. Address failures incrementally
3. Commit early and often with clear messages

## GitHub Actions Workflow

A GitHub Actions workflow (`.github/workflows/spec-kit-validate.yml`) validates spec-kit structure:

- Checks `.specify/` directory structure
- Validates template integrity
- Ensures constitution is present
- Runs on pull requests and pushes to main

## References

- **Spec-kit Repository**: https://github.com/github/spec-kit
- **Spec-kit Documentation**: https://github.github.io/spec-kit/
- **Quick Start Guide**: https://github.github.io/spec-kit/quickstart.html
- **Project Documentation**: See `docs/automation/overview.md`
- **GitHub Blog Post**: [Spec-driven development with AI](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)

## Support

For spec-kit specific issues:

- Open an issue in the [spec-kit repository](https://github.com/github/spec-kit/issues)

For integration questions:

- Reference `docs/automation/overview.md`
- Check existing workflows in `.github/workflows/`
- Review `AGENTS.md` for automation guidelines
