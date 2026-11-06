#!/usr/bin/env bash
# Deploy helper for hc-site v2 (everything in us-east-1).
#   scripts/deploy.sh base            one-time: code bucket + execution role
#   scripts/deploy.sh secrets [.env]  one-time: put API keys into SSM (SecureString)
#   scripts/deploy.sh app [cert-arn] build, upload, deploy function + CloudFront (cert-arn attaches hcprajwal.in)
set -euo pipefail
cd "$(dirname "$0")/.."

export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
NAME=hc-site
PREFIX=/hc-site
BASE=$NAME-base
APP=$NAME-app

out() { aws cloudformation describe-stacks --stack-name "$1" \
          --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text; }

case "${1:-}" in
  base)
    aws cloudformation deploy --stack-name "$BASE" --template-file infra/base.yaml \
      --capabilities CAPABILITY_NAMED_IAM \
      --parameter-overrides FunctionName=$NAME SsmPrefix=$PREFIX
    ;;
  secrets)
    ENV_FILE="${2:-.env}"
    [[ -f "$ENV_FILE" ]] || { echo "✗ $ENV_FILE not found"; exit 1; }
    for KEY in OPENROUTER_API_KEY RESEND_API_KEY; do
      VAL=$(grep -E "^$KEY=" "$ENV_FILE" | head -1 | cut -d= -f2-)
      [[ -n "$VAL" ]] || { echo "✗ $KEY is empty in $ENV_FILE"; exit 1; }
      TMP=$(mktemp); chmod 600 "$TMP"; printf '%s' "$VAL" > "$TMP"
      aws ssm put-parameter --name "$PREFIX/$KEY" --type SecureString --overwrite --value "file://$TMP" >/dev/null
      rm -f "$TMP"
      echo "✓ $PREFIX/$KEY stored"
    done
    ;;
  app)
    CERT="${2:-}"
    BUCKET=$(out "$BASE" CodeBucketName); ROLE=$(out "$BASE" WebRoleArn)
    bash scripts/package.sh
    VERSION=$(aws s3api put-object --bucket "$BUCKET" --key "$NAME/function.zip" \
                --body function.zip --query VersionId --output text)
    echo "▸ uploaded s3://$BUCKET/$NAME/function.zip (version $VERSION)"
    # In CI, CFN_ROLE_ARN makes CloudFormation use its own narrower role (see infra/github-deploy.yaml)
    ROLE_ARGS=(); [[ -n "${CFN_ROLE_ARN:-}" ]] && ROLE_ARGS=(--role-arn "$CFN_ROLE_ARN")
    aws cloudformation deploy --stack-name "$APP" --template-file infra/app.yaml ${ROLE_ARGS[@]+"${ROLE_ARGS[@]}"} \
      --parameter-overrides FunctionName=$NAME CodeBucket="$BUCKET" CodeKey="$NAME/function.zip" \
        CodeVersionId="$VERSION" RoleArn="$ROLE" SsmPrefix=$PREFIX CertificateArn="$CERT"
    # Old cached HTML points at asset files this release no longer has, so clear CloudFront's cache.
    aws cloudfront create-invalidation --distribution-id "$(out "$APP" DistributionId)" --paths "/*" \
      --query 'Invalidation.Id' --output text >/dev/null
    echo "✓ cache cleared"
    echo "✓ $(out "$APP" SiteUrl)"
    ;;
  *) sed -n 2,6p "$0"; exit 1 ;;
esac
