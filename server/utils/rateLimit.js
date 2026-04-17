const WINDOW  = 15 * 60 * 1000;
const buckets = new Map(); // bucket -> Map<ip, { windowStart, count }>

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

setInterval(() => {
    const now = Date.now();
    for (const map of buckets.values()) {
        for (const [ip, entry] of map) {
            if (now - entry.windowStart > WINDOW) map.delete(ip);
        }
    }
}, 30 * 60 * 1000);
