# Hexo Documentation Site

This directory contains the Hexo-based documentation site for the Screeps GPT project, deployed to GitHub Pages at https://ralphschuler.github.io/.screeps-gpt/

## Structure

```
packages/docs/
├── _config.yml                 # Main Hexo configuration
├── _config.cactus.yml         # Cactus theme configuration (navigation, branding)
├── source/                     # Source content
│   ├── _posts/                # Blog posts
│   ├── docs/                  # Documentation pages
│   │   ├── analytics/         # Analytics documentation
│   │   ├── automation/        # Automation & workflows
│   │   ├── changelog/         # Version history
│   │   ├── operations/        # Operations & monitoring
│   │   ├── runtime/           # Runtime behavior
│   │   └── security/          # Security practices
│   └── index.md               # Home page
├── themes/                     # Hexo themes
│   └── cactus/                # Cactus theme (git clone)
└── public/                     # Generated site (gitignored)
```

## Navigation Structure

The documentation site has a top-level navigation menu configured in `_config.cactus.yml`:

- **Home** (`/`) - Landing page with recent blog posts
- **Getting Started** (`/docs/getting-started.html`) - Setup and onboarding guide
- **Documentation** (`/docs/`) - Main documentation index
- **Analytics** (`/docs/analytics.html`) - Performance metrics dashboard
- **Automation** (`/docs/automation/`) - CI/CD workflows and automation
- **Operations** (`/docs/operations/`) - Deployment and monitoring
- **Runtime** (`/docs/runtime/`) - Bot runtime behavior and strategy
- **Security** (`/docs/security/`) - Security practices and vulnerability management
- **Changelog** (`/docs/changelog/`) - Version history and release notes
- **Blog** (`/archives/`) - Blog post archives

## Documentation Sections

Each major documentation section has an index page that provides:

- Section overview and purpose
- List of available documentation in that section
- Links to related documentation
- Quick links to relevant external resources

### Section Index Pages

- `source/docs/analytics/index.md` - Analytics section overview
- `source/docs/automation/index.md` - Automation section overview
- `source/docs/changelog/index.md` - Changelog section overview
- `source/docs/operations/index.md` - Operations section overview
- `source/docs/runtime/index.md` - Runtime section overview
- `source/docs/security/index.md` - Security section overview

## Adding New Documentation

### Creating a New Documentation Page

1. Create a markdown file in the appropriate section directory under `source/docs/`
2. Add front matter with title, date, and layout:

```markdown
---
title: Your Page Title
date: 2025-11-17T12:00:00.000Z
layout: page
---

# Your Page Title

Content goes here...
```

3. Update the section's `index.md` to link to your new page
4. Build and test: `bun run build` in the `packages/docs` directory

### Creating a New Documentation Section

1. Create a new directory under `source/docs/` (e.g., `source/docs/newsection/`)
2. Create an `index.md` file in the new directory with section overview
3. Add documentation files to the section
4. Update `_config.cactus.yml` to add the section to the navigation menu:

```yaml
nav:
  Home: /
  # ... existing entries
  New Section: /docs/newsection/ # Add your new section
  # ... rest of entries
```

5. Update `source/docs/index.md` to link to the new section
6. Rebuild the site to verify changes

### Creating Blog Posts

Blog posts go in `source/_posts/` and use a different front matter format:

```markdown
---
title: Post Title
date: 2025-11-17 12:00:00
categories:
  - Release Notes
tags:
  - release
  - documentation
---

Post content goes here...
```

Posts automatically appear on the home page and in archives.

## Theme Configuration

The Cactus theme is configured via `_config.cactus.yml`. Key configuration options:

### Navigation Menu

```yaml
nav:
  Home: /
  Documentation: /docs/
  # Add more menu items here
```

### Social Links

```yaml
social_links:
  - icon: github
    label: GitHub Repository
    link: https://github.com/ralphschuler/.screeps-gpt
```

### Appearance

```yaml
colorscheme: white # Options: white, dark, classic
logo:
  enabled: true
  url: /images/logo.png
```

## Search Configuration

The site uses hexo-generator-search for full-text search. Configuration in `_config.yml`:

```yaml
search:
  path: search.xml
  field: all # Search both posts AND pages
  content: true # Include full content in search index
```

The search indexes all documentation pages and blog posts, making content discoverable through the search interface.

## Building the Documentation Site

### Local Development

```bash
# Install dependencies
cd packages/docs
npm install  # or bun install

# Start development server
npm run server  # or bun run server

# Visit http://localhost:4000
```

### Production Build

```bash
# From repository root
bun run build:docs-site

# Output will be in build/docs-site/
```

The build script (`packages/utilities/scripts/build-hexo-site.ts`):

1. Clones the Cactus theme if not present
2. Initializes Hexo and loads plugins
3. Generates the static site
4. Copies output to `build/docs-site/`

### Deployment

The site is automatically deployed to GitHub Pages via `.github/workflows/docs-pages.yml`:

- Triggered on pushes to `main` branch
- Triggered on new releases
- Can be manually triggered via workflow_dispatch

Deployment URL: https://ralphschuler.github.io/.screeps-gpt/

## Theme Management

The Cactus theme is cloned from the GitHub repository at build time:

- Repository: https://github.com/probberechts/hexo-theme-cactus
- Location: `packages/docs/themes/cactus/`
- Not committed to repository (cloned fresh on each build)

The build script automatically handles theme cloning, so contributors don't need to manually manage the theme.

## Authoring Guidelines

### Style Guide

- Use clear, concise language
- Include code examples where appropriate
- Add cross-references to related documentation
- Keep documents focused on a single topic
- Update index pages when adding new content

### Front Matter

All documentation pages should include:

```yaml
---
title: Page Title
date: YYYY-MM-DDTHH:MM:SS.SSSZ
layout: page
---
```

Blog posts should include:

```yaml
---
title: Post Title
date: YYYY-MM-DD HH:MM:SS
categories:
  - Category Name
tags:
  - tag1
  - tag2
---
```

### Linking

- Use relative links for internal documentation: `[Link Text](../section/page.html)`
- Use absolute URLs for external links: `[GitHub](https://github.com/...)`
- Always use `.html` extension for generated pages (Hexo adds this)

### Images and Assets

- Place images in `source/images/`
- Reference with absolute paths: `![Alt text](/images/image.png)`
- Include descriptive alt text for accessibility

## Testing

### E2E Tests

Documentation site E2E tests are in `tests/e2e/docs-site.test.ts` and validate:

- Site accessibility and navigation
- Search functionality
- Link integrity
- Section index pages

Run tests:

```bash
bun run test:e2e tests/e2e/docs-site.test.ts
```

### Manual Validation

After making changes:

1. Build the site: `bun run build:docs-site`
2. Check console output for warnings or errors
3. Verify all pages generated correctly
4. Test navigation links
5. Search for newly added content
6. Review generated HTML in `build/docs-site/`

## Troubleshooting

### Theme Not Found

If you see "No layout" warnings, the Cactus theme may not be cloned:

```bash
cd packages/docs/themes
git clone https://github.com/probberechts/hexo-theme-cactus.git cactus
```

### Navigation Not Updating

After updating `_config.cactus.yml`, do a clean rebuild:

```bash
cd packages/docs
npm run clean
npm run build
```

### Search Not Working

Ensure search configuration in `_config.yml` has:

```yaml
search:
  path: search.xml
  field: all
  content: true
```

### Links Broken

- Always use `.html` extensions for generated pages
- Use relative paths for internal links
- Remember the site is deployed to a subdirectory: `/.screeps-gpt/`

## Maintenance

### Regular Tasks

- **Update Changelog**: Keep `source/docs/changelog/versions.md` in sync with root `CHANGELOG.md`
- **Review Navigation**: Ensure new sections are added to navigation menu
- **Update Index Pages**: Keep section indexes current when adding new documentation
- **Test Links**: Periodically verify all internal links work correctly

### When to Update Navigation

Update `_config.cactus.yml` navigation when:

- Adding a new major documentation section
- Reorganizing documentation structure
- Changing primary navigation paths
- Adding important external links

## Additional Resources

- [Hexo Documentation](https://hexo.io/docs/)
- [Cactus Theme README](https://github.com/probberechts/hexo-theme-cactus/blob/master/README.md)
- [Markdown Guide](https://www.markdownguide.org/)
- [Repository Documentation Guidelines](../../AGENTS.md)

## Questions?

For questions about the documentation site:

- Check the main [README](../../README.md)
- Review [AGENTS.md](../../AGENTS.md) for contributor guidelines
- Open an issue on [GitHub](https://github.com/ralphschuler/.screeps-gpt/issues)
