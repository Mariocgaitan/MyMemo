#!/bin/bash
# deployment/backup.sh
set -euo pipefail

[[ -f /app/mymemo/.env.prod ]] || { echo "FATAL: /app/mymemo/.env.prod missing"; exit 1; }

# ── Config ────────────────────────────────────────────────────
set -a
source /app/mymemo/.env.prod
set +a

BUCKET="mymemo-backups-prod"
DATE=$(date +%F)
FILENAME="mymemo_${DATE}.sql.gz"
TMP_FILE="/tmp/${FILENAME}"
S3_PREFIX="daily"
RETENTION_DAYS=7
AWS_REGION="${AWS_REGION:-us-east-2}"

# ── Email on failure ──────────────────────────────────────────
send_failure_email() {
    local error_msg="$1"
    cat > /tmp/mymemo_backup_fail.txt << EOF
From: MyMemo Backup <alaniker1234567@gmail.com>
To: alaniker1234567@gmail.com
Subject: BACKUP FAILED - mymemo_db - ${DATE}

Backup failed on ${DATE} at $(date +%T).

Error: ${error_msg}
Server: mymemo-production-2 (16.58.56.110)
EOF
    curl --silent --ssl-reqd \
        --url "smtps://smtp.gmail.com:465" \
        --user "alaniker1234567@gmail.com:${GMAIL_APP_PASSWORD}" \
        --mail-from "alaniker1234567@gmail.com" \
        --mail-rcpt "alaniker1234567@gmail.com" \
        --upload-file /tmp/mymemo_backup_fail.txt || true
    rm -f /tmp/mymemo_backup_fail.txt
}

trap 'send_failure_email "Script failed at line $LINENO. Check /var/log/mymemo-backup.log"; rm -f "${TMP_FILE}"' ERR

# ── 1. pg_dump ────────────────────────────────────────────────
echo "[$(date +%FT%T)] Starting backup: ${FILENAME}"
docker exec mymemo_db pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${TMP_FILE}"
echo "[$(date +%FT%T)] Dump complete: $(du -sh "${TMP_FILE}" | cut -f1)"
[[ $(stat -c%s "${TMP_FILE}") -gt 100 ]] || { echo "ERROR: Dump file suspiciously small ($(stat -c%s "${TMP_FILE}") bytes)"; exit 1; }

# ── 2. Upload to S3 ───────────────────────────────────────────
aws s3 cp "${TMP_FILE}" "s3://${BUCKET}/${S3_PREFIX}/${FILENAME}" \
    --region "${AWS_REGION}"
echo "[$(date +%FT%T)] Uploaded: s3://${BUCKET}/${S3_PREFIX}/${FILENAME}"

# ── 3. Clean local tmp ────────────────────────────────────────
rm -f "${TMP_FILE}"

# ── 4. Prune S3 — keep last RETENTION_DAYS ───────────────────
while read -r obj; do
    aws s3 rm "s3://${BUCKET}/${S3_PREFIX}/${obj}" \
        --region "${AWS_REGION}" || exit 1
    echo "[$(date +%FT%T)] Pruned: ${obj}"
done < <(aws s3 ls "s3://${BUCKET}/${S3_PREFIX}/" \
    | awk '{print $4}' \
    | grep -v '^$' \
    | sort \
    | head -n -${RETENTION_DAYS})

echo "[$(date +%FT%T)] Backup complete."
