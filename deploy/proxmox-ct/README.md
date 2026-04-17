# Proxmox CT deployment

This deploys the app into a Debian/Ubuntu Proxmox container with:

- Nginx serving the built React frontend on port 80
- Nginx proxying `/api` to the Go backend on `127.0.0.1:8080`
- PostgreSQL running locally in the CT
- persistent configuration in `/etc/time-tracker/time-tracker.env`
- persistent database storage managed by PostgreSQL
- database backups in `/var/backups/time-tracker`

## Recommended CT

- Debian 12 or Ubuntu 22.04/24.04 template
- 1 vCPU minimum, 2 vCPU nicer for builds
- 1 GB RAM minimum, 2 GB recommended
- 8 GB disk minimum
- nesting is not required

## One-command install

Inside a fresh Debian/Ubuntu CT, run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/simonprell-dev/time-tracking-freelancer/main/deploy/proxmox-ct/setup.sh)"
```

Advanced options:

```bash
REPO_URL=https://github.com/your-user/time-tracking-freelancer.git BRANCH=main bash -c "$(curl -fsSL https://raw.githubusercontent.com/simonprell-dev/time-tracking-freelancer/main/deploy/proxmox-ct/setup.sh)"
```

The script clones the app, installs packages, creates the database, builds the app, configures Nginx/systemd, and prints the URL.

## Manual install

Inside a fresh CT:

```bash
apt-get update
apt-get install -y git
git clone <your-repo-url> /root/time-tracker
cd /root/time-tracker
sudo bash deploy/proxmox-ct/install.sh
```

Open the IP address printed by the installer.

The installer copies the current checkout to `/opt/time-tracker/app`, builds the frontend and backend, creates the local PostgreSQL database, and installs systemd/Nginx units.

## Persistent data

These locations are intentionally kept outside rebuildable app code:

- `/etc/time-tracker/time-tracker.env`
- PostgreSQL data, usually under `/var/lib/postgresql`
- `/var/backups/time-tracker`

Do not store custom data under `/opt/time-tracker/app` or `/var/www/time-tracker`; updates can replace those directories.

## Updates

Run:

```bash
sudo bash /opt/time-tracker/app/deploy/proxmox-ct/update.sh
```

The updater:

1. creates a compressed PostgreSQL backup
2. runs `git pull --ff-only` if `/opt/time-tracker/app` is a git checkout
3. rebuilds the React frontend with `VITE_API_URL=/api`
4. rebuilds the Go backend
5. restarts the backend and reloads Nginx

It keeps `/etc/time-tracker/time-tracker.env` and the PostgreSQL database in place.

By default it keeps the newest 10 database backups. Override that for one run:

```bash
sudo env KEEP_BACKUPS=30 bash /opt/time-tracker/app/deploy/proxmox-ct/update.sh
```

## Useful commands

```bash
systemctl status time-tracker
journalctl -u time-tracker -f
systemctl status nginx
sudo -u postgres psql timetracker
```

## Restore a backup

Stop the app first:

```bash
sudo systemctl stop time-tracker
gunzip -c /var/backups/time-tracker/timetracker-YYYYMMDD-HHMMSS.sql.gz | sudo -u postgres psql timetracker
sudo systemctl start time-tracker
```
