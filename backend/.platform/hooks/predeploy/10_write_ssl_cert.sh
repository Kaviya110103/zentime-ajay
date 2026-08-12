#!/bin/bash
set -euo pipefail

load_eb_env() {
  if [[ -x /opt/elasticbeanstalk/bin/get-config ]]; then
    AUTO_SSL_ENABLED="${AUTO_SSL_ENABLED:-$(/opt/elasticbeanstalk/bin/get-config environment -k AUTO_SSL_ENABLED 2>/dev/null || true)}"
    SSL_DOMAIN="${SSL_DOMAIN:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_DOMAIN 2>/dev/null || true)}"
    SSL_EMAIL="${SSL_EMAIL:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_EMAIL 2>/dev/null || true)}"
    SSL_CERT_BASE64="${SSL_CERT_BASE64:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_CERT_BASE64 2>/dev/null || true)}"
    SSL_KEY_BASE64="${SSL_KEY_BASE64:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_KEY_BASE64 2>/dev/null || true)}"
    export AUTO_SSL_ENABLED SSL_DOMAIN SSL_EMAIL SSL_CERT_BASE64 SSL_KEY_BASE64
  fi

  AUTO_SSL_ENABLED="${AUTO_SSL_ENABLED:-true}"
  SSL_DOMAIN="${SSL_DOMAIN:-test2.zentime.co.in}"
  SSL_EMAIL="${SSL_EMAIL:-t.ajay.official26@zentime.co.in}"
  export AUTO_SSL_ENABLED SSL_DOMAIN SSL_EMAIL SSL_CERT_BASE64 SSL_KEY_BASE64
}

load_eb_env
if [[ "${AUTO_SSL_ENABLED:-true}" != "true" ]]; then
  echo "AUTO_SSL_ENABLED was ${AUTO_SSL_ENABLED}; forcing true for SSL deployment package."
  AUTO_SSL_ENABLED=true
  export AUTO_SSL_ENABLED
fi

echo "AUTO_SSL_ENABLED=${AUTO_SSL_ENABLED:-true}"
echo "SSL_DOMAIN=${SSL_DOMAIN:-}"

CERT_PATH="/etc/pki/tls/certs/zentime-backend.crt"
KEY_PATH="/etc/pki/tls/private/zentime-backend.key"

mkdir -p "$(dirname "$CERT_PATH")" "$(dirname "$KEY_PATH")"

if [[ -n "${SSL_CERT_BASE64:-}" && -n "${SSL_KEY_BASE64:-}" ]]; then
  echo "$SSL_CERT_BASE64" | base64 -d > "$CERT_PATH"
  echo "$SSL_KEY_BASE64" | base64 -d > "$KEY_PATH"
elif [[ "${AUTO_SSL_ENABLED:-false}" == "true" ]]; then
  if [[ -z "${SSL_DOMAIN:-}" || -z "${SSL_EMAIL:-}" ]]; then
    echo "AUTO_SSL_ENABLED=true requires SSL_DOMAIN and SSL_EMAIL."
    exit 1
  fi

  if systemctl is-active --quiet nginx.service; then
    systemctl stop nginx.service
  fi

  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$SSL_EMAIL" \
    --keep-until-expiring \
    --preferred-challenges http \
    -d "$SSL_DOMAIN"

  cp -L "/etc/letsencrypt/live/$SSL_DOMAIN/fullchain.pem" "$CERT_PATH"
  cp -L "/etc/letsencrypt/live/$SSL_DOMAIN/privkey.pem" "$KEY_PATH"
else
  echo "Set SSL_CERT_BASE64/SSL_KEY_BASE64 or set AUTO_SSL_ENABLED=true with SSL_DOMAIN and SSL_EMAIL."
  exit 1
fi

chmod 644 "$CERT_PATH"
chmod 600 "$KEY_PATH"
chown root:root "$CERT_PATH" "$KEY_PATH"
