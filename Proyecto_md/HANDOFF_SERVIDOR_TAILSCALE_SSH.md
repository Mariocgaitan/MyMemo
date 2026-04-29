# Handoff Tecnico - Servidor MyMemo via Tailscale y SSH

Fecha de corte: 2026-04-14

## 1) Objetivo de este documento

Este documento resume todo el contexto operativo ya verificado en servidor para que otra IA pueda continuar soporte sin tener acceso previo al proyecto ni al historial del chat.

## 2) Contexto general

- Proyecto: MyMemo
- Repositorio local del usuario: C:/Users/mario/Repositorios/MyMemo
- Branch de trabajo funcional para bugfixes frontend/backend: fixes_mymemo_bugs
- Esa branch ya fue committeada y pusheada a origin.
- En servidor productivo, repositorio actualmente en main.

## 3) Estado de git confirmado

En entorno local:
- Branch activa usada para mejoras: fixes_mymemo_bugs
- Commit creado: cb04e7e
- Push exitoso a origin/fixes_mymemo_bugs

En servidor:
- Branch activa: main
- HEAD observado:
  - 4d25f35 chore: add dashboard/pyproject.toml for uv management
  - 1e09fc4 feat: rewrite admin dashboard with platform-wide metrics
  - 95daef4 feat: admin stats endpoint GET /api/v1/admin/stats
  - 2784a3f feat: make name required on registration
  - 9cd4c6a feat: enforce unique display names on registration

## 4) Acceso remoto (Tailscale + SSH)

Situacion inicial:
- El alias SSH mymemo fallaba porque IdentityFile apuntaba a una llave inexistente:
  - ~/.ssh/Servidor_mario.pem

Diagnostico hecho:
- Archivo de config SSH si existe en C:/Users/mario/.ssh/config
- Llave disponible y funcional detectada:
  - ~/.ssh/LightsailDefaultKey-us-east-2.pem

Correccion aplicada:
- Se actualizo Host mymemo en config para usar:
  - IdentityFile ~/.ssh/LightsailDefaultKey-us-east-2.pem
- Se probo conexion por alias con exito:
  - SSH_OK

Resultado actual:
- El usuario entra con ssh mymemo correctamente.

## 5) Estado de servicios en servidor

Compose de produccion en uso:
- Archivo real detectado por labels del contenedor:
  - /app/mymemo/docker-compose.prod.yml

Contenedores reportados:
- mymemo_backend: Up
- mymemo_celery: Up
- mymemo_db: Up (healthy)
- mymemo_redis: Up
- mymemo_certbot: Up
- mymemo_nginx: Restarting en bucle

## 6) Problema principal activo

Falla de Nginx en loop:
- Error repetido:
  - cannot load certificate "/etc/letsencrypt/live/TU_DOMINIO/fullchain.pem"
- Causa directa:
  - Config de Nginx referenciando placeholder TU_DOMINIO en ruta SSL.
  - El certificado esperado en esa ruta no existe.

Conclusiones:
- Backend y DB funcionales en general.
- Front de salida publica puede estar afectado por Nginx caido.
- El problema no es Docker general, es configuracion SSL/Nginx.

## 7) Hallazgos adicionales de logs

- Aparecen requests automáticos intentando leer rutas .env desde API:
  - /api/.env
  - /api/v1/.env
  - /api/v2/.env
- Todas responden 404, lo cual es esperado y correcto desde seguridad de app.

- Se observan en backend trazas de MissingGreenlet en SQLAlchemy en ciertos flujos.
  - Diagnostico refinado: no es la causa raiz primaria.
  - Causa raiz identificada: asyncpg.exceptions.UniqueViolationError al intentar guardar un nombre de persona duplicado.
  - Constraint involucrado: idx_unique_person_per_user.
  - Efecto visible: falla en cascada que termina mostrando sqlalchemy.exc.MissingGreenlet y 500 en PATCH /api/v1/people/{person_id}.

- En DB aparecen entradas tipo:
  - FATAL: database "lifelogs_user" does not exist
  - Esto sugiere sondas/checks/config legado apuntando a DB inexistente.
  - No necesariamente rompe el servicio principal si la app usa otra DB correcta.

## 8) Rutas y estructura importante en servidor

Directorio del proyecto en servidor:
- /app/mymemo

Archivos relevantes:
- /app/mymemo/docker-compose.prod.yml
- /app/mymemo/deployment/nginx.prod.conf
- /app/mymemo/.env (enlace simbolico a .env.prod)
- /app/mymemo/.env.prod

Nota operativa importante:
- El usuario intentaba consultar nginx.prod.conf en raiz y fallaba.
- El archivo correcto está en deployment/nginx.prod.conf.

## 9) Comandos de diagnóstico ya usados exitosamente

- docker inspect mymemo_nginx --format 'service={{ index .Config.Labels "com.docker.compose.service" }} | project={{ index .Config.Labels "com.docker.compose.project" }} | workdir={{ index .Config.Labels "com.docker.compose.project.working_dir" }} | files={{ index .Config.Labels "com.docker.compose.project.config_files" }}'
  Resultado clave: files=/app/mymemo/docker-compose.prod.yml

- docker compose -f docker-compose.prod.yml ps nginx
- docker compose -f docker-compose.prod.yml logs --tail=120 nginx
  Resultado clave: Nginx cae por ruta SSL con TU_DOMINIO.

## 10) Prioridad técnica recomendada para la siguiente IA

Prioridad 1:
- Recuperar Nginx estable corrigiendo la referencia SSL.

Camino esperado de solución:
1. Abrir deployment/nginx.prod.conf y ubicar server ssl_certificate / ssl_certificate_key.
2. Reemplazar TU_DOMINIO por dominio real si ya existe certificado emitido.
3. Si no hay certificado emitido aún:
   - usar conf temporal HTTP-only, o
   - emitir cert con certbot y luego restaurar SSL.
4. Validar config:
   - nginx -t (en contenedor o equivalente del compose)
5. Levantar/recrear servicio Nginx con docker compose prod.
6. Verificar que pase de Restarting a Up.

Prioridad 2:
- Revisar por separado:
  - manejo de nombres duplicados en PATCH de personas para evitar UniqueViolationError
  - endurecer manejo de excepciones para no propagar MissingGreenlet en cascada
  - intentos DB a lifelogs_user

## 11) Qué NO hacer sin confirmar

- No borrar volúmenes de DB.
- No resetear certificados ni carpetas letsencrypt sin backup.
- No hacer cambios de compose en archivo incorrecto (usar docker-compose.prod.yml para producción actual).

## 12) Estado de la sesión al cerrar este handoff

- Acceso SSH por alias mymemo: OK
- Tailscale: OK
- Servicios core backend/db: operativos
- Nginx: fallando por certificado con placeholder TU_DOMINIO
- Próximo paso pendiente: ajuste de configuración SSL/Nginx y estabilización del contenedor

## 13) Decision operativa (pendiente controlado)

Se acuerda dejar este incidente en pendiente por ahora porque el servidor aún no incorpora el update más reciente de main con los cambios nuevos del equipo.

Regla de seguimiento:
1. Actualizar servidor a la version objetivo de main.
2. Revalidar estado de nginx con:
  - docker compose -f docker-compose.prod.yml ps nginx
  - docker compose -f docker-compose.prod.yml logs --tail=120 nginx
3. Revalidar endpoint de personas (PATCH) con caso de nombre duplicado y confirmar que ya no escale a MissingGreenlet.
4. Solo si el error persiste, ejecutar fix segun hallazgo:
  - nginx/certificados (secciones 6 y 10)
  - personas/constraint unico (seccion 7)

Estado actual del ticket:
- Abierto, prioridad media, bloqueante solo para salida web via nginx.

## 14) Viabilidad de entorno staging (validacion tecnica)

Resumen corto:
- Si es viable montar staging en el mismo servidor, pero conviene hacerlo ligero y solo por red Tailscale.

Condiciones observadas en codigo/config que la otra IA debe considerar:
1. El compose de produccion actual usa `docker-compose.prod.yml` y nombres de contenedor fijos (`container_name`).
2. `deployment/nginx.prod.conf` viene con placeholder `TU_DOMINIO` hardcodeado.
3. El servicio `certbot` solo renueva; no emite certificado inicial automaticamente.
4. El healthcheck de DB en prod usa `pg_isready -U ${DB_USER}` sin `-d ${DB_NAME}` (genera ruido de logs).
5. `ALLOWED_ORIGINS` se arma con `https://${DOMAIN}`, por lo que staging sin HTTPS requiere override explicito.

Recomendacion para staging en este servidor:
1. Crear `docker-compose.staging.yml` dedicado, sin reciclar `docker-compose.prod.yml` tal cual.
2. Evitar `container_name` en staging (o usar sufijo `_staging`) para impedir colisiones.
3. Publicar solo por Tailscale, por ejemplo `100.67.125.25:8080:80`.
4. En staging, iniciar sin SSL/certbot (HTTP interno por Tailscale) para reducir complejidad.
5. Separar volumentes de datos (`postgres_data_staging`) si se requiere aislamiento real.
6. Para ahorrar RAM, levantar staging con perfil minimo (backend + db + redis + frontend/nginx) y dejar celery opcional.

Riesgos operativos (misma maquina):
1. RAM total ~2GB: dos stacks completos (prod + staging) pueden presionar memoria bajo carga.
2. Si staging clona DB completa, crece consumo de disco y I/O.
3. Un error de puertos o nombres puede impactar prod si no hay aislamiento estricto.

Checklist minimo previo a crear staging:
1. Definir si staging usara DB clonada o datos de prueba reducidos.
2. Definir dominio/no-dominio (para este caso, recomendado sin dominio: solo Tailscale:8080).
3. Definir perfiles de servicios para limitar consumo.
4. Ajustar healthcheck DB con `-d` para quitar ruido en logs.

Conclusión:
- La estrategia propuesta por la otra IA es correcta en direccion general.
- Ajuste recomendado: staging "tailnet-only" sin SSL/certbot al inicio y con stack minimo para no comprometer estabilidad del servidor productivo.
