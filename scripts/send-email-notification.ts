import process from "node:process";
import nodemailer from "nodemailer";

interface EmailNotificationOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  priority?: "high" | "normal" | "low";
}

interface RateLimitState {
  lastSentTimestamp: number;
  recentNotifications: number;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_NOTIFICATIONS_PER_WINDOW = 10;
const MIN_INTERVAL_BETWEEN_NOTIFICATIONS_MS = 5000; // 5 seconds

// In-memory rate limit state (resets between script runs)
const rateLimitState: RateLimitState = {
  lastSentTimestamp: 0,
  recentNotifications: 0
};

/**
 * Check if notification should be rate limited
 * @returns true if notification should be sent, false if rate limited
 */
function checkRateLimit(): boolean {
  const now = Date.now();

  // Check minimum interval between notifications
  if (now - rateLimitState.lastSentTimestamp < MIN_INTERVAL_BETWEEN_NOTIFICATIONS_MS) {
    console.log(`Rate limit: Too soon since last notification (${now - rateLimitState.lastSentTimestamp}ms)`);
    return false;
  }

  // Reset counter if window has passed
  if (now - rateLimitState.lastSentTimestamp > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.recentNotifications = 0;
  }

  // Check max notifications per window
  if (rateLimitState.recentNotifications >= MAX_NOTIFICATIONS_PER_WINDOW) {
    console.log(`Rate limit: Too many notifications in window (${rateLimitState.recentNotifications})`);
    return false;
  }

  return true;
}

/**
 * Update rate limit state after successful notification
 */
function updateRateLimit(): void {
  rateLimitState.lastSentTimestamp = Date.now();
  rateLimitState.recentNotifications += 1;
}

/**
 * Send email notification via SMTP
 * @param options Email notification options
 * @returns Promise that resolves when email is sent
 */
async function sendEmailNotification(options: EmailNotificationOptions): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  // Check required configuration
  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.log(
      "SMTP configuration not complete (SMTP_HOST, SMTP_USER, SMTP_PASSWORD required), skipping email notification"
    );
    return;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    console.log("Email notification rate limited, skipping");
    return;
  }

  const { to, subject, body, html, priority = "normal" } = options;

  // Validate inputs
  if (!to || !subject || !body) {
    throw new Error("To, subject, and body are required for email notifications");
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: smtpPort === "465", // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  // Set priority headers
  const priorityMap = {
    high: { priority: "high", importance: "high", xPriority: "1" },
    normal: { priority: "normal", importance: "normal", xPriority: "3" },
    low: { priority: "low", importance: "low", xPriority: "5" }
  };

  const headers = priorityMap[priority];

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: body,
      html: html || body.replace(/\n/g, "<br>"),
      priority: headers.priority,
      headers: {
        importance: headers.importance,
        "X-Priority": headers.xPriority
      }
    });

    console.log("Email notification sent successfully:", info.messageId);

    // Update rate limit state
    updateRateLimit();
  } catch (error) {
    // Log error but don't throw to prevent workflow failures
    console.error("Error sending email notification:", error);
  }
}

/**
 * Main entry point for CLI usage
 */
async function main(): Promise<void> {
  const to = process.env.EMAIL_TO;
  const subject = process.env.EMAIL_SUBJECT;
  const body = process.env.EMAIL_BODY;
  const html = process.env.EMAIL_HTML;
  const priority = (process.env.EMAIL_PRIORITY as "high" | "normal" | "low") || "normal";

  if (!to || !subject || !body) {
    console.error("EMAIL_TO, EMAIL_SUBJECT, and EMAIL_BODY environment variables are required");
    process.exit(1);
  }

  await sendEmailNotification({
    to,
    subject,
    body,
    html,
    priority
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { sendEmailNotification, checkRateLimit, updateRateLimit };
export type { EmailNotificationOptions };
