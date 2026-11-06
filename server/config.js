/**
 * All environment settings in one place.
 * Call this AFTER loadSecrets(), because on Lambda the API keys arrive from SSM at startup.
 */
export function loadConfig(env = process.env) {
    // Lambda Web Functions tell the app exactly which "host:port" to listen on, and the
    // runtime probes that address to decide the app is ready. Locally we use PORT instead.
    const endpoint = env.AWS_LAMBDA_HTTP_ENDPOINT;
    const host = endpoint ? endpoint.slice(0, endpoint.lastIndexOf(':')) : undefined;
    const port = endpoint
        ? parseInt(endpoint.slice(endpoint.lastIndexOf(':') + 1))
        : parseInt(env.PORT) || 3001;

    return {
        host,
        port,
        nodeEnv:        env.NODE_ENV || 'development',
        domain:         env.DOMAIN || 'hcprajwal.in',          // used for the email sender address
        siteUrl:        env.DOMAIN ? `https://${env.DOMAIN}` : `http://localhost:${port}`,
        contactTo:      env.CONTACT_TO_EMAIL || 'hello@hcprajwal.in',
        model:          env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        openrouterKey:  env.OPENROUTER_API_KEY || '',
        resendKey:      env.RESEND_API_KEY || '',
    };
}
