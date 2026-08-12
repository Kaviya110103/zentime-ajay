#!/bin/bash
set -euo pipefail

load_eb_env() {
  if [[ -x /opt/elasticbeanstalk/bin/get-config ]]; then
    AUTO_SSL_ENABLED="${AUTO_SSL_ENABLED:-$(/opt/elasticbeanstalk/bin/get-config environment -k AUTO_SSL_ENABLED 2>/dev/null || true)}"
    SSL_DOMAIN="${SSL_DOMAIN:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_DOMAIN 2>/dev/null || true)}"
    SSL_EMAIL="${SSL_EMAIL:-$(/opt/elasticbeanstalk/bin/get-config environment -k SSL_EMAIL 2>/dev/null || true)}"
    export AUTO_SSL_ENABLED SSL_DOMAIN SSL_EMAIL
  fi

  AUTO_SSL_ENABLED="${AUTO_SSL_ENABLED:-true}"
  SSL_DOMAIN="${SSL_DOMAIN:-test2.zentime.co.in}"
  SSL_EMAIL="${SSL_EMAIL:-t.ajay.official26@zentime.co.in}"
  export AUTO_SSL_ENABLED SSL_DOMAIN SSL_EMAIL
}

load_eb_env
if [[ "${AUTO_SSL_ENABLED:-true}" != "true" ]]; then
  echo "AUTO_SSL_ENABLED was ${AUTO_SSL_ENABLED}; forcing true for SSL deployment package."
  AUTO_SSL_ENABLED=true
  export AUTO_SSL_ENABLED
fi

echo "AUTO_SSL_ENABLED=${AUTO_SSL_ENABLED:-true}"
echo "SSL_DOMAIN=${SSL_DOMAIN:-}"

if [[ "${AUTO_SSL_ENABLED:-false}" != "true" ]]; then
  exit 0
fi

if command -v certbot >/dev/null 2>&1; then
  exit 0
fi

if command -v dnf >/dev/null 2>&1; then
  dnf install -y certbot
elif command -v yum >/dev/null 2>&1; then
  yum install -y certbot || {
    amazon-linux-extras install epel -y
    yum install -y certbot
  }
else
  echo "No supported package manager found for certbot installation."
  exit 1
fi
