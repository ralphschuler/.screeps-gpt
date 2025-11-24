---
title: Writing Documentation
date: 2025-11-24
categories:
  - Documentation
tags:
  - documentation
  - hexo
  - contributing
---

# Writing Documentation

## Documentation Structure

Documentation for this project uses **Hexo** static site generator with the **Cactus theme**.

### Content Organization

The documentation follows a monorepo structure after the migration (issue #539):

- **`packages/docs/source/`** - All Hexo documentation content
  - `docs/` - Main documentation content
    - `operations/` - Operational runbooks and monitoring guides
    - `automation/` - Workflow and agent specifications
    - `runtime/` - Bot behavior and game logic documentation
    - `changelog/` - Version history and release notes
    - `analytics/` - Performance analytics and metrics
    - `security/` - Security guidelines and best practices
    - `documentation/` - Meta-documentation about writing docs
  - `_posts/` - Blog posts (generated from CHANGELOG.md releases)

- **`docs/`** (root) - Legacy location for non-Hexo docs
  - Used for quick-reference guides linked from README
  - Strategic documentation (`docs/strategy/`)
  - Agents should prefer `packages/docs/source/docs/` for structured documentation

### Navigation Customization

The theme navigation is configured in `packages/docs/_config.cactus.yml` under the `nav` section.

Current navigation structure:
- Home (/)
- Getting Started (/docs/getting-started.html)
- Documentation (/docs/)
- Analytics (/docs/analytics/)
- Automation (/docs/automation/)
- Operations (/docs/operations/)
- Runtime (/docs/runtime/)
- Security (/docs/security/)
- Changelog (/docs/changelog/)
- Blog (/archives/)
- Repository (external link to GitHub)

To add new navigation items:
1. Add entry to `_config.cactus.yml` `nav` section
2. Create corresponding content in `source/docs/` directory
3. Rebuild site with `yarn build` in `packages/docs/`

### Building the Documentation Site

From `packages/docs/`:
- `yarn build` - Generate static site to `public/`
- `yarn server` - Preview site locally at http://localhost:4000
- `yarn clean` - Clean build artifacts

The site is automatically deployed to GitHub Pages via `.github/workflows/docs-pages.yml` when changes are pushed to the `main` branch.

## Writing Guidelines

### File Organization

- Use descriptive filenames with hyphens (e.g., `stats-monitoring.md`)
- Group related documents in subdirectories
- Include an `index.md` in each directory as a navigation hub

### Front Matter

All markdown files should include YAML front matter:

```yaml
---
title: Your Page Title
date: 2025-11-24
categories:
  - Category Name
tags:
  - tag1
  - tag2
---
```

### Content Style

- Use clear, concise language
- Include code examples where relevant
- Link to related documentation using relative paths
- Add diagrams or images in `source/images/` directory
- Follow existing formatting conventions

### Agent Guidelines

Automation agents should follow these conventions:

1. **Always prefer `packages/docs/source/docs/`** for structured documentation
2. **Use root `docs/`** only for:
   - Strategic planning documents (`docs/strategy/`)
   - Legacy compatibility documents
   - Quick-reference guides that don't fit the Hexo structure
3. **Reference documentation paths correctly** in agent prompts:
   - Correct: `packages/docs/source/docs/operations/`
   - Incorrect: `docs/operations/`
4. **Generate blog posts** in `packages/docs/source/_posts/` using the changelog-to-blog workflow

## Theme Customization

The Hexo Cactus theme is cloned from the upstream repository during the build process (see `.github/workflows/docs-pages.yml`).

Theme customization is done via:
- `packages/docs/_config.cactus.yml` - Theme configuration overrides
- `packages/docs/_config.yml` - Main Hexo configuration

For advanced customization, you can override theme templates by creating files in `packages/docs/source/_data/` or by modifying the theme after it's cloned.

## Testing

The documentation site includes E2E tests to validate deployment:
- Tests are located in `tests/e2e/docs-site.test.ts`
- Tests run automatically after deployment via the `docs-pages.yml` workflow
- Tests verify key pages are generated and accessible

## Troubleshooting

### Build Errors

If the build fails:
1. Check for syntax errors in markdown files
2. Verify front matter is valid YAML
3. Ensure all linked files exist
4. Run `yarn clean` and rebuild

### Navigation Not Updating

If navigation changes don't appear:
1. Verify `_config.cactus.yml` syntax is correct
2. Clear cache with `yarn clean`
3. Rebuild with `yarn build`
4. Check that theme was cloned successfully

### Missing Pages

If pages don't generate:
1. Verify front matter includes `title` field
2. Check file is in `source/` directory
3. Ensure file extension is `.md`
4. Look for errors in build output

## References

- [Hexo Documentation](https://hexo.io/docs/)
- [Hexo Cactus Theme](https://github.com/probberechts/hexo-theme-cactus)
- [Repository Automation Overview](../automation/overview.md)
- [AGENTS.md Knowledge Base](https://github.com/ralphschuler/.screeps-gpt/blob/main/AGENTS.md)
