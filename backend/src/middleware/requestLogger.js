import { randomUUID } from "node:crypto";

export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console.log(JSON.stringify({
      type: "http_request",
      level,
      requestId,
      method: req.method,
      path: req.path,
      status,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: new Date().toISOString()
    }));
  });

  return next();
}
