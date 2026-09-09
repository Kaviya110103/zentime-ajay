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
  echo "AUTO_SSL_ENABLED=${AUTO_SSL_ENABLED}; certbot will not request a certificate."
fi

echo "AUTO_SSL_ENABLED=${AUTO_SSL_ENABLED:-true}"
echo "SSL_DOMAIN=${SSL_DOMAIN:-}"

CERT_PATH="/etc/pki/tls/certs/zentime-backend.crt"
KEY_PATH="/etc/pki/tls/private/zentime-backend.key"

mkdir -p "$(dirname "$CERT_PATH")" "$(dirname "$KEY_PATH")"

cert_is_valid() {
  local cert_file="$1"
  local min_seconds="${2:-86400}"
  [[ -s "$cert_file" ]] && openssl x509 -checkend "$min_seconds" -noout -in "$cert_file" >/dev/null 2>&1
}

cert_matches_domain() {
  local cert_file="$1"
  openssl x509 -checkhost "$SSL_DOMAIN" -noout -in "$cert_file" >/dev/null 2>&1
}

deployed_cert_pair_is_valid() {
  [[ -s "$KEY_PATH" ]] && cert_is_valid "$CERT_PATH" && cert_matches_domain "$CERT_PATH"
}

write_temporary_self_signed_cert() {
  echo "Writing temporary self-signed certificate for $SSL_DOMAIN so nginx can start. Replace with Let's Encrypt/ACM certificate as soon as available."
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -days 7 \
    -subj "/CN=$SSL_DOMAIN" \
    -addext "subjectAltName=DNS:$SSL_DOMAIN" >/dev/null 2>&1
}

find_letsencrypt_live_dir() {
  local live_dir live_cert live_key
  for live_dir in "/etc/letsencrypt/live/$SSL_DOMAIN" /etc/letsencrypt/live/*; do
    [[ -d "$live_dir" ]] || continue
    live_cert="$live_dir/fullchain.pem"
    live_key="$live_dir/privkey.pem"
    if [[ -s "$live_cert" && -s "$live_key" ]] && cert_is_valid "$live_cert" && cert_matches_domain "$live_cert"; then
      echo "$live_dir"
      return 0
    fi
  done

  return 1
}

copy_letsencrypt_cert() {
  local live_dir live_cert live_key
  live_dir="$(find_letsencrypt_live_dir)" || return 1
  live_cert="$live_dir/fullchain.pem"
  live_key="$live_dir/privkey.pem"

  if [[ -s "$live_cert" && -s "$live_key" ]]; then
    echo "Reusing valid Let's Encrypt certificate for $SSL_DOMAIN."
    cp -L "$live_cert" "$CERT_PATH"
    cp -L "$live_key" "$KEY_PATH"
    return 0
  fi

  return 1
}

if [[ -n "${SSL_CERT_BASE64:-}" && -n "${SSL_KEY_BASE64:-}" ]]; then
  echo "$SSL_CERT_BASE64" | base64 -d > "$CERT_PATH"
  echo "$SSL_KEY_BASE64" | base64 -d > "$KEY_PATH"
elif [[ "${AUTO_SSL_ENABLED:-false}" == "true" ]]; then
  if [[ -z "${SSL_DOMAIN:-}" || -z "${SSL_EMAIL:-}" ]]; then
    echo "AUTO_SSL_ENABLED=true requires SSL_DOMAIN and SSL_EMAIL."
    exit 1
  fi

  if copy_letsencrypt_cert; then
    if ! cert_is_valid "$CERT_PATH" 2592000; then
      live_dir="$(find_letsencrypt_live_dir || true)"
      cert_name="$(basename "${live_dir:-$SSL_DOMAIN}")"
      echo "Certificate for $SSL_DOMAIN is valid but nearing renewal window; attempting non-blocking renewal."
      certbot renew --non-interactive --cert-name "$cert_name" && copy_letsencrypt_cert || \
        echo "certbot renew failed; continuing with existing valid certificate for $SSL_DOMAIN."
    fi
  elif deployed_cert_pair_is_valid; then
    echo "Keeping existing deployed certificate for $SSL_DOMAIN; it is still valid."
  else
    if systemctl is-active --quiet nginx.service; then
      systemctl stop nginx.service
    fi

    if [[ -d "/etc/letsencrypt/live/$SSL_DOMAIN" ]]; then
      echo "No valid copied certificate found; attempting safe certbot renew."
      if certbot renew --non-interactive --cert-name "$SSL_DOMAIN"; then
        copy_letsencrypt_cert
      else
        echo "certbot renew failed and no valid certificate is available for $SSL_DOMAIN."
        write_temporary_self_signed_cert
      fi
    else
      echo "No existing certificate found for $SSL_DOMAIN; requesting first certificate."
      if certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$SSL_EMAIL" \
        --preferred-challenges http \
        -d "$SSL_DOMAIN"; then
        copy_letsencrypt_cert
      else
        echo "certbot certonly failed for $SSL_DOMAIN."
        write_temporary_self_signed_cert
      fi
    fi
  fi

else
  if deployed_cert_pair_is_valid; then
    echo "AUTO_SSL_ENABLED=false; keeping existing deployed certificate for $SSL_DOMAIN."
  else
    echo "AUTO_SSL_ENABLED=false and no manual/valid certificate was provided."
    write_temporary_self_signed_cert
  fi
fi

chmod 644 "$CERT_PATH"
chmod 600 "$KEY_PATH"
chown root:root "$CERT_PATH" "$KEY_PATH"
