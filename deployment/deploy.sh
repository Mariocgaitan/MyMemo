#!/bin/bash
# ============================================================
# deploy.sh — Script de despliegue para MyMemo
# Uso: bash deployment/deploy.sh
# ============================================================
set -e

# Carga variables del archivo .env.prod
if [ ! -f ".env.prod" ]; then
  echo "❌ Falta el archivo .env.prod"
  echo "   Copia deployment/.env.prod.example como .env.prod y completa los valores"
  exit 1
fi
export $(grep -v '^#' .env.prod | xargs)

echo "🚀 Desplegando MyMemo en: https://${DOMAIN}"
echo "============================================"

# ── 1. Código actualizado ─────────────────────────────────────
echo ""
echo "📥 [1/5] Obteniendo código más reciente..."
git pull origin main

# ── 2. Build del frontend ─────────────────────────────────────
echo ""
echo "🏗️  [2/5] Compilando frontend React..."
cd frontend
npm ci --silent
npm run build
cd ..
echo "   ✅ dist/ generado"

# ── 3. Obtener certificado SSL (solo la primera vez) ──────────
CERT_PATH="/var/lib/docker/volumes/mymemo_certbot_certs/_data/live/${DOMAIN}/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  echo ""
  echo "🔒 [3/5] Obteniendo certificado SSL para ${DOMAIN}..."

  # Levanta nginx en HTTP para el challenge
  docker compose -f docker-compose.prod.yml up -d nginx

  sleep 5

  # Solicita el certificado con webroot challenge
  docker run --rm \
    -v mymemo_certbot_certs:/etc/letsencrypt \
    -v mymemo_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "${DOMAIN}"

  echo "   ✅ Certificado SSL obtenido"
else
  echo ""
  echo "🔒 [3/5] Certificado SSL: ya existe, se renueva automáticamente"
fi

# ── 4. Levantar todos los servicios ──────────────────────────
echo ""
echo "🐳 [4/5] Levantando servicios..."
docker compose -f docker-compose.prod.yml up -d --build

# ── 5. Inicializar base de datos (si es primera vez) ─────────
echo ""
echo "🗄️  [5/5] Verificando base de datos..."
sleep 5
docker exec mymemo_backend python init_db.py || echo "   (ya inicializada)"

echo ""
echo "============================================"
echo "✅ ¡Despliegue completado!"
echo "   🌐 https://${DOMAIN}"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:       docker compose -f docker-compose.prod.yml logs -f"
echo "  Ver backend:    docker compose -f docker-compose.prod.yml logs -f backend"
echo "  Reiniciar:      docker compose -f docker-compose.prod.yml restart"
echo "  Detener:        docker compose -f docker-compose.prod.yml down"
