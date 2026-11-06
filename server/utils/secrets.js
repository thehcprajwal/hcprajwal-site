// Loads secrets from SSM Parameter Store (SecureString) into process.env.
// Only runs when SSM_PREFIX is set (i.e. on Lambda). Locally, .env is used instead.
// Never throws: a failure is logged and the server still starts, so /api/health
// can report what is missing instead of the revision silently failing to boot.

const NAMES = ['OPENROUTER_API_KEY', 'RESEND_API_KEY'];

export async function loadSecrets() {
    const prefix = process.env.SSM_PREFIX;
    if (!prefix) return;

    try {
        const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm');
        const client = new SSMClient({});
        const { Parameters = [], InvalidParameters = [] } = await client.send(
            new GetParametersCommand({
                Names: NAMES.map((n) => `${prefix}/${n}`),
                WithDecryption: true,
            })
        );

        for (const p of Parameters) {
            const key = p.Name.slice(prefix.length + 1);
            if (!process.env[key]) process.env[key] = p.Value;
        }
        if (InvalidParameters.length) {
            console.error('[secrets] not found in SSM:', InvalidParameters.join(', '));
        }
    } catch (err) {
        console.error('[secrets] SSM load failed:', err.message);
    }
}
