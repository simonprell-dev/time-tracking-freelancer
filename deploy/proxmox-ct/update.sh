#!/usr/bin/env bash
set -euo pipefail

APP_NAME="time-tracker"
APP_USER="timetracker"
APP_DIR="/opt/${APP_NAME}/app"
WEB_ROOT="/var/www/${APP_NAME}"
ENV_FILE="/etc/${APP_NAME}/${APP_NAME}.env"
BACKUP_DIR="/var/backups/${APP_NAME}"
DB_NAME="${DB_NAME:-timetracker}"
SERVICE_NAME="${APP_NAME}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this script as root inside the Proxmox CT." >&2
    exit 1
  fi
}

backup_database() {
  install -d -m 750 -o postgres -g postgres "${BACKUP_DIR}"
  local stamp backup_file
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup_file="${BACKUP_DIR}/${DB_NAME}-${stamp}.sql.gz"
  sudo -u postgres pg_dump "${DB_NAME}" | gzip > "${backup_file}"
  chown postgres:postgres "${backup_file}"
  chmod 640 "${backup_file}"
  echo "Database backup written to ${backup_file}"

  find "${BACKUP_DIR}" -name "${DB_NAME}-*.sql.gz" -type f -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v keep="${KEEP_BACKUPS}" 'NR > keep {print $2}' \
    | xargs -r rm -f
}

update_source() {
  cd "${APP_DIR}"
  if [[ -d .git ]]; then
    sudo -u "${APP_USER}" git pull --ff-only
  else
    echo "${APP_DIR} is not a git checkout; keeping existing source tree." >&2
    echo "Copy a new release into ${APP_DIR}, then rerun this updater." >&2
  fi
}

build_frontend() {
  cd "${APP_DIR}/client"
  sudo -u "${APP_USER}" npm ci
  sudo -u "${APP_USER}" env VITE_API_URL=/api npm run build
  rsync -a --delete dist/ "${WEB_ROOT}/"
  chown -R www-data:www-data "${WEB_ROOT}"
}

build_backend() {
  cd "${APP_DIR}/backend"
  sudo -u "${APP_USER}" go mod download
  sudo -u "${APP_USER}" go build -o timetracker ./cmd
  chown "${APP_USER}:${APP_USER}" timetracker
}

restart_services() {
  test -f "${ENV_FILE}"
  systemctl restart "${SERVICE_NAME}"
  nginx -t
  systemctl reload nginx
}

require_root
backup_database
update_source
build_frontend
build_backend
restart_services

cat <<EOF

Update complete.
Persistent files were kept in place:
  - ${ENV_FILE}
  - PostgreSQL database: ${DB_NAME}
  - Backups: ${BACKUP_DIR}
EOF

