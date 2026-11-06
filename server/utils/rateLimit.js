/**
 * Simple per-IP rate limiter, kept in memory.
 * Each Lambda execution environment has its own counters, which is fine for a low-traffic
 * portfolio. The endpoint also has a global cap (see infra/app.yaml).
 */
const WINDOW  = 15 * 60 * 1000;
const buckets = new Map(); // bucket -> Map<ip, { windowStart, count }>

/** Returns true when this IP has used up its `limit` requests in the current 15-minute window. */
export function isRateLimited(ip, limit = 3, bucket = 'default') {
    if (!buckets.has(bucket)) buckets.set(bucket, new Map());
    const map   = buckets.get(bucket);
    const now   = Date.now();
    const entry = map.get(ip);

    if (!entry || now - entry.windowStart > WINDOW) {
        map.set(ip, { windowStart: now, count: 1 });
        return false;
    }
    if (entry.count >= limit) return true;
    entry.count++;
    return false;
}

// Clean up old entries now and then. unref() so this timer never keeps the process alive.
setInterval(() => {
    const now = Date.now();
    for (const map of buckets.values()) {
        for (const [ip, entry] of map) {
            if (now - entry.windowStart > WINDOW) map.delete(ip);
        }
    }
}, 30 * 60 * 1000).unref();
