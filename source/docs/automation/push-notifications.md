---
title: Push Notification System
date: 2025-11-14T09:00:00.000Z
layout: page
---

# Push Notification System

The repository implements push notifications using [Push by Techulus](https://push.techulus.com) to provide real-time alerts for critical repository and Screeps bot events.

## Overview

Push notifications are sent for:

- **Repository Events:**
  - Deploy pipeline successes and failures
  - Critical build system failures (quality gate)
- **Screeps Bot Monitoring:**
  - High CPU usage alerts (>80% sustained over multiple ticks)
  - Critical CPU usage (>95%)
  - Low energy reserves
  - PTR monitoring anomalies

## Configuration

### Required Secret

Add the `PUSH_TOKEN` GitHub secret to enable push notifications:

1. Obtain an API key from [Push by Techulus](https://push.techulus.com)
2. Go to repository Settings → Secrets and variables → Actions
3. Add a new repository secret:
   - **Name:** `PUSH_TOKEN`
   - **Value:** Your Push by Techulus API key

### Optional Configuration

Push notifications are optional. If `PUSH_TOKEN` is not configured, workflows will continue normally without sending notifications.

## Notification Priority Levels

Notifications use the following priority levels (1-5):

- **Priority 5 (Critical):** Deployment failures, critical CPU usage (>95%)
- **Priority 4 (High):** Build failures, high CPU usage (>80%), data unavailability
- **Priority 3 (Normal):** Deployment successes
- **Priority 2 (Low):** Informational updates
- **Priority 1 (Silent):** Background notifications

## Rate Limiting

The notification system implements rate limiting to prevent spam:

- **Minimum interval:** 5 seconds between notifications
- **Maximum rate:** 10 notifications per minute
- **Window:** 1 minute rolling window

Rate-limited notifications are logged but not sent to avoid overwhelming recipients.

## Workflows with Push Notifications

### Deploy Workflow (deploy.yml)

Sends notifications for:

- **Success:** Version deployed successfully (Priority 3)
- **Failure:** Deployment failed, immediate attention required (Priority 5)

### Guard Workflows (guard-\*.yml)

Individual guard workflows can send notifications for:

- **Failure:** Specific check failed (e.g., build, lint, tests), review required (Priority 4)

### Screeps Monitoring Workflow (screeps-monitoring.yml)

Automatically analyzes PTR stats and sends notifications for:

- **Critical CPU usage** (>95% sustained): Priority 5
- **High CPU usage** (>80% sustained): Priority 4
- **Low energy reserves:** Tracked but not immediately notified
- **Data unavailability:** Priority 4

## Using the Notification System

### Via Composite Action

Use the composite action in workflows:

```yaml
- name: Send notification
  uses: ./.github/actions/send-push-notification
  with:
    push-token: ${{ secrets.PUSH_TOKEN }}
    title: "Notification Title"
    body: "Notification body text"
    link: "https://example.com" # Optional
    priority: "3" # Optional, default: 3
```

### Via Script

Use the TypeScript script directly:

```bash
# Set environment variables
export PUSH_TOKEN="your-api-key"
export PUSH_TITLE="Test Notification"
export PUSH_BODY="This is a test"
export PUSH_LINK="https://example.com"  # Optional
export PUSH_PRIORITY="3"  # Optional

# Run script
npx tsx scripts/send-push-notification.ts
```

### Programmatically

Import and use the notification function:

```typescript
import { sendPushNotification } from "./scripts/send-push-notification.js";

await sendPushNotification({
  title: "Alert Title",
  body: "Alert message",
  link: "https://example.com", // Optional
  priority: 5 // Optional, default: 3
});
```

## Error Handling

The notification system is designed to fail gracefully:

- Missing `PUSH_TOKEN`: Notifications skipped with log message
- API errors: Logged but do not fail the workflow
- Network errors: Logged but do not fail the workflow
- Rate limiting: Notifications skipped with log message

This ensures that notification failures never break CI/CD workflows.

## Security Considerations

- `PUSH_TOKEN` is stored as a GitHub secret and never exposed in logs
- Notification content avoids sensitive repository information
- Links point to public GitHub workflow runs
- API key is sent via `x-api-key` header (not in URL)

## Testing

Unit tests are available at `tests/unit/send-push-notification.test.ts` covering:

- Rate limiting logic
- API request formatting
- Error handling
- Token validation

Run tests with:

```bash
bun run test:unit
```

## Troubleshooting

### Notifications Not Received

1. Verify `PUSH_TOKEN` secret is configured
2. Check workflow logs for rate limiting messages
3. Verify Push by Techulus API key is valid
4. Check Push by Techulus app for notification settings

### Too Many Notifications

Rate limiting prevents spam, but you can:

- Adjust thresholds in `scripts/check-ptr-alerts.ts`
- Modify notification conditions in workflow files
- Increase the minimum interval in `scripts/send-push-notification.ts`

### API Errors

Check workflow logs for error messages. Common issues:

- Invalid API key
- API rate limiting (separate from local rate limiting)
- Network connectivity issues

## API Reference

Push by Techulus API documentation: https://docs.push.techulus.com/api-documentation

The system uses the `/api/v1/notify` endpoint with:

- **Method:** POST
- **Headers:** `Content-Type: application/json`, `x-api-key: <token>`
- **Body:** `{ title, body, link?, priority? }`

## Related Documentation

- [Email Notification System](./email-notifications.md) - Complementary SMTP email notifications
- [Autonomous Monitoring](./autonomous-monitoring.md) - PTR and deployment monitoring integration

## Related Issues

- #134 - Email notification system (now implemented - see email-notifications.md)
- #152 - PTR monitoring API authentication
- #117 - PTR CPU monitoring alerts

## Future Enhancements

Potential improvements:

- Notification digest mode (batch multiple alerts)
- Configurable thresholds via environment variables
- Additional monitoring criteria (memory usage, spawn failures)
- Integration with other notification channels
- Persistent rate limit state across workflow runs
