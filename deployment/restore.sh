#!/bin/bash
# deployment/restore.sh
# Usage: ./restore.sh [YYYY-MM-DD | latest]
set -euo pipefail

[[ -f /app/mymemo/.env.prod ]] || { echo "FATAL: /app/mymemo/.env.prod missing"; exit 1; }

set -a
source /app/mymemo/.env.prod
set +a

BUCKET="mymemo-backups-prod"
S3_PREFIX="daily"
TMP_FILE="/tmp/mymemo_restore.sql.gz"
AWS_REGION="${AWS_REGION:-us-east-2}"

# Cleanup temp file on any exit; restart containers if they were stopped
_SERVICES_STOPPED=0
cleanup() {
    rm -f "${TMP_FILE}"
    if [[ "${_SERVICES_STOPPED}" -eq 1 ]]; then
        echo "[$(date +%FT%T)] Restarting services after failure..."
        docker start mymemo_backend mymemo_celery || true
    fi
}
trap cleanup EXIT

# ── Resolve which backup ──────────────────────────────────────
if [ -z "${1:-}" ] || [ "$1" = "latest" ]; then
    BACKUP_FILE=$(aws s3 ls "s3://${BUCKET}/${S3_PREFIX}/" \
        | awk '{print $4}' \
        | grep -v '^$' \
        | sort \
        | tail -n 1)
    if [ -z "${BACKUP_FILE}" ]; then
        echo "ERROR: No backups found in s3://${BUCKET}/${S3_PREFIX}/"
        exit 1
    fi
else
    BACKUP_FILE="mymemo_${1}.sql.gz"
fi

# ── Confirmation ──────────────────────────────────────────────
echo "========================================"
echo "  MyMemo Database Restore"
echo "========================================"
echo "  Backup : ${BACKUP_FILE}"
echo "  Target : ${DB_NAME} @ mymemo_db"
echo "========================================"
echo ""
echo "WARNING: This will DESTROY all current data in ${DB_NAME}."
echo ""
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# ── Download ──────────────────────────────────────────────────
echo "[$(date +%FT%T)] Downloading s3://${BUCKET}/${S3_PREFIX}/${BACKUP_FILE}..."
aws s3 cp "s3://${BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" "${TMP_FILE}" \
    --region "${AWS_REGION}"

# ── Stop services ─────────────────────────────────────────────
echo "[$(date +%FT%T)] Stopping backend services..."
docker stop mymemo_backend mymemo_celery
_SERVICES_STOPPED=1

# ── Drop & recreate DB ────────────────────────────────────────
echo "[$(date +%FT%T)] Verifying backup integrity..."
gunzip -t "${TMP_FILE}" || { echo "ERROR: Backup file is corrupt"; exit 1; }
echo "[$(date +%FT%T)] Dropping database..."
docker exec mymemo_db dropdb -U "${DB_USER}" "${DB_NAME}"
echo "[$(date +%FT%T)] Creating database..."
docker exec mymemo_db createdb -U "${DB_USER}" "${DB_NAME}"

# ── Restore ───────────────────────────────────────────────────
echo "[$(date +%FT%T)] Restoring from ${BACKUP_FILE}..."
gunzip -c "${TMP_FILE}" | docker exec -i mymemo_db psql -U "${DB_USER}" "${DB_NAME}" -q

# ── Restart ───────────────────────────────────────────────────
echo "[$(date +%FT%T)] Restarting services..."
docker start mymemo_backend mymemo_celery
_SERVICES_STOPPED=0

# ── Health check ──────────────────────────────────────────────
echo "[$(date +%FT%T)] Verifying..."
sleep 5
_HEALTH_OK=1
docker exec mymemo_db pg_isready -U "${DB_USER}" \
    && echo "  DB : OK" || { echo "  DB : FAIL"; _HEALTH_OK=0; }
curl -sf http://localhost:8000/health > /dev/null \
    && echo "  API: OK" || { echo "  API: FAIL"; _HEALTH_OK=0; }
[[ "${_HEALTH_OK}" -eq 1 ]] || { echo "WARNING: Health checks failed after restore"; exit 1; }

echo "[$(date +%FT%T)] Restore complete from ${BACKUP_FILE}."
