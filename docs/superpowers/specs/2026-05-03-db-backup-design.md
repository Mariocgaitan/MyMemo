# DB Backup System — Design Spec

**Date:** 2026-05-03
**Status:** Approved
**Scope:** Production DB only (`mymemo_db`)

---

## Requirements

| Requirement | Value |
|---|---|
| RPO (max data loss) | 24 hours |
| RTO (max restore time) | 30 minutes |
| Retention | 7 days |
| Alerting | Email on failure (Gmail) |
| Storage | S3 `mymemo-backups-prod` |

---

## Architecture

```
Servidor (2am diario)
└── cron → deployment/backup.sh
    ├── docker exec mymemo_db pg_dump → /tmp/mymemo_YYYY-MM-DD.sql.gz
    ├── aws s3 cp → s3://mymemo-backups-prod/daily/YYYY-MM-DD.sql.gz
    ├── limpieza local /tmp
    ├── borrar S3 objects > 7 días
    └── cualquier fallo → email alaniker1234567@gmail.com

Restore
└── deployment/restore.sh [YYYY-MM-DD | latest]
    ├── descarga backup de S3
    ├── confirmación interactiva
    ├── detiene mymemo_backend + mymemo_celery
    ├── dropdb + createdb dentro de mymemo_db
    ├── restaura dump
    ├── reinicia servicios
    └── verifica salud: pg_isready + curl /health
```

---

## Archivos Nuevos

| Archivo | Propósito |
|---|---|
| `deployment/backup.sh` | Script backup diario + notificación email |
| `deployment/restore.sh` | Script restore desde S3 |

Cron **no** va en el repo — se instala manualmente en el servidor una vez.

---

## backup.sh — Flujo Detallado

1. Cargar variables desde `/app/mymemo/.env.prod`
2. Generar nombre: `mymemo_$(date +%F).sql.gz`
3. `docker exec mymemo_db pg_dump -U $DB_USER $DB_NAME | gzip > /tmp/$FILENAME`
4. `aws s3 cp /tmp/$FILENAME s3://mymemo-backups-prod/daily/`
5. `rm /tmp/$FILENAME`
6. Listar objetos S3, borrar los más viejos que 7 días
7. Si cualquier paso falla (`set -e`): enviar email via curl + Gmail SMTP

### Email de alerta

Usa `curl` contra `smtps://smtp.gmail.com:465` con `GMAIL_APP_PASSWORD` (App Password de Google, no contraseña real). Variable nueva en `.env.prod`.

---

## restore.sh — Flujo Detallado

1. Argumento: `YYYY-MM-DD` o `latest` (auto-detecta más reciente en S3)
2. Descargar a `/tmp/mymemo_restore.sql.gz`
3. Mostrar fecha del backup y pedir confirmación explícita (`yes/no`)
4. `docker stop mymemo_backend mymemo_celery`
5. `docker exec mymemo_db dropdb -U $DB_USER $DB_NAME`
6. `docker exec mymemo_db createdb -U $DB_USER $DB_NAME`
7. `gunzip -c /tmp/mymemo_restore.sql.gz | docker exec -i mymemo_db psql -U $DB_USER $DB_NAME`
8. `docker start mymemo_backend mymemo_celery`
9. Verificar: `docker exec mymemo_db pg_isready` + `curl http://localhost:8000/health`
10. Limpiar `/tmp/mymemo_restore.sql.gz`

---

## Retención S3

**Estructura:**
```
mymemo-backups-prod/
└── daily/
    ├── 2026-05-03.sql.gz
    ├── 2026-05-02.sql.gz
    └── ... (7 días)
```

**Limpieza por script:** lista objetos S3, ordena por nombre (fecha), borra todos excepto los últimos 7.

**S3 Lifecycle rule (red de seguridad):** regla AWS que expira objetos en `daily/` con más de 10 días — protege si el script falla en limpiar.

---

## Cron (instalar manualmente en servidor)

```cron
0 2 * * * /app/mymemo/deployment/backup.sh >> /var/log/mymemo-backup.log 2>&1
```

---

## Variables Nuevas en .env.prod

| Variable | Descripción |
|---|---|
| `GMAIL_APP_PASSWORD` | App Password de Google (no la contraseña real) |

---

## Fuera de Scope

- Backup de staging
- WAL streaming / point-in-time recovery
- Lightsail disk snapshots
- Backup de S3 images (ya manejado por AWS durability)
