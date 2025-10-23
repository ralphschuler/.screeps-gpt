# Spec-Kit Integration Summary

This document summarizes how spec-kit is integrated into the Screeps GPT repository.

## What Was Added

### Directory Structure

```
.specify/
├── INTEGRATION.md                              # This file
├── README.md                                   # Complete usage guide
├── memory/
│   └── constitution.md                         # Project principles
├── scripts/
│   └── setup-prerequisites.sh                  # Environment validator
├── specs/
│   └── 001-example-energy-optimizer/
│       └── spec.md                             # Example specification
└── templates/
    ├── plan-template.md                        # Technical plan template
    ├── spec-template.md                        # Specification template
    └── tasks-template.md                       # Task breakdown template
```

### GitHub Actions Workflow

- **`.github/workflows/spec-kit-validate.yml`**
  - Validates spec-kit structure on PR/push
  - Checks required files and directories
  - Validates template integrity
  - Read-only permissions (secure)

### Documentation Updates

- **`README.md`**: Added spec-kit overview section
- **`docs/automation/overview.md`**: Added comprehensive spec-kit integration section
- **`CHANGELOG.md`**: Documented changes in [Unreleased] section

## How It Works

### 1. Specification Phase

Developers use AI assistants (GitHub Copilot, Claude Code, etc.) with spec-kit slash commands:

```
/speckit.specify Build a new feature for optimizing energy harvesting
```

This creates `.specify/specs/XXX-feature-name/spec.md` following the template.

### 2. Planning Phase

Define technical approach:

```
/speckit.plan Use TypeScript strict mode, integrate with src/runtime/behavior/
```

Generates `plan.md` with architecture, file structure, dependencies.

### 3. Task Breakdown

Create actionable tasks:

```
/speckit.tasks
```

Produces `tasks.md` with ordered, dependency-aware implementation tasks.

### 4. Implementation

Execute systematically:

```
/speckit.implement
```

AI assistant implements all tasks, runs tests, updates documentation.

## Integration Points

### Existing Automation

Spec-kit works alongside existing workflows:

- **Copilot Todo PR** (`copilot-todo-pr.yml`): Can reference spec-kit specifications
- **Copilot Exec** (`.github/actions/copilot-exec`): Renders spec-kit prompts
- **Quality Gates** (`guard-*.yml`): Validates all spec-kit generated code

### Constitution Alignment

The `.specify/memory/constitution.md` aligns with repository standards:

- Strict TypeScript compliance
- Test-driven development
- Minimal changes principle
- Security-first approach
- Performance requirements

### MCP Server Support

Spec-kit leverages existing MCP infrastructure:

- GitHub MCP server for repository context
- Automatic prompt rendering
- Result caching for efficiency

## Setup Instructions

### Prerequisites

1. **Python 3.11+**: Required for spec-kit CLI
2. **uv package manager**: Install with `curl -LsSf https://astral.sh/uv/install.sh | sh`
3. **spec-kit CLI**: Install with `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`

### Verification

Run the prerequisites checker:

```bash
./.specify/scripts/setup-prerequisites.sh
```

This validates all requirements and provides guidance for missing components.

### First Steps

1. Review the constitution: `cat .specify/memory/constitution.md`
2. Explore templates: `ls .specify/templates/`
3. Check example spec: `cat .specify/specs/001-example-energy-optimizer/spec.md`
4. Read full documentation: `cat .specify/README.md`

## Benefits

### Structured Development

- Clear progression: idea → spec → plan → tasks → code
- Consistent quality through templates
- Review checklists at each phase

### AI Optimization

- Structured context improves AI code quality
- Templates provide clear guidance
- Constitution ensures alignment with standards

### Documentation

- Specifications serve as living documentation
- Plans document architectural decisions
- Tasks provide implementation roadmap

### Quality Assurance

- All code passes existing quality gates
- Tests required before implementation
- Security validation via CodeQL

## Compatibility

Spec-kit is designed to enhance, not replace:

- ✅ Works with `copilot-exec` and Copilot CLI
- ✅ Respects security and permission guidelines
- ✅ Integrates with existing quality gates
- ✅ Uses same MCP server infrastructure
- ✅ Follows conventional commit format

## Example Workflow

Real-world example of using spec-kit:

1. **Define requirement**: "Optimize energy harvesting efficiency"
2. **Create spec** (`/speckit.specify`): User stories, acceptance criteria
3. **Clarify** (`/speckit.clarify`): Resolve ambiguities
4. **Plan** (`/speckit.plan`): TypeScript implementation with Vitest tests
5. **Break down** (`/speckit.tasks`): Ordered tasks with dependencies
6. **Implement** (`/speckit.implement`): AI executes tasks systematically
7. **Validate**: Run `npm run lint && npm run test:unit`
8. **Commit**: Following conventional commit format

See `.specify/specs/001-example-energy-optimizer/spec.md` for a complete example.

## Troubleshooting

### Commands not available in AI assistant

- Verify spec-kit is installed: `specify check`
- Ensure you're in project root directory
- Check `.specify/` directory exists
- Restart AI assistant

### Templates not being followed

- Review constitution: `.specify/memory/constitution.md`
- Explicitly reference templates in prompts
- Use `/speckit.constitution` to reinforce principles

### Quality gate failures

Run checks locally:

```bash
npm run lint
npm run format:write
npm run test:unit
npm run build
```

Address failures incrementally before committing.

## Resources

- **Spec-kit Repository**: https://github.com/github/spec-kit
- **Spec-kit Documentation**: https://github.github.io/spec-kit/
- **Repository Docs**: `docs/automation/overview.md`
- **GitHub Blog**: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/

## Support

For spec-kit issues:

- GitHub: https://github.com/github/spec-kit/issues

For integration questions:

- Review: `docs/automation/overview.md`
- Check workflows: `.github/workflows/`
- Read: `AGENTS.md`
