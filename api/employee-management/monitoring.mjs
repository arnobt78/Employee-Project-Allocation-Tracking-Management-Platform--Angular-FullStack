// API Request Monitoring System
// Tracks all API requests for real-time status and performance metrics

const SERVER_START_TIME = Date.now();

// In-memory storage for request logs
// Structure: { [date]: [{ timestamp, endpoint, method, status, responseTime, ... }] }
const requestLogs = new Map();

// Endpoint usage counters
// { endpoint: { count, totalResponseTime, errors, successes, authDenials } }
const endpointUsage = new Map();

// Maximum logs to keep per day (to prevent memory issues)
const MAX_LOGS_PER_DAY = 10000;

// Maximum days to keep logs
const MAX_DAYS_TO_KEEP = 30;

/**
 * Expected access-control responses — not endpoint failures.
 * @param {number} status
 */
export function isAuthDenialStatus(status) {
  return status === 401 || status === 403;
}

/**
 * Get current date as YYYY-MM-DD string
 */
function getDateKey(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().split("T")[0];
}

/**
 * Clean up old logs (older than MAX_DAYS_TO_KEEP)
 */
function cleanupOldLogs() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_TO_KEEP);
  const cutoffKey = getDateKey(cutoffDate.getTime());

  for (const [dateKey] of requestLogs) {
    if (dateKey < cutoffKey) {
      requestLogs.delete(dateKey);
    }
  }
}

/**
 * Logs used for health / success-rate (excludes auth denials).
 */
function healthRelevantLogs(logs) {
  return logs.filter((log) => !log.authDenial);
}

/**
 * Log an API request
 */
export function logRequest({
  endpoint,
  method,
  status,
  responseTime,
  error = null,
  timestamp = Date.now(),
}) {
  const dateKey = getDateKey(timestamp);
  const authDenial = isAuthDenialStatus(status);
  const success = status >= 200 && status < 400;

  // Initialize date bucket if needed
  if (!requestLogs.has(dateKey)) {
    requestLogs.set(dateKey, []);
  }

  const dayLogs = requestLogs.get(dateKey);

  // Limit logs per day
  if (dayLogs.length >= MAX_LOGS_PER_DAY) {
    dayLogs.shift(); // Remove oldest
  }

  // Add new log entry (auth denials kept for activity, excluded from health)
  dayLogs.push({
    timestamp,
    endpoint,
    method,
    status,
    responseTime,
    error: error ? error.message : null,
    success,
    authDenial,
  });

  // Update endpoint usage statistics
  if (!endpointUsage.has(endpoint)) {
    endpointUsage.set(endpoint, {
      count: 0,
      totalResponseTime: 0,
      errors: 0,
      successes: 0,
      authDenials: 0,
      lastUsed: timestamp,
    });
  }

  const usage = endpointUsage.get(endpoint);
  usage.lastUsed = timestamp;

  if (authDenial) {
    usage.authDenials++;
  } else {
    usage.count++;
    usage.totalResponseTime += responseTime;
    if (success) {
      usage.successes++;
    } else {
      usage.errors++;
    }
  }

  // Periodic cleanup
  if (Math.random() < 0.01) {
    // 1% chance to cleanup on each request
    cleanupOldLogs();
  }
}

/**
 * Get performance history for last N days
 */
export function getPerformanceHistory(days = 7) {
  const now = Date.now();
  const history = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = getDateKey(date.getTime());
    const dayLogs = requestLogs.get(dateKey) || [];
    const healthLogs = healthRelevantLogs(dayLogs);

    if (healthLogs.length === 0) {
      history.push({
        date: dateKey,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        avgResponseTime: 0,
        requests: 0,
        successRate: 100,
        errors: 0,
      });
      continue;
    }

    const totalResponseTime = healthLogs.reduce(
      (sum, log) => sum + log.responseTime,
      0
    );
    const avgResponseTime = Math.round(totalResponseTime / healthLogs.length);
    const successes = healthLogs.filter((log) => log.success).length;
    const errors = healthLogs.filter((log) => !log.success).length;
    const successRate =
      Math.round((successes / healthLogs.length) * 1000) / 10;

    history.push({
      date: dateKey,
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      avgResponseTime,
      requests: healthLogs.length,
      successRate,
      errors,
    });
  }

  return history;
}

/**
 * Get recent activity (last N requests)
 */
export function getRecentActivity(limit = 20) {
  const allLogs = [];

  // Collect logs from all days, sorted by timestamp
  for (const [dateKey, logs] of requestLogs) {
    for (const log of logs) {
      allLogs.push({ ...log, dateKey });
    }
  }

  // Sort by timestamp (newest first) and take limit
  return allLogs
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map((log) => ({
      timestamp: new Date(log.timestamp).toISOString(),
      endpoint: log.endpoint,
      method: log.method,
      status: log.status,
      responseTime: log.responseTime,
    }));
}

/**
 * Get overall statistics
 */
export function getOverallStats() {
  const allLogs = [];

  for (const logs of requestLogs.values()) {
    allLogs.push(...logs);
  }

  const healthLogs = healthRelevantLogs(allLogs);

  if (healthLogs.length === 0) {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      successRate: 100,
      errorRate: 0,
      totalErrors: 0,
    };
  }

  const totalRequests = healthLogs.length;
  const totalResponseTime = healthLogs.reduce(
    (sum, log) => sum + log.responseTime,
    0
  );
  const avgResponseTime = Math.round(totalResponseTime / totalRequests);
  const successes = healthLogs.filter((log) => log.success).length;
  const successRate = Math.round((successes / totalRequests) * 1000) / 10;
  const errors = healthLogs.filter((log) => !log.success).length;
  const errorRate = Math.round((errors / totalRequests) * 1000) / 10;

  return {
    totalRequests,
    avgResponseTime,
    successRate,
    errorRate,
    totalErrors: errors,
  };
}

/**
 * Get endpoint health by category
 */
export function getEndpointHealth() {
  const categories = {
    Departments: ["GetParentDepartment", "GetChildDepartmentByParentId"],
    Employees: [
      "GetAllEmployees",
      "CreateEmployee",
      "UpdateEmployee",
      "DeleteEmployee",
    ],
    Projects: [
      "GetAllProjects",
      "GetProject",
      "CreateProject",
      "UpdateProject",
      "DeleteProject",
    ],
    Assignments: [
      "GetAllProjectEmployees",
      "CreateProjectEmployee",
      "UpdateProjectEmployee",
      "DeleteProjectEmployee",
    ],
    Dashboard: ["GetDashboard"],
    Schedule: ["GetSchedule"],
    Approvals: [
      "RequestApproval",
      "ApproveProject",
      "RejectProject",
      "ResetProjectApproval",
      "AddReviewerComment",
      "ResolveReviewerComment",
    ],
    AI: ["GenerateOverviewDraft"],
    Content: ["GetContentfulBrief"],
  };

  const health = [];

  for (const [category, endpoints] of Object.entries(categories)) {
    let total = 0;
    let healthy = 0;
    let totalResponseTime = 0;
    let totalRequests = 0;

    for (const endpoint of endpoints) {
      total++;
      const usage = endpointUsage.get(endpoint);

      if (usage && usage.count > 0) {
        totalRequests += usage.count;
        totalResponseTime += usage.totalResponseTime;

        // Consider healthy if success rate > 95% or no errors
        const successRate =
          usage.count > 0 ? (usage.successes / usage.count) * 100 : 100;

        if (successRate >= 95) {
          healthy++;
        }
      } else {
        // Endpoint not used yet (or only auth denials), assume healthy
        healthy++;
      }
    }

    const avgResponseTime =
      totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0;

    const status =
      healthy === total
        ? "operational"
        : healthy > total * 0.5
          ? "degraded"
          : "down";

    health.push({
      category,
      total,
      healthy,
      avgResponseTime,
      status,
    });
  }

  return health;
}

/**
 * Get server uptime
 */
export function getUptime() {
  const uptimeMs = Date.now() - SERVER_START_TIME;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  // Calculate uptime percentage (assuming 24/7 operation)
  // For simplicity, we'll use a high percentage if server has been up for a while
  const daysUp = uptimeDays + uptimeHours / 24;
  const uptimePercentage =
    daysUp > 0 ? Math.min(99.9, 100 - 0.1 / daysUp) : 99.9;

  return {
    milliseconds: uptimeMs,
    seconds: uptimeSeconds,
    minutes: uptimeMinutes,
    hours: uptimeHours,
    days: uptimeDays,
    percentage: Math.round(uptimePercentage * 10) / 10,
    formatted: formatUptime(uptimeDays, uptimeHours, uptimeMinutes),
  };
}

function formatUptime(days, hours, minutes) {
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}
