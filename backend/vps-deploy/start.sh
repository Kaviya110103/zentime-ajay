#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/zentime/backend}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
JAR_FILE="${JAR_FILE:-$APP_DIR/application.jar}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

mkdir -p "${UPLOAD_DIR:-$APP_DIR/uploads}"
exec java ${JAVA_OPTS:-} -jar "$JAR_FILE"
