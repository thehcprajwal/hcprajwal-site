# hc-site v2

Prajwal's terminal-style portfolio at **https://hcprajwal.in**, running fully on AWS.
One small Node.js app (Hono) serves the website and three API routes. There is no server to
manage: AWS runs it only when someone visits.

This README explains what each AWS service does here, how the pieces were set up, and how to
operate it. Everything in AWS is created from the files in `infra/`, in **us-east-1**.

---

## 1. The big picture

```
                        visitor's browser
                               |
                  Cloudflare DNS  (DNS only, grey cloud)
                               |
                          CloudFront            <- certificate for hcprajwal.in (ACM)
                  (cache, HTTPS, www redirect)
                               |   signs each request (origin access control)
                               v
                Lambda Web Function "hc-site"     <- code zip stored in S3
                  Node 24 + Hono, one function
                  /            the website (dist/)
                  /api/health  which secrets are loaded
                  /api/contact contact form  -> Resend (email)
                  /api/agent   chat          -> OpenRouter (AI model, streamed)
                               |
              +----------------+-----------------+
              |                                  |
   SSM Parameter Store                    CloudWatch Logs
   (API keys, encrypted)                  (/aws/lambda/web/hc-site)
```

The Lambda endpoint cannot be called directly. It only accepts requests that CloudFront has
signed, so the internet can only reach the site through CloudFront.

---

## 2. AWS services used, and what each one does

| Service | What it does here | Where it is defined |
|---|---|---|
| **Lambda Web Functions** | Runs the app. Unlike a normal Lambda, the app is a regular web server (Hono) that listens on a port, and AWS gives it an HTTPS endpoint. It scales to zero when nobody visits, so you pay almost nothing. | `infra/app.yaml` (`WebFunction`, `WebFunctionRevision`, `WebFunctionEndpoint`) |
| **CloudFront** | The front door. Provides the `hcprajwal.in` domain over HTTPS, caches the website so most page loads never wake Lambda, redirects `www` to the bare domain, and is the only thing allowed to call Lambda. | `infra/app.yaml` (`Distribution`, `OriginAccessControl`, `ApiOriginRequestPolicy`, `WwwRedirectFunction`) |
| **ACM** (Certificate Manager) | The free TLS certificate for `hcprajwal.in` and `www.hcprajwal.in`. It renews itself while its two validation CNAME records stay in Cloudflare. | Requested with the AWS CLI (see section 5) |
| **S3** | Stores the code package (`function.zip`). Lambda reads the code from here. Versioning is on, and each upload is a new version. | `infra/base.yaml` (`CodeBucket`) |
| **IAM** | The role the function runs as (`hc-site-web-role`). It can write logs and read only the two secrets under `/hc-site/`. Nothing else. Two more roles let GitHub deploy without stored keys (section 7). | `infra/base.yaml` (`WebRole`), `infra/github-deploy.yaml` |
| **SSM Parameter Store** | Holds the two API keys as encrypted `SecureString` parameters. The app reads them once at startup, so no secret is ever in the code or in the Lambda settings. | Created by hand in the console: `/hc-site/OPENROUTER_API_KEY`, `/hc-site/RESEND_API_KEY` |
| **CloudWatch Logs** | The app's logs. Created automatically by Lambda. | Log group `/aws/lambda/web/hc-site` |
| **CloudFormation** | Creates and updates everything above from the templates in `infra/`, so the setup can be repeated or removed with one command. | Stacks `hc-site-base` and `hc-site-app` |

Not on AWS:

| Service | What it does |
|---|---|
| **Cloudflare** | DNS for `hcprajwal.in` (records are DNS only, not proxied). Also runs **Email Routing**, which forwards `hello@hcprajwal.in`. This is why DNS stays at Cloudflare. |
| **Resend** | Sends the contact form emails. |
| **OpenRouter** | The AI model behind the chat. |
| **Hostinger** | Where the domain is registered. |

---

## 3. What happens on a request

1. The browser asks Cloudflare DNS for `hcprajwal.in` and gets CloudFront's addresses.
2. **Page loads** (`/`, scripts, styles): CloudFront answers from its cache. Only a cache miss
   reaches Lambda. HTML is cached for 5 minutes and assets for a year (their file names change
   when the code changes). So a visitor never waits for a Lambda cold start just to see the site.
3. **API calls** (`/api/*`) are never cached. CloudFront signs the request and passes it to Lambda,
   adding the visitor's address in the `CloudFront-Viewer-Address` header.
4. If no Lambda environment is running, AWS starts one (a "cold start", about 1.5 seconds).
   The app reads its keys from SSM, then starts listening.
5. `/api/contact` sends the email through Resend. `/api/agent` streams the model's answer back
   word by word. Both are rate limited per visitor address.

---

## 4. Code layout

```
index.js                 Entry file Lambda looks for. Just starts server/index.js.
shared/
  profile.js             YOUR details (skills, projects, links). Used by the terminal AND the chat agent.
server/                  The backend
  index.js               Startup order: load secrets -> config -> clients -> app -> listen
  config.js              Reads every environment setting in one place
  clients.js             Creates the OpenRouter and Resend clients (null if a key is missing)
  app.js                 Middleware (logging, security headers, gzip) and mounts the routes
  routes/                health.js, contact.js, agent.js, frontend.js (serves the built website)
  prompts/
    portfolio-agent.js   The chat agent's instructions, built from shared/profile.js
  utils/                 secrets.js (SSM), rateLimit.js, clientIp.js, json.js
src/                     The website (Vite builds it into dist/)
  index.html             Page shell, link-preview tags, and a no-JavaScript fallback
  js/
    main.js              Starts the terminal, then loads the 3D background when the browser is idle
    terminal.js          Controller: input box and keyboard, hands work to the modules below
    commands/            One small file per command (help, whoami, skills, projects, ...)
      index.js           THE command list. help, autocomplete and typo hints all read it.
    render.js            Draws text on screen          history.js     Up/down arrow recall
    agentSession.js      Asking the AI, streaming the answer, Ctrl+C to stop
    chat.js              Talks to /api/agent, remembers the conversation (sessionStorage)
    contact.js           The step-by-step contact form  boot.js       Start-up animation
    autocomplete.js      Grey ghost suggestion          background.js  Lazy-loads three.js
infra/
  base.yaml              S3 bucket + IAM role (deployed once)
  app.yaml               Lambda function + CloudFront (redeployed on every release)
  github-deploy.yaml     Roles that let GitHub Actions deploy (deployed once)
scripts/
  package.sh             Builds the site and the deployable zip
  deploy.sh              Wraps the AWS commands (base, secrets, app)
../.github/workflows/deploy.yml   Deploys on push to main
```

**How to change things**

- **Your skills, projects, links:** edit `shared/profile.js`. The terminal and the chat agent both update.
- **Add a terminal command:** create `src/js/commands/<name>.js` exporting `{ name, desc, run(ctx, args) }`
  and add it to the list in `src/js/commands/index.js`. It appears in `help`, autocomplete and typo hints.
- **Change the chat agent's tone or rules:** `server/prompts/portfolio-agent.js`.

Things worth knowing about the code:

- **A missing key does not crash the app.** The server starts anyway and `/api/health` reports
  `"missing"`. On Lambda a crashing app is much harder to debug than one that says what is wrong.
- **The server must listen on the address Lambda gives it** (`AWS_LAMBDA_HTTP_ENDPOINT`), or the
  environment never becomes ready. `config.js` handles this and falls back to `PORT` locally.
- **The AWS SDK is not included in the Lambda runtime**, so `@aws-sdk/client-ssm` is a normal
  dependency that gets packaged into the zip.
- **The chat only accepts user and assistant messages**, capped in number and size, so a visitor
  cannot inject their own instructions or send a huge request that costs money.
- **three.js loads late.** The terminal appears first and the 3D background arrives when the browser
  is idle. Visitors who prefer reduced motion never download it.
- **In the terminal:** Ctrl+C stops a streaming answer, and the conversation survives a page reload.

---

## 5. How we built it (in order)

### Decisions

| Question | Choice | Why |
|---|---|---|
| How many Lambdas? | **One** | The app is one small server with three routes. A Web Function runs a whole server, so there is nothing to split. |
| Why not keep EC2? | Replaced it | EC2 needed a start/stop schedule and changing-IP tricks and cost far more. Lambda scales to zero and has a fixed address. |
| Public or private endpoint? | **Private (`IamAuth`) behind CloudFront** | Only CloudFront can call it, so there is no public back door and no shared secret to manage. |
| Custom domain? | **CloudFront + ACM** | A Web Function endpoint cannot take a custom domain itself. CloudFront is the documented way. |
| Where does DNS live? | **Stays on Cloudflare** | Cloudflare Email Routing (for `hello@`) only works while Cloudflare hosts the DNS. Moving to Route 53 would break it. |
| Secrets? | **SSM Parameter Store** | Free for standard parameters, encrypted, and not visible in the Lambda settings. |
| Infrastructure tool? | **Plain CloudFormation** | No extra tooling to install, and the templates are readable. |

### Steps we ran

```bash
# 1. Make sure the right AWS account is selected (profile hcprajwal-cloud)
aws sts get-caller-identity

# 2. S3 bucket + IAM role
scripts/deploy.sh base

# 3. Create the two secrets in the console (Parameter Store, us-east-1, type SecureString):
#      /hc-site/OPENROUTER_API_KEY
#      /hc-site/RESEND_API_KEY

# 4. Build, upload the zip to S3, deploy Lambda + CloudFront
scripts/deploy.sh app
#    prints a https://xxxx.cloudfront.net address: test the site there first

# 5. Request the certificate (it must be in us-east-1 for CloudFront)
aws acm request-certificate --region us-east-1 \
  --domain-name hcprajwal.in --subject-alternative-names www.hcprajwal.in \
  --validation-method DNS
aws acm describe-certificate --region us-east-1 --certificate-arn <ARN> \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
#    add the two CNAME records it prints in Cloudflare (DNS only), wait for status ISSUED

# 6. Attach the domain to CloudFront
scripts/deploy.sh app <certificate-arn>

# 7. In Cloudflare: delete the old Tunnel records for hcprajwal.in and www, then add
#    CNAME @   -> <DistributionDomain>   (DNS only)
#    CNAME www -> <DistributionDomain>   (DNS only)
#    Leave the MX, DKIM, nextcloud and vault records alone.
```

`<DistributionDomain>` is `d3lmr6bczxyk3e.cloudfront.net` (also an output of the `hc-site-app` stack).

### Problems we hit, and the fixes

- **`aws lambda-web` was not found.** The AWS CLI was too old. `brew upgrade awscli` fixed it.
- **Web Functions does not exist in ap-south-2** (the profile's default region). The templates
  only validate in us-east-1, so `deploy.sh` pins that region. Always pass `--region us-east-1`
  when running AWS commands by hand.
- **Endpoint rate limit rejected.** The API only accepts multiples of 100, so the cap is 100
  requests per second, not 20.
- **A failed stack gets stuck in `ROLLBACK_COMPLETE`** and cannot be updated. Delete the stack
  and deploy again.
- **POST requests through CloudFront.** We checked the AWS docs: with origin access control,
  CloudFront signs the request body itself, so the browser needs no special header. Confirmed
  working (the contact form returns its normal validation message, not a 403).
- **The old site used Cloudflare Tunnel records** for the bare domain and `www`. A CNAME cannot
  share a name with them, so they had to be deleted first.

---

## 6. Day-to-day operations

**Release a change** (or just push to `main`, section 7)
```bash
scripts/deploy.sh app <certificate-arn>
```
It rebuilds, uploads a new version of `function.zip`, and CloudFormation switches Lambda to it.
Always pass the certificate ARN, or the domain is removed from CloudFront.
(`arn:aws:acm:us-east-1:278371786585:certificate/efdaf775-a5cf-46d9-8733-a941dbceeb93`)

**Change a secret**: edit the parameter in the console, then run the release command above.
Running environments only read secrets when they start, so a new release is what makes them pick
up the change.

**Check it is healthy**
```bash
curl https://hcprajwal.in/api/health
```
You want `"openrouter":"configured"` and `"resend":"configured"`. `"missing"` means the SSM
parameter does not exist, has the wrong name, or the function has not restarted since you added it.

**Read the logs**
```bash
aws logs tail /aws/lambda/web/hc-site --region us-east-1 --since 1h --follow
```

**Roll back**: check out the previous git commit and run the release command again.

**Costs are capped by two settings** in `infra/app.yaml`: at most 3 environments running at once
(`MaxEnvironments`) and 100 requests per second (`RateLimit`).

**Remove everything**
```bash
aws cloudformation delete-stack --stack-name hc-site-app  --region us-east-1
aws cloudformation delete-stack --stack-name hc-site-base --region us-east-1
```
The S3 bucket is kept on purpose (empty it and delete it by hand). Also delete the ACM certificate,
the two SSM parameters and the Cloudflare CNAME records.

---

## 7. Deploy from GitHub (push to main)

`.github/workflows/deploy.yml` builds and deploys whenever code changes on `main`. It needs **no AWS keys
in GitHub**: GitHub proves who it is with a short-lived OIDC token, and AWS only trusts pushes to the
`main` branch of `thehcprajwal/hcprajwal-site`.

One-time setup (creates an OIDC trust and two IAM roles, so run it yourself):

```bash
AWS_REGION=us-east-1 aws cloudformation deploy --stack-name hc-site-github \
  --template-file infra/github-deploy.yaml --capabilities CAPABILITY_NAMED_IAM
```

Then push to `main`. The job logs in with the role `hc-site-github-deploy`, finds the certificate, runs
`scripts/deploy.sh app`, and finally calls `/api/health` on the live site. CloudFormation does the actual
changes through a second, narrower role (`hc-site-cloudformation`, limited to Lambda, CloudFront and reading
the code bucket). The workflow can also be started by hand from the repository's Actions tab.

If the account ever gets a second GitHub OIDC provider created elsewhere, delete that line from the template,
because AWS allows only one per account.

---

## 8. What it costs

For a portfolio with a handful of visits a day, about **$0.15 a month** in a normal month,
and a worst case of roughly $3.

- Lambda: you pay for requests, active CPU time, and the memory an environment holds while it
  exists (including idle time between requests). At this traffic that is a few cents.
- CloudFront: the free tier (1 TB out, 10 million requests a month) covers it.
- ACM certificate, standard SSM parameters, CloudFormation: free.
- S3 and CloudWatch Logs: pennies or free at this size.
- There is no Route 53 and no WAF. Both would add cost without much benefit here.

---

## 9. Local development

```bash
npm install
cp .env.example .env     # add your OPENROUTER_API_KEY and RESEND_API_KEY
npm run dev              # website on http://localhost:3000, API on :3001
```

`npm run package` builds the same zip that gets deployed (`function.zip`, plus a `.lambda/` folder).
