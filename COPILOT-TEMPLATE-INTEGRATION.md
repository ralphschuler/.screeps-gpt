# Copilot PR Template Integration - Manual Steps

This document outlines the manual workflow updates needed to complete the Copilot PR template integration from issue #130.

## Background

The specialized PR templates have been created and are ready for use:
- `.github/PULL_REQUEST_TEMPLATE/copilot-todo.md` - For Todo workflow automation
- `.github/PULL_REQUEST_TEMPLATE/copilot-quickfix.md` - For CI autofix automation

However, updating workflow files requires `workflows` permission which the GitHub App token doesn't have. These changes need to be applied manually by a repository maintainer.

## Required Workflow Updates

### 1. Update copilot-todo-pr.yml

In `.github/workflows/copilot-todo-pr.yml`, add the `PR_TEMPLATE` environment variable:

```yaml
      - name: Run Copilot Todo automation
        uses: ./.github/actions/copilot-exec
        env:
          REPO_NAME: "${{ github.repository }}"
          ISSUE_NUMBER: "${{ github.event.issue.number }}"
          ISSUE_TITLE: ${{ toJSON(github.event.issue.title) }}
          ISSUE_BODY: ${{ toJSON(github.event.issue.body || '') }}
          ISSUE_HTML_URL: ${{ toJSON(github.event.issue.html_url) }}
          ISSUE_AUTHOR: ${{ toJSON(github.event.issue.user.login) }}
          PR_TEMPLATE: "copilot-todo.md"  # <-- ADD THIS LINE
```

### 2. Update copilot-ci-autofix.yml

In `.github/workflows/copilot-ci-autofix.yml`, add the `PR_TEMPLATE` environment variable:

```yaml
      - name: Run Copilot CI auto-fix
        uses: ./.github/actions/copilot-exec
        env:
          REPO_NAME: "${{ github.repository }}"
          WORKFLOW_NAME: ${{ toJSON(github.event.workflow_run.name) }}
          RUN_ID: "${{ github.event.workflow_run.id }}"
          RUN_HTML_URL: ${{ toJSON(github.event.workflow_run.html_url || format('https://github.com/{0}/actions/runs/{1}', github.repository, github.event.workflow_run.id)) }}
          TRIGGER_EVENT: ${{ toJSON(github.event.workflow_run.event) }}
          EVENT_PATH: "${{ github.event_path }}"
          WORKSPACE: "${{ github.workspace }}"
          PR_TEMPLATE: "copilot-quickfix.md"  # <-- ADD THIS LINE
```

### 3. Update todo-issue prompt template

In `.github/copilot/prompts/todo-issue`, update the PR creation instruction:

**Find this section:**
```
- Create a DRAFT pull request immediately via `gh pr create --draft` that:
```

**Replace with:**
```
- Create a DRAFT pull request immediately via `gh pr create --draft --template ${PR_TEMPLATE}` that:
```

And update the bullet point:
```
     - Uses the specialized PR template for Todo automation workflow
```

### 4. Update ci-autofix prompt template

In `.github/copilot/prompts/ci-autofix`, update the PR creation instruction:

**Find this section:**
```
   - Open a new pull request targeting the affected branch with labels `automation` and `copilot` plus a short summary of the
     regression and verification.
```

**Replace with:**
```
   - Open a new pull request targeting the affected branch using `gh pr create --template ${PR_TEMPLATE}` with labels `automation` and `copilot` plus a short summary of the
     regression and verification.
```

## Expected Benefits After Integration

Once these changes are applied:

1. **Todo workflow PRs** will use the `copilot-todo.md` template, providing:
   - Automation-specific validation checklists
   - Context about the original Todo-labeled issue
   - Focused quality gates for Copilot-generated code
   - Reduced cognitive load by removing irrelevant manual steps

2. **CI autofix PRs** will use the `copilot-quickfix.md` template, providing:
   - CI failure context and diagnosis documentation
   - Targeted fix validation steps
   - Risk assessment and mitigation guidance
   - Root cause analysis requirements

3. **Improved reviewer experience** with:
   - More relevant context for automated changes
   - Clear guidance on what to review for each automation type
   - Better understanding of automated change scope and validation

## Testing Template Usage

After applying these changes, templates can be tested manually:

```bash
# Test Todo template
gh pr create --draft --template copilot-todo.md --title "Test PR" --body "Testing Todo template"

# Test quickfix template  
gh pr create --draft --template copilot-quickfix.md --title "Test PR" --body "Testing quickfix template"
```

## Completion Verification

After applying the changes, verify:
- [ ] Both workflow files have the `PR_TEMPLATE` environment variables
- [ ] Both prompt templates reference `--template ${PR_TEMPLATE}`
- [ ] Templates are accessible in the GitHub web interface at PR creation
- [ ] Test PR creation shows the specialized templates are used

## Related Files

This integration affects:
- `.github/PULL_REQUEST_TEMPLATE/copilot-todo.md` ✅ (created)
- `.github/PULL_REQUEST_TEMPLATE/copilot-quickfix.md` ✅ (created)
- `.github/workflows/copilot-todo-pr.yml` ⏳ (requires manual update)
- `.github/workflows/copilot-ci-autofix.yml` ⏳ (requires manual update)  
- `.github/copilot/prompts/todo-issue` ⏳ (requires manual update)
- `.github/copilot/prompts/ci-autofix` ⏳ (requires manual update)

---

**Issue Reference:** #130 - Create specific PR templates for Copilot automation workflows
**PR Reference:** #133 - Implementation with template creation complete