import process from "node:process";
import https from "node:https";

interface PushNotificationOptions {
  title: string;
  body: string;
  link?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
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
 * Send push notification via Push by Techulus API
 * @param options Notification options
 * @returns Promise that resolves when notification is sent
 */
async function sendPushNotification(options: PushNotificationOptions): Promise<void> {
  const token = process.env.PUSH_TOKEN;

  if (!token) {
    console.log("PUSH_TOKEN not configured, skipping notification");
    return;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    console.log("Notification rate limited, skipping");
    return;
  }

  const { title, body, link, priority = 3 } = options;

  // Validate inputs
  if (!title || !body) {
    throw new Error("Title and body are required for push notifications");
  }

  // Push by Techulus API endpoint
  const apiUrl = "https://push.techulus.com/api/v1/notify";

  const payload = {
    title,
    body,
    ...(link && { link }),
    priority
  };

  try {
    // Use https module for Node.js 16 compatibility (fetch not available)
    const url = new URL(apiUrl);
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": token,
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const response = await new Promise<{status: number; data: string}>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({status: res.statusCode || 0, data}));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (response.status < 200 || response.status >= 300) {
      // Log error but don't throw to prevent workflow failures
      console.error(`Push notification failed (${response.status}): ${response.data}`);
      return;
    }

    const result: unknown = JSON.parse(response.data);
    console.log("Push notification sent successfully:", result);

    // Update rate limit state
    updateRateLimit();
  } catch (error) {
    // Log error but don't throw to prevent workflow failures
    console.error("Error sending push notification:", error);
  }
}

/**
 * Main entry point for CLI usage
 */
async function main(): Promise<void> {
  const title = process.env.PUSH_TITLE;
  const body = process.env.PUSH_BODY;
  const link = process.env.PUSH_LINK;
  const priorityStr = process.env.PUSH_PRIORITY;

  if (!title || !body) {
    console.error("PUSH_TITLE and PUSH_BODY environment variables are required");
    process.exit(1);
  }

  // Parse priority (default to 3 if invalid)
  let priority: 1 | 2 | 3 | 4 | 5 = 3;
  if (priorityStr) {
    const parsed = parseInt(priorityStr, 10);
    if (parsed >= 1 && parsed <= 5) {
      priority = parsed as 1 | 2 | 3 | 4 | 5;
    }
  }

  await sendPushNotification({
    title,
    body,
    link,
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

export { sendPushNotification, checkRateLimit, updateRateLimit };
export type { PushNotificationOptions };
