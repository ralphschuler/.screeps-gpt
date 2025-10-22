import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Regression test for email triage prompt JSON formatting.
 * 
 * Prevents recurrence of issue #115 where the email triage prompt
 * contained contradictory instructions about JSON output format.
 * 
 * The prompt should:
 * 1. Show JSON example without markdown fences
 * 2. Explicitly state "Do not wrap the JSON in Markdown fences"
 * 
 * This ensures the AI can properly format output for workflow parsing.
 */
describe('Email Triage Prompt Format', () => {
  const promptPath = resolve(__dirname, '../../.github/copilot/prompts/email-triage');
  
  it('should not wrap JSON output example in markdown fences', () => {
    const promptContent = readFileSync(promptPath, 'utf-8');
    
    // Check that JSON example is not wrapped in markdown code fences
    const jsonExampleMatch = promptContent.match(/\{\s*"run_url"[\s\S]*?\}/);
    expect(jsonExampleMatch).toBeDefined();
    
    const beforeJson = promptContent.substring(0, jsonExampleMatch!.index);
    const afterJson = promptContent.substring(jsonExampleMatch!.index! + jsonExampleMatch![0].length);
    
    // Should not have ``` before or after the JSON
    expect(beforeJson).not.toMatch(/```\s*$/);
    expect(afterJson).not.toMatch(/^\s*```/);
  });
  
  it('should explicitly instruct not to wrap JSON in markdown fences', () => {
    const promptContent = readFileSync(promptPath, 'utf-8');
    
    // Should contain the explicit rule about not wrapping JSON
    expect(promptContent).toMatch(/Do not wrap the JSON in Markdown fences/i);
  });
  
  it('should have consistent formatting with issue-triage prompt', () => {
    const emailPrompt = readFileSync(promptPath, 'utf-8');
    const issuePromptPath = resolve(__dirname, '../../.github/copilot/prompts/issue-triage');
    const issuePrompt = readFileSync(issuePromptPath, 'utf-8');
    
    // Both should have the same rule about JSON formatting
    const emailHasRule = /Do not wrap the JSON in Markdown fences/i.test(emailPrompt);
    const issueHasRule = /Do not wrap the JSON in Markdown fences/i.test(issuePrompt);
    
    expect(emailHasRule).toBe(true);
    expect(issueHasRule).toBe(true);
    
    // Both should show unwrapped JSON examples
    const emailJsonMatch = emailPrompt.match(/\{\s*"run_url"[\s\S]*?\}/);
    const issueJsonMatch = issuePrompt.match(/\{\s*"issue_number"[\s\S]*?\}/);
    
    expect(emailJsonMatch).toBeDefined();
    expect(issueJsonMatch).toBeDefined();
  });
});