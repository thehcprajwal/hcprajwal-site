/** Reads the JSON body. Returns null for a missing or malformed body instead of throwing a 500. */
export async function readJson(c) {
    try {
        const body = await c.req.json();
        return body && typeof body === 'object' ? body : null;
    } catch {
        return null;
    }
}
