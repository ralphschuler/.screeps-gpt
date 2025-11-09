import { describe, it, expect, beforeAll } from "vitest";

/**
 * End-to-End Tests for Documentation Site
 *
 * Tests the deployed documentation site at https://nyphon.de/.screeps-gpt/
 * to ensure pages are accessible, properly rendered, and functioning correctly.
 *
 * Related: Issue #475 - Add end-to-end tests for documentation site
 */

// Configuration
const DOCS_SITE_URL = process.env.DOCS_SITE_URL || "https://nyphon.de/.screeps-gpt/";
const REQUEST_TIMEOUT = 10000; // 10 seconds

interface FetchResult {
  status: number;
  statusText: string;
  headers: Headers;
  body: string;
}

/**
 * Fetch a URL with timeout and error handling
 */
async function fetchWithTimeout(url: string, timeout = REQUEST_TIMEOUT): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if HTML content appears to be properly rendered (not blank/minimal)
 */
function isValidHtmlContent(html: string): boolean {
  // Must have basic HTML structure
  if (!html.includes("<html") || !html.includes("</html>")) {
    return false;
  }

  // Must have head and body sections
  if (!html.includes("<head") || !html.includes("<body")) {
    return false;
  }

  // Must have substantial content (more than just empty structure)
  const contentLength = html.length;
  if (contentLength < 500) {
    return false;
  }

  return true;
}

/**
 * Extract all internal links from HTML content
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkPattern = /href=["']([^"']+)["']/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];

    // Skip external links, anchors, and special protocols
    // Check for protocol schemes that should be filtered out
    const hasExternalProtocol =
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("javascript:") ||
      href.startsWith("data:") ||
      href.startsWith("vbscript:") ||
      href.startsWith("file:") ||
      href.startsWith("#");

    if (hasExternalProtocol) {
      continue;
    }

    // Convert relative links to absolute
    const absoluteUrl = new URL(href, baseUrl).toString();
    if (!links.includes(absoluteUrl)) {
      links.push(absoluteUrl);
    }
  }

  return links;
}

describe("Documentation Site E2E Tests", () => {
  // Skip tests by default unless explicitly enabled
  // This prevents issues in CI where the site may not be accessible
  const shouldSkip = process.env.RUN_DOCS_SITE_TESTS !== "true";

  beforeAll(() => {
    if (shouldSkip) {
      console.log("⚠️  Skipping docs site tests (set RUN_DOCS_SITE_TESTS=true to enable)");
    } else {
      console.log(`🌐 Testing documentation site at: ${DOCS_SITE_URL}`);
    }
  });

  describe("Homepage Validation", () => {
    it("should return HTTP 200 for homepage", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe("OK");
    }, 15000);

    it("should have valid HTML content on homepage", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      expect(isValidHtmlContent(result.body)).toBe(true);
      expect(result.body).toContain("<title>");
      expect(result.body.length).toBeGreaterThan(1000);
    }, 15000);

    it("should have proper meta tags", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      expect(result.body).toContain('charset="utf-8"');
      expect(result.body).toContain('name="viewport"');
    }, 15000);
  });

  describe("Key Documentation Pages", () => {
    const keyPages = [
      { path: "", name: "Homepage/README" },
      { path: "docs/", name: "Documentation Index" },
      { path: "docs/automation/", name: "Automation Guides" },
      { path: "docs/operations/", name: "Operational Documentation" }
    ];

    keyPages.forEach(({ path, name }) => {
      it(`should have accessible ${name}`, async () => {
        if (shouldSkip) return;

        const url = new URL(path, DOCS_SITE_URL).toString();
        const result = await fetchWithTimeout(url);

        expect(result.status).toBe(200);
        expect(isValidHtmlContent(result.body)).toBe(true);
      }, 15000);
    });
  });

  describe("Asset Loading", () => {
    it("should load CSS stylesheets", async () => {
      if (shouldSkip) return;

      const homepage = await fetchWithTimeout(DOCS_SITE_URL);

      // Extract CSS link from homepage
      const cssMatch = homepage.body.match(/href=["']([^"']+\.css)["']/);
      if (cssMatch) {
        const cssUrl = new URL(cssMatch[1], DOCS_SITE_URL).toString();
        const cssResult = await fetchWithTimeout(cssUrl);

        expect(cssResult.status).toBe(200);
        expect(cssResult.headers.get("content-type")).toContain("css");
        expect(cssResult.body.length).toBeGreaterThan(0);
      }
    }, 15000);

    it("should have valid favicon link", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      // Check for favicon link in HTML
      const hasFavicon =
        result.body.includes('rel="icon"') ||
        result.body.includes('rel="shortcut icon"') ||
        result.body.includes("favicon.ico");

      expect(hasFavicon).toBe(true);
    }, 15000);
  });

  describe("Link Validation", () => {
    it("should have working navigation links", async () => {
      if (shouldSkip) return;

      const homepage = await fetchWithTimeout(DOCS_SITE_URL);
      const internalLinks = extractInternalLinks(homepage.body, DOCS_SITE_URL);

      // Test a sample of internal links (up to 5)
      const linksToTest = internalLinks.slice(0, 5);

      for (const link of linksToTest) {
        const result = await fetchWithTimeout(link);
        expect(result.status).toBeLessThan(400); // 2xx or 3xx are OK
      }
    }, 30000);

    it("should not have obviously broken internal links on homepage", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      // Check for common broken link indicators
      expect(result.body).not.toContain('href="undefined"');
      expect(result.body).not.toContain('href="null"');
      expect(result.body).not.toContain('href=""');
    }, 15000);
  });

  describe("Content Quality", () => {
    it("should have navigation menu", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      // Check for common navigation elements
      const hasNav =
        result.body.includes("<nav") ||
        result.body.includes('role="navigation"') ||
        result.body.includes('class="nav"') ||
        result.body.includes('class="menu"');

      expect(hasNav).toBe(true);
    }, 15000);

    it("should have footer", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      const hasFooter = result.body.includes("<footer") || result.body.includes('class="footer"');
      expect(hasFooter).toBe(true);
    }, 15000);

    it("should not contain build errors or placeholder text", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      // Check for common error indicators
      expect(result.body.toLowerCase()).not.toContain("build failed");
      expect(result.body.toLowerCase()).not.toContain("error generating");
      expect(result.body.toLowerCase()).not.toContain("todo: ");
      expect(result.body.toLowerCase()).not.toContain("fixme:");
    }, 15000);
  });

  describe("Performance and Headers", () => {
    it("should return response headers", async () => {
      if (shouldSkip) return;

      const result = await fetchWithTimeout(DOCS_SITE_URL);

      expect(result.headers.has("content-type")).toBe(true);
      expect(result.headers.get("content-type")).toContain("html");
    }, 15000);

    it("should not have excessive response time", async () => {
      if (shouldSkip) return;

      const startTime = Date.now();
      await fetchWithTimeout(DOCS_SITE_URL);
      const duration = Date.now() - startTime;

      // Should respond within 10 seconds
      expect(duration).toBeLessThan(10000);
    }, 15000);
  });
});
