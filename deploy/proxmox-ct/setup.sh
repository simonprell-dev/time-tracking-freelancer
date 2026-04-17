#!/usr/bin/env bash
set -euo pipefail

APP_NAME="time-tracker"
REPO_URL="${REPO_URL:-https://github.com/simonprell-dev/time-tracking-freelancer.git}"
BRANCH="${BRANCH:-main}"
WORK_DIR="${WORK_DIR:-/opt/${APP_NAME}-installer}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root inside a Debian/Ubuntu Proxmox CT." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates git

if [[ -d "${WORK_DIR}/.git" ]]; then
  git -C "${WORK_DIR}" fetch --depth=1 origin "${BRANCH}"
  git -C "${WORK_DIR}" checkout -f FETCH_HEAD
else
  rm -rf "${WORK_DIR}"
  git clone --depth=1 --branch "${BRANCH}" "${REPO_URL}" "${WORK_DIR}"
fi

bash "${WORK_DIR}/deploy/proxmox-ct/install.sh"

