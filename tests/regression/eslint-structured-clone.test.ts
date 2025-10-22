import { execSync } from 'node:child_process';
import { expect, test } from 'vitest';

// Regression test for issue #156 ensuring lint succeeds without structuredClone crash.
// Executes eslint against a tiny inline file path and asserts exit code 0.

test('eslint should run without structuredClone ReferenceError (issue #156)', () => {
  let output = '';
  try {
    output = execSync('npm run lint --silent', { encoding: 'utf8' });
  } catch (err: any) {
    // Include stderr in failure for diagnostics
    throw new Error('ESLint failed unexpectedly: ' + (err.stderr || err.message));
  }
  expect(output).toContain(''); // placeholder assertion; success is absence of thrown error
});
