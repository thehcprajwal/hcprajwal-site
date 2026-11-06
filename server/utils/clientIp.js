/**
 * Works out the visitor's IP address, used as the rate-limit key.
 *
 * The Lambda endpoint is IamAuth and only CloudFront can reach it, so the header
 * CloudFront adds (CloudFront-Viewer-Address) cannot be forged by a visitor.
 * Its format is "203.0.113.9:4444", or "[2001:db8::1]:4444" for IPv6.
 */
export function parseViewerAddress(addr) {
    if (addr.startsWith('[')) return addr.slice(1, addr.indexOf(']'));         // [ipv6]:port
    const colons = (addr.match(/:/g) || []).length;
    return colons === 1 ? addr.split(':')[0] : addr;                           // ipv4:port, or bare ipv6
}

let logged = false;

export function getClientIp(c) {
    const addr = c.req.header('cloudfront-viewer-address');
    if (!addr) return '127.0.0.1';                                             // local dev, no CloudFront
    if (!logged) { logged = true; console.log('[ip] viewer-address sample:', addr); }
    return parseViewerAddress(addr);
}
