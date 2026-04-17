#!/usr/bin/env bash
set -euo pipefail

APP_NAME="time-tracker"
APP_USER="timetracker"
APP_ROOT="/opt/${APP_NAME}"
APP_DIR="${APP_ROOT}/app"
WEB_ROOT="/var/www/${APP_NAME}"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/${APP_NAME}.env"
BACKUP_DIR="/var/backups/${APP_NAME}"
DB_NAME="${DB_NAME:-timetracker}"
DB_USER="${DB_USER:-timetracker}"
DB_PASSWORD="${DB_PASSWORD:-timetracker}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this script as root inside the Proxmox Debian/Ubuntu CT." >&2
    exit 1
  fi
}

install_packages() {
  apt-get update
  apt-get install -y ca-certificates curl git nginx postgresql postgresql-contrib rsync build-essential openssl sudo

  if ! command -v node >/dev/null 2>&1 || ! node --version | grep -Eq '^v(18|20|22|23|24)\.'; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  if ! command -v go >/dev/null 2>&1; then
    apt-get install -y golang-go
  fi
}

create_user_and_dirs() {
  if ! id "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --home "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"
  fi

  install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}" "${APP_DIR}"
  install -d -o www-data -g www-data "${WEB_ROOT}"
  install -d -m 750 -o root -g "${APP_USER}" "${ENV_DIR}"
  install -d -m 750 -o postgres -g postgres "${BACKUP_DIR}"
}

configure_database() {
  systemctl enable --now postgresql

  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
}

write_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    echo "Keeping existing ${ENV_FILE}"
    return
  fi

  local jwt_secret
  jwt_secret="$(openssl rand -hex 32)"
  cat > "${ENV_FILE}" <<EOF
JWT_SECRET=${jwt_secret}
DATABASE_URL=host=127.0.0.1 user=${DB_USER} password=${DB_PASSWORD} dbname=${DB_NAME} port=5432 sslmode=disable
PORT=8080
GIN_MODE=release
CORS_ORIGINS=http://$(hostname -I | awk '{print $1}')
EOF
  chown root:"${APP_USER}" "${ENV_FILE}"
  chmod 640 "${ENV_FILE}"
}

sync_source() {
  rsync -a --delete \
    --exclude "client/node_modules" \
    --exclude "client/dist" \
    --exclude "backend/timetracker" \
    "${REPO_ROOT}/" "${APP_DIR}/"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
}

build_app() {
  pushd "${APP_DIR}/client" >/dev/null
  sudo -u "${APP_USER}" npm ci
  sudo -u "${APP_USER}" env VITE_API_URL=/api npm run build
  rsync -a --delete dist/ "${WEB_ROOT}/"
  chown -R www-data:www-data "${WEB_ROOT}"
  popd >/dev/null

  pushd "${APP_DIR}/backend" >/dev/null
  sudo -u "${APP_USER}" go mod download
  sudo -u "${APP_USER}" go build -o timetracker ./cmd
  chown "${APP_USER}:${APP_USER}" timetracker
  popd >/dev/null
}

install_systemd_and_nginx() {
  install -m 644 "${SCRIPT_DIR}/${APP_NAME}.service" "${SERVICE_FILE}"
  install -m 644 "${SCRIPT_DIR}/nginx.conf" "${NGINX_SITE}"
  ln -sfn "${NGINX_SITE}" "/etc/nginx/sites-enabled/${APP_NAME}"
  rm -f /etc/nginx/sites-enabled/default

  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}"
  nginx -t
  systemctl reload nginx
}

require_root
install_packages
create_user_and_dirs
configure_database
write_env_file
sync_source
build_app
install_systemd_and_nginx

cat <<EOF

Time Tracker is installed.
Open: http://$(hostname -I | awk '{print $1}')
Persistent data:
  - ${ENV_FILE}
  - PostgreSQL database: ${DB_NAME}
  - Backups: ${BACKUP_DIR}

Update later with:
  sudo bash ${APP_DIR}/deploy/proxmox-ct/update.sh
EOF
