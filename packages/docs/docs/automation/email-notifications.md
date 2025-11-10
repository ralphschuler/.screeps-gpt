# Email Notification System

The repository implements email notifications via SMTP to provide real-time alerts for critical repository and Screeps bot events, complementing the existing push notification system.

## Overview

Email notifications are sent for:

- **Repository Events:**
  - Deploy pipeline failures
  - Critical build system failures (CI/CD)
  - Security vulnerabilities detected
- **Screeps Bot Monitoring:**
  - High CPU usage alerts (>80% sustained over multiple ticks)
  - Critical CPU usage (>95%)
  - Critical infrastructure failures
  - PTR monitoring anomalies

## Configuration

### Required Secrets

Add the following GitHub secrets to enable email notifications:

1. Go to repository Settings → Secrets and variables → Actions
2. Add these repository secrets:
   - **SMTP_HOST:** SMTP server hostname (e.g., `smtp.gmail.com`)
   - **SMTP_PORT:** SMTP server port (default: `587` for TLS, `465` for SSL)
   - **SMTP_USER:** SMTP username/email for authentication
   - **SMTP_PASSWORD:** SMTP password or app-specific password
   - **SMTP_FROM:** (Optional) From email address (defaults to SMTP_USER)

### Required Variables

Add the following GitHub repository variable:

1. Go to repository Settings → Secrets and variables → Actions → Variables
2. Add this repository variable:
   - **EMAIL_NOTIFY_TO:** Target email address (e.g., `screeps-gpt+notify@nyphon.de`)

### SMTP Provider Setup Examples

#### Gmail

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → 2-Step Verification → App passwords
3. Configure secrets:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: Your Gmail address
   - `SMTP_PASSWORD`: Generated app password

#### SendGrid

1. Create a SendGrid API key
2. Configure secrets:
   - `SMTP_HOST`: `smtp.sendgrid.net`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `apikey`
   - `SMTP_PASSWORD`: Your SendGrid API key

#### AWS SES

1. Verify your domain or email in AWS SES
2. Create SMTP credentials in SES console
3. Configure secrets:
   - `SMTP_HOST`: Regional endpoint (e.g., `email-smtp.us-east-1.amazonaws.com`)
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: SMTP username from SES
   - `SMTP_PASSWORD`: SMTP password from SES

### Optional Configuration

Email notifications are optional. If SMTP configuration is not complete, workflows will continue normally without sending email notifications.

## Email Priority Levels

Emails use priority headers to indicate urgency:

- **High Priority:** Deployment failures, critical CPU usage (>95%), security vulnerabilities, CI failures
- **Normal Priority:** High CPU usage (>80%), data unavailability
- **Low Priority:** Informational updates

## Rate Limiting

The notification system implements rate limiting to prevent spam:

- **Minimum interval:** 5 seconds between notifications
- **Maximum rate:** 10 notifications per minute
- **Window:** 1 minute rolling window

Rate-limited notifications are logged but not sent to avoid overwhelming recipients.

## Workflows with Email Notifications

### PTR Monitoring Workflow (screeps-monitoring.yml)

Automatically analyzes PTR stats and sends email notifications for:

- **Critical infrastructure failures** (all telemetry sources failed): High Priority
- **Critical CPU usage** (>95% sustained): High Priority
- **High CPU usage** (>80% sustained): Normal Priority
- **API authentication failures:** High Priority
- **Data unavailability:** Normal Priority

### CI AutoFix Workflow (copilot-ci-autofix.yml)

Sends email notifications for:

- **CI/CD workflow failures:** High Priority
- Triggered when any monitored workflow fails
- Includes workflow name, run ID, and direct link to failure

### Security Audit Workflow (guard-security-audit.yml)

Sends email notifications for:

- **Security vulnerabilities detected:** High Priority
- Includes vulnerability count and details
- Triggered on dependency security issues

### Deploy Workflow (deploy.yml)

Sends email notifications for:

- **Deployment failures:** High Priority
- Includes version, repository, and failure details

## Using the Email Notification System

### Via Composite Action

Use the composite action in workflows:

```yaml
- name: Send email notification
  uses: ./.github/actions/send-email-notification
  with:
    smtp-host: ${{ secrets.SMTP_HOST }}
    smtp-port: ${{ secrets.SMTP_PORT || '587' }}
    smtp-user: ${{ secrets.SMTP_USER }}
    smtp-password: ${{ secrets.SMTP_PASSWORD }}
    smtp-from: ${{ secrets.SMTP_FROM || secrets.SMTP_USER }}
    to: ${{ vars.EMAIL_NOTIFY_TO }}
    subject: "Notification Subject"
    body: "Notification body text"
    html: "<html>...</html>" # Optional
    priority: "high" # Optional: high, normal, low
```

### Via Reusable Workflow

Call the reusable workflow:

```yaml
jobs:
  notify:
    uses: ./.github/workflows/email-notification.yml
    with:
      to: "recipient@example.com"
      subject: "Alert Subject"
      body: "Alert message"
      priority: "high"
    secrets:
      SMTP_HOST: ${{ secrets.SMTP_HOST }}
      SMTP_USER: ${{ secrets.SMTP_USER }}
      SMTP_PASSWORD: ${{ secrets.SMTP_PASSWORD }}
```

### Via Script

Use the TypeScript script directly:

```bash
# Set environment variables
export SMTP_HOST="smtp.example.com"
export SMTP_PORT="587"
export SMTP_USER="user@example.com"
export SMTP_PASSWORD="password"
export EMAIL_TO="recipient@example.com"
export EMAIL_SUBJECT="Test Notification"
export EMAIL_BODY="This is a test"
export EMAIL_HTML="<html><body>This is a test</body></html>"  # Optional
export EMAIL_PRIORITY="high"  # Optional: high, normal, low

# Run script
npx tsx packages/utilities/scripts/send-email-notification.ts
```

### Programmatically

Import and use the notification function:

```typescript
import { sendEmailNotification } from "./packages/utilities/scripts/send-email-notification.js";

await sendEmailNotification({
  to: "recipient@example.com",
  subject: "Alert Subject",
  body: "Alert message",
  html: "<html>...</html>", // Optional
  priority: "high" // Optional: high, normal, low
});
```

## Email Templates

Email notifications include both plain text and HTML versions:

### Plain Text Format

```
Screeps PTR Alert Detected
========================

Severity: CRITICAL
Type: high_cpu
Message: High CPU usage detected: 92.5% average over 4 ticks

View Details: https://github.com/user/repo/actions/runs/12345

Timestamp: 2024-01-01T12:00:00.000Z
Repository: user/repo
Run ID: 12345

This is an automated alert from the Screeps monitoring system.
```

### HTML Format

HTML emails include:

- Color-coded headers based on severity (red for critical, yellow for high)
- Formatted alert boxes with clear messaging
- Structured data table with alert details
- Call-to-action button linking to workflow run
- Professional footer with repository information

## Error Handling

The notification system is designed to fail gracefully:

- **Missing SMTP configuration:** Notifications skipped with log message
- **SMTP connection errors:** Logged but do not fail the workflow
- **Authentication errors:** Logged but do not fail the workflow
- **Rate limiting:** Notifications skipped with log message

This ensures that notification failures never break CI/CD workflows.

## Security Considerations

- All SMTP credentials are stored as GitHub secrets and never exposed in logs
- Email content avoids sensitive repository information
- Links point to public GitHub workflow runs
- SMTP passwords support app-specific passwords for enhanced security
- TLS/SSL encryption supported via SMTP_PORT configuration

## Testing

### Unit Tests

Unit tests are available at `tests/unit/send-email-notification.test.ts` covering:

- Rate limiting logic
- Email formatting and priority headers
- Error handling
- SMTP configuration validation

Run tests with:

```bash
npm run test:unit
```

### Manual Testing

Test email notifications manually:

1. Configure SMTP secrets in repository
2. Trigger the email notification workflow manually:
   - Go to Actions → Send Email Notification
   - Click "Run workflow"
   - Fill in recipient, subject, and body
   - Click "Run workflow"
3. Check recipient inbox for test email

## Troubleshooting

### Emails Not Received

1. **Verify SMTP configuration:** Check that all required secrets are configured
2. **Check spam folder:** Email may be filtered as spam initially
3. **Verify SMTP credentials:** Test SMTP login with credentials
4. **Check workflow logs:** Review logs for rate limiting or error messages
5. **Verify EMAIL_NOTIFY_TO variable:** Ensure repository variable is set correctly

### Authentication Errors

1. **Use app-specific passwords:** For Gmail, create an App Password instead of using account password
2. **Enable less secure apps:** Some SMTP providers require enabling access for third-party apps
3. **Verify username format:** Some providers require full email address, others just username
4. **Check firewall rules:** Ensure GitHub Actions runners can access SMTP server

### Rate Limiting

Rate limiting prevents spam but may delay urgent notifications:

1. **Adjust thresholds:** Modify rate limits in `packages/utilities/scripts/send-email-notification.ts`
2. **Prioritize alerts:** Focus on critical/high severity notifications only
3. **Use email digest:** Batch multiple alerts into single email (future enhancement)

### Email Formatting Issues

1. **HTML not rendering:** Ensure HTML is valid and well-formed
2. **Plain text fallback:** System automatically provides plain text version
3. **Encoding issues:** Use UTF-8 encoding for special characters

## Integration with Push Notifications

Email notifications complement the existing push notification system:

- **Push notifications:** Immediate mobile alerts via Push by Techulus
- **Email notifications:** Persistent record with detailed context
- **Dual delivery:** Critical alerts trigger both push and email

Both systems share the same rate limiting approach and priority levels.

## Comparison with Push Notifications

| Feature           | Email                         | Push                                      |
| ----------------- | ----------------------------- | ----------------------------------------- |
| **Delivery**      | SMTP, received in inbox       | Push by Techulus API, mobile notification |
| **Persistence**   | Permanent email record        | Temporary notification                    |
| **Detail Level**  | HTML formatting, rich content | Short title + body                        |
| **Rate Limiting** | 10/min, 5s interval           | 10/min, 5s interval                       |
| **Setup**         | SMTP credentials required     | Push by Techulus API token                |
| **Mobile Access** | Email client required         | Native push notification                  |

## Related Issues

- #134 - Email notification system (this implementation)
- #117 - PTR CPU monitoring alerts (email integration added)
- #125 - Security vulnerabilities (email alerts added)
- #124 - Build system failures (email alerts added)

## Future Enhancements

Potential improvements:

- **Email digest mode:** Batch multiple alerts into periodic summary emails
- **Configurable thresholds:** Environment variables for rate limiting and priorities
- **Additional monitoring criteria:** Memory usage, spawn failures, room loss events
- **Template customization:** User-definable email templates
- **Delivery tracking:** Monitor email delivery success rates
- **Multi-recipient support:** Send to multiple email addresses
- **Email filtering rules:** User-defined conditions for email notifications

## API Reference

The system uses [nodemailer](https://nodemailer.com/) v7.0.10 for SMTP communication.

**Key Dependencies:**

- `nodemailer@7.0.10` - SMTP client library
- `@types/nodemailer@6.4.17` - TypeScript type definitions

**Security:**

- Nodemailer v7.0.10 includes fix for email domain interpretation vulnerability (GHSA-mm7p-fcc7-pg87)
- All credentials transmitted over TLS/SSL encrypted connections
- No credentials logged or exposed in workflow outputs
