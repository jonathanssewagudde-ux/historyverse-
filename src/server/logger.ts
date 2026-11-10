import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_KEY_PATTERN = /(secret|token|password|api[_-]?key|authorization|cookie)/i;

/** Recursively mask values whose keys look secret, so credentials never reach logs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_KEY_PATTERN.test(k) ? "[redacted]" : redact(v, depth + 1),
    ]),
  );
}

function threshold(): number {
  const level = (process.env.LOG_LEVEL as Level | undefined) ?? "info";
  return order[level] ?? order.info;
}

function emit(level: Level, scope: string, message: string, data?: Record<string, unknown>) {
  if (order[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    scope,
    message,
    time: new Date().toISOString(),
    ...(data ? { data: redact(data) } : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else process.stdout.write(line + "\n");
}

/** Minimal structured JSON logger. Swap for pino/OpenTelemetry in Milestone 15 if needed. */
export function createLogger(scope: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit("debug", scope, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => emit("info", scope, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => emit("warn", scope, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", scope, msg, data),
  };
}
