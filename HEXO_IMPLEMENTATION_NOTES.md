# Hexo Documentation Site Implementation - Technical Notes

## Summary

This document explains the Hexo implementation attempt, technical blockers encountered, and recommendations for completing the integration.

## What Was Accomplished

### 1. Hexo Installation and Configuration ✅

- Installed Hexo core (`hexo@8.0.0`) and essential plugins:
  - `hexo-renderer-ejs` - EJS template rendering
  - `hexo-renderer-marked` - Markdown to HTML conversion
  - `hexo-renderer-stylus` - Stylus to CSS compilation
  - `hexo-generator-index` - Homepage generation
  - `hexo-generator-archive` - Archive pages
  - `hexo-generator-category` - Category pages
  - `hexo-generator-tag` - Tag pages
  - `hexo-generator-search` - Search functionality
  - `hexo-generator-feed` - RSS/Atom feeds
  - `hexo-server` - Development server

### 2. Hexo Configuration (`_config.yml`) ✅

Created complete Hexo configuration with:

- Site metadata (title, description, keywords, author)
- URL structure (`/:blog/:year/:month/:day/:title/`)
- Directory mappings (`source/`, `public/`)
- Theme selection (`screeps-gpt`)
- Markdown rendering settings
- Feed and search configuration
- Pagination settings

### 3. Documentation Migration ✅

- Created migration script (`scripts/migrate-docs-to-hexo.ts`)
- Migrated all documentation from `docs/` to `source/`
- Added front matter to all markdown files:
  ```yaml
  ---
  title: Page Title
  date: 2025-10-24T12:33:51.457Z
  ---
  ```
- Created `source/_posts/welcome.md` - inaugural blog post with categories and tags
- Migrated README.md to `source/index.md` as homepage
- Migrated CHANGELOG.md to `source/changelog/index.md`

### 4. Custom Theme Development ✅

Created complete `themes/screeps-gpt/` theme with:

**Layouts** (`themes/screeps-gpt/layout/`):

- `layout.ejs` - Main layout wrapper
- `index.ejs` - Homepage and blog listing
- `post.ejs` - Individual blog post template
- `page.ejs` - Static page template
- `archive.ejs` - Archive/category/tag listings

**Partials** (`themes/screeps-gpt/layout/_partial/`):

- `head.ejs` - HTML head with meta tags, RSS link
- `header.ejs` - Site header with navigation
- `footer.ejs` - Site footer
- `pagination.ejs` - Pagination controls

**Styling** (`themes/screeps-gpt/source/css/`):

- `style.css` - Adapted from existing `docs/site-assets/style.css`
- Added blog-specific styles (posts, pagination, archive)
- Maintained light/dark theme support
- Responsive design

**Theme Config** (`themes/screeps-gpt/_config.yml`):

- Navigation menu structure
- Widget configuration
- Social links
- Search and RSS enablement

### 5. Build Scripts ✅

- `scripts/build-hexo-site.ts` - Programmatic Hexo build (non-functional)
- `scripts/build-hexo-wrapper.sh` - Shell script wrapper (non-functional)
- `scripts/migrate-docs-to-hexo.ts` - Documentation migration utility (functional)

### 6. Package Configuration ✅

- Updated `package.json` with new scripts:
  - `build:docs-site` - Updated to use Hexo
  - `build:docs-site-legacy` - Preserved original build script
  - `migrate:docs-to-hexo` - Run migration utility
- Updated `.gitignore` to exclude `/public` and `/themes/landscape`

## Technical Blocker: Plugin Loading

### Problem

Hexo plugins fail to load in the current Bun/TypeScript/ESM environment:

```
ReferenceError: hexo is not defined
    at Object.<anonymous> (node_modules/hexo-renderer-ejs/index.js:7:1)
```

### Root Causes

1. **CommonJS vs ESM**: Hexo plugins are CommonJS modules that execute immediately and expect a global `hexo` variable. The repository uses ES modules via `tsx` for TypeScript execution.

2. **Bun Package Manager**: Hexo's plugin discovery scans `node_modules` but may not work correctly with Bun's module resolution.

3. **Dynamic Imports**: Attempted workarounds using `import()` fail because plugins execute module-level code before any function call.

4. **CLI Not Working**: `npx hexo` commands show no available commands beyond `help`, `init`, `version` - generators and renderers are not discovered.

### Symptoms

- Running `build:docs-site` generates `.md` files instead of `.html`
- Stylus files (`.styl`) not compiled to CSS
- No blog index generated
- No RSS feeds created
- No search index built

### Attempted Solutions

1. ✗ Explicit plugin list in `_config.yml` - Not recognized
2. ✗ Dynamic `import()` in build script - Plugins expect global `hexo`
3. ✗ Shell script wrapper calling `npx hexo` - CLI doesn't recognize plugins
4. ✗ Manual plugin registration after `hexo.load()` - Plugins already executed module code

## Recommendations

### Option 1: Node.js-based Build (Recommended for Quick Resolution)

**Effort**: Medium | **Compatibility**: High

Create a separate Node.js environment just for documentation build:

1. Install Node.js 18+ (already required per `engines` in package.json)
2. Create `package-docs.json` with just Hexo dependencies
3. Use `npm install` in docs build workflow
4. Update `.github/workflows/docs-pages.yml`:
   ```yaml
   - name: Setup Node.js for docs
     uses: actions/setup-node@v4
     with:
       node-version: "20"
   - name: Install docs dependencies
     run: cd docs-build && npm install
   - name: Generate documentation site
     run: cd docs-build && npx hexo generate && cp -r public ../build/docs-site
   ```

**Pros**:

- Uses Hexo's native environment
- All plugins work out of the box
- Minimal changes to existing codebase
- Can run alongside Bun for main application

**Cons**:

- Adds Node.js as build dependency
- Separate dependency management for docs

### Option 2: Enhanced Custom Build Script (Recommended for Consistency)

**Effort**: Medium-High | **Compatibility**: High

Enhance existing `scripts/build-docs-site.ts` to add blog features without Hexo:

1. **Blog Post Support**:
   - Parse front matter from markdown files
   - Extract date, categories, tags
   - Generate blog index and archive pages
   - Implement pagination

2. **RSS Feed Generation**:
   - Create `atom.xml` with latest posts
   - Include excerpts and full content
   - Proper date formatting

3. **Client-side Search**:
   - Generate `search.json` with all content
   - Add [lunr.js](https://lunrjs.com/) for client-side search
   - Search UI in header

4. **Category/Tag Pages**:
   - Parse front matter tags and categories
   - Generate taxonomy pages
   - Link from posts

**Pros**:

- Full TypeScript/Bun compatibility
- Single build system
- Complete control over output
- Leverage existing working infrastructure

**Cons**:

- More code to maintain
- Re-implementing Hexo features
- No benefit from Hexo plugin ecosystem

### Option 3: Fork and Patch Hexo Plugins

**Effort**: High | **Compatibility**: Medium

Create ESM-compatible versions of essential Hexo plugins:

1. Fork `hexo-renderer-marked`, `hexo-renderer-ejs`, `hexo-renderer-stylus`
2. Convert to ES modules
3. Publish as `@screeps-gpt/hexo-renderer-*`
4. Update dependencies

**Pros**:

- Keep Hexo benefits
- Full control over plugin code
- Could contribute back to Hexo community

**Cons**:

- High maintenance burden
- Need to maintain forks
- Complex debugging

## Implementation Guide: Option 1 (Node.js Build)

If choosing the Node.js approach, follow these steps:

### 1. Create Documentation Build Directory

```bash
mkdir docs-build
cd docs-build
```

### 2. Create `package.json`

```json
{
  "name": "screeps-gpt-docs",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "clean": "hexo clean",
    "build": "hexo generate",
    "server": "hexo server"
  },
  "dependencies": {
    "hexo": "^8.0.0",
    "hexo-generator-archive": "^2.0.0",
    "hexo-generator-category": "^2.0.0",
    "hexo-generator-feed": "^3.0.0",
    "hexo-generator-index": "^4.0.0",
    "hexo-generator-search": "^2.4.3",
    "hexo-generator-tag": "^2.0.0",
    "hexo-renderer-ejs": "^2.0.0",
    "hexo-renderer-marked": "^7.0.1",
    "hexo-renderer-stylus": "^3.0.1",
    "hexo-server": "^3.0.0"
  }
}
```

### 3. Symlink Configuration and Content

```bash
ln -s ../_config.yml _config.yml
ln -s ../source source
ln -s ../themes themes
```

### 4. Update Workflow

```yaml
# .github/workflows/docs-pages.yml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: "npm"
    cache-dependency-path: docs-build/package-lock.json

- name: Install documentation dependencies
  working-directory: docs-build
  run: npm ci

- name: Generate documentation site
  working-directory: docs-build
  run: npm run build

- name: Copy to build directory
  run: |
    mkdir -p build
    cp -r docs-build/public build/docs-site
```

### 5. Test Locally

```bash
cd docs-build
npm install
npm run build
# Check docs-build/public for generated site
```

## Implementation Guide: Option 2 (Enhanced Custom Build)

If enhancing the existing build script, add these features to `scripts/build-docs-site.ts`:

### 1. Front Matter Parser

```typescript
import matter from "gray-matter";

interface PostFrontMatter {
  title: string;
  date: Date;
  categories?: string[];
  tags?: string[];
  excerpt?: string;
}

function parsePost(content: string): {
  frontMatter: PostFrontMatter;
  body: string;
} {
  const { data, content: body } = matter(content);
  return {
    frontMatter: data as PostFrontMatter,
    body
  };
}
```

### 2. Blog Index Generation

```typescript
async function generateBlogIndex(posts: Post[]): Promise<void> {
  // Sort by date descending
  const sortedPosts = posts.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Paginate
  const perPage = 10;
  const pages = Math.ceil(sortedPosts.length / perPage);

  for (let i = 0; i < pages; i++) {
    const pagePosts = sortedPosts.slice(i * perPage, (i + 1) * perPage);
    const html = renderBlogPage(pagePosts, i + 1, pages);
    const path = i === 0 ? "blog/index.html" : `blog/page/${i + 1}/index.html`;
    await writeFile(join(outputDir, path), html);
  }
}
```

### 3. RSS Feed Generation

```typescript
function generateRSSFeed(posts: Post[]): string {
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Screeps GPT</title>
  <link href="https://ralphschuler.github.io/.screeps-gpt/atom.xml" rel="self"/>
  <link href="https://ralphschuler.github.io/.screeps-gpt/"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://ralphschuler.github.io/.screeps-gpt/</id>
  ${posts
    .slice(0, 20)
    .map(
      post => `
  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${post.url}"/>
    <updated>${post.date.toISOString()}</updated>
    <id>${post.url}</id>
    <content type="html">${escapeXml(post.content)}</content>
  </entry>`
    )
    .join("")}
</feed>`;
  return feed;
}
```

### 4. Search Index Generation

```typescript
interface SearchEntry {
  title: string;
  url: string;
  content: string;
  tags?: string[];
  categories?: string[];
}

function generateSearchIndex(pages: Page[]): string {
  const entries: SearchEntry[] = pages.map(page => ({
    title: page.title,
    url: page.url,
    content: stripHtml(page.content).slice(0, 500),
    tags: page.tags,
    categories: page.categories
  }));

  return JSON.stringify(entries);
}
```

## Files to Review

Key files created in this PR:

- `_config.yml` - Hexo configuration
- `themes/screeps-gpt/` - Custom theme
- `source/` - Migrated documentation
- `scripts/migrate-docs-to-hexo.ts` - Migration utility
- `scripts/build-hexo-site.ts` - Build script (non-functional)

## Next Steps

1. **Decide on approach**: Choose Option 1 (Node.js) or Option 2 (Enhanced custom build)
2. **Test locally**: Verify the chosen approach works
3. **Update workflows**: Modify `.github/workflows/docs-pages.yml`
4. **Create blog content**: Add more posts to `source/_posts/`
5. **Test deployment**: Verify GitHub Pages deployment

## Questions?

For questions about this implementation:

- Review this document
- Check Hexo documentation: https://hexo.io/docs/
- Review theme structure in `themes/screeps-gpt/`
- Test migration script: `bun run migrate:docs-to-hexo`

## Conclusion

The Hexo infrastructure is in place and ready to use, pending resolution of the plugin loading issue. Option 1 (Node.js build) is recommended for quickest path to working blog functionality while maintaining the benefits of Hexo. Option 2 (enhanced custom build) provides better long-term consistency with the existing Bun/TypeScript infrastructure.
