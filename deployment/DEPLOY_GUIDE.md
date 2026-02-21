# Guía de Despliegue en Producción — MyMemo

> Resultado final: `https://mymemo.duckdns.org` accesible desde iPhone con GPS funcionando.

---

## Requisitos previos

- Cuenta en [DigitalOcean](https://digitalocean.com) o [Linode](https://linode.com)
- Cuenta gratuita en [DuckDNS](https://www.duckdns.org)
- Tu código en GitHub (o puedes subirlo directamente)
- Tus credenciales de AWS y OpenAI a mano

---

## PASO 1 — Crear el VPS

### En DigitalOcean (Droplet):
1. Crear > Droplet
2. **SO**: Ubuntu 22.04 (LTS)
3. **Plan**: Regular — **2 GB RAM / 1 CPU** (~$12/mes) ← mínimo por face_recognition
4. **Región**: la más cercana a ti (New York, Amsterdam, etc.)
5. **Autenticación**: sube tu clave SSH (más seguro que contraseña)
6. Clic en "Create Droplet"
7. Copia la **IP pública** del droplet (ej: `143.198.45.22`)

---

## PASO 2 — Configurar subdominio gratuito en DuckDNS

1. Ve a [duckdns.org](https://www.duckdns.org) → inicia sesión con Google/GitHub
2. Crea un subdominio: escribe `mymemo` → clic en "add domain"
3. En el campo IP, pega la IP de tu VPS → clic en "update ip"
4. Anota:
   - **Tu subdominio**: `mymemo.duckdns.org` (o el que elegiste)
   - **Tu token**: aparece en la parte superior de la página

---

## PASO 3 — Instalar Docker en el VPS

```bash
# Conectarte al VPS
ssh root@TU_IP_DEL_VPS

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose plugin
apt-get install -y docker-compose-plugin

# Verificar
docker --version
docker compose version
```

---

## PASO 4 — Subir el código al VPS

**Opción A — Si tienes el repo en GitHub:**
```bash
# En el VPS
apt-get install -y git
git clone https://github.com/TU_USUARIO/MyMemo.git /app/mymemo
cd /app/mymemo
```

**Opción B — Copiar desde tu computadora:**
```bash
# En tu computadora local (PowerShell/terminal)
scp -r C:\Users\mario\Repositorios\MyMemo root@TU_IP:/app/mymemo
```

---

## PASO 5 — Configurar las variables de entorno

```bash
# En el VPS, dentro de /app/mymemo
cp deployment/.env.prod.example .env.prod
nano .env.prod
```

Completa todos los valores:
```env
DOMAIN=mymemo.duckdns.org     # ← tu subdominio exacto
EMAIL=tu@email.com             # ← para Let's Encrypt
DB_PASSWORD=una_password_segura_aqui
SECRET_KEY=                    # genera con: python3 -c "import secrets; print(secrets.token_hex(32))"
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_IMAGES=mymemo-images-prod-2026
S3_BUCKET_THUMBNAILS=mymemo-thumbnails-prod-2026
OPENAI_API_KEY=sk-...
```

Guarda con `Ctrl+O`, cierra con `Ctrl+X`.

---

## PASO 6 — Editar la configuración de nginx con tu dominio

```bash
# Reemplaza TU_DOMINIO con tu subdominio real en nginx.prod.conf
sed -i 's/TU_DOMINIO/mymemo.duckdns.org/g' deployment/nginx.prod.conf
```

---

## PASO 7 — Desplegar

```bash
# Dale permisos de ejecución al script
chmod +x deployment/deploy.sh

# ¡Desplegar!
bash deployment/deploy.sh
```

El script hace automáticamente:
1. `git pull` (si aplica)
2. `npm run build` del frontend
3. Obtiene el certificado SSL con Let's Encrypt
4. Levanta todos los contenedores Docker
5. Inicializa la base de datos

**Primera ejecución tarda ~5-10 minutos** (descarga imágenes Docker, compila face_recognition).

---

## PASO 8 — Configurar renovación automática del IP en DuckDNS

DuckDNS necesita saber si tu IP del VPS cambia (raro pero posible):

```bash
# Crea el script de actualización
mkdir -p /opt/duckdns
cat > /opt/duckdns/duck.sh << 'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=mymemo&token=TU_TOKEN_DUCKDNS&ip=" | curl -k -o /opt/duckdns/duck.log -K -
EOF

# Reemplaza TU_TOKEN con tu token DuckDNS real:
nano /opt/duckdns/duck.sh

chmod +x /opt/duckdns/duck.sh

# Agregar cron cada 5 minutos
crontab -e
# Agrega esta línea:
# */5 * * * * /opt/duckdns/duck.sh >/dev/null 2>&1
```

---

## Verificación final

Después del despliegue deberías poder:

- [ ] Abrir `https://mymemo.duckdns.org` en tu iPhone → carga la app
- [ ] El navegador muestra 🔒 (candado verde) → HTTPS activo
- [ ] Al crear un recuerdo, el iPhone te pide permiso de ubicación → GPS funcionando
- [ ] Subir una foto con tu cara → detecta la cara correctamente
- [ ] Agregar a pantalla de inicio en iPhone → funciona como app nativa (PWA)

---

## Comandos útiles (en el VPS)

```bash
# Ver todos los logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver solo el backend
docker compose -f docker-compose.prod.yml logs -f backend

# Ver solo el worker de Celery (reconocimiento facial)
docker compose -f docker-compose.prod.yml logs -f celery_worker

# Reiniciar un servicio
docker compose -f docker-compose.prod.yml restart backend

# Detener todo
docker compose -f docker-compose.prod.yml down

# Actualizar a nueva versión del código
bash deployment/deploy.sh
```

---

## Solución de problemas

### "SSL_ERROR_RX_RECORD_TOO_LONG" en el navegador
El certificado aún no se generó. Espera 2 minutos y recarga.

### "502 Bad Gateway"
El backend aún está iniciando (face_recognition tarda en cargar). Espera 1-2 minutos.

### La cámara/GPS no funciona en iPhone
Verifica que la URL sea `https://` no `http://`. Sin HTTPS, Safari bloquea cámara y GPS.

### Error de memoria (OOM) con face_recognition
El VPS necesita al menos 2 GB RAM. Con 1 GB fallará al procesar caras. Considera hacer upgrade del droplet.

---

## Costos estimados

| Servicio | Costo |
|---|---|
| DigitalOcean 2GB RAM | ~$12/mes |
| DuckDNS subdominio | **Gratis** |
| Let's Encrypt SSL | **Gratis** |
| AWS S3 (primeros 5GB) | ~$0-2/mes |
| OpenAI API | ~$1-5/mes según uso |
| **Total** | **~$13-19/mes** |
