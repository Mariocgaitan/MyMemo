# Session 18: Entrenamiento de Rostros y Explorador de Galería

---

## Funcionalidad 1: "Añadir / Entrenar Rostro Manual"

### El Problema
El sistema registra personas de forma pasiva: detecta caras al subir memorias. Si dos personas se parecen o las condiciones de luz son malas, el algoritmo puede crear duplicados o fallar en identificar a alguien. No hay manera de darle una foto de referencia limpia directamente a MyMemo sin crear una memoria completa.

### Solución
Una interfaz dedicada para inyectar un *embedding* de alta calidad en el diccionario facial del usuario, sin crear ningún "recuerdo".

### Flujo de Usuario
1. En la vista `/people`, botón nuevo: **"Entrenar nuevo Rostro"**.
2. Se abre un modal de subida. El usuario sube **un retrato claro y frontal**.
3. El backend procesa la imagen con `face_recognition`:
   - 0 caras detectadas → `400 Bad Request`: *"No se detectó ninguna cara"*.
   - Más de 1 cara → `400 Bad Request`: *"Sube una foto con una sola persona"*.
   - Exactamente 1 cara → retorna el recorte thumbnail y el vector de 128d.
4. El frontend muestra el recorte de la cara detectada + un input: *"¿Quién es?"*.
5. El usuario escribe el nombre y confirma. La persona queda registrada con embeddings de alta fidelidad.

### Plan Técnico (Backend)
- **`POST /api/v1/people/train`**
  - Recibe: imagen base64.
  - Corre `face_recognition` en modo efímero (no guarda la imagen original en S3, solo el thumbnail de cara si se quiere avatar).
  - Valida exactamente 1 cara detectada.
  - Retorna: `{ thumbnail_crop: "<base64>", embedding: [...128 floats] }`.
- **`POST /api/v1/people`** (ya existente): recibe `name` + `embedding` devuelto por el paso anterior para crear el Person en BD.

### Plan Técnico (Frontend)
| Archivo | Cambio |
|---|---|
| `People.jsx` | Botón "Entrenar nuevo Rostro" en el header |
| `TrainFaceModal.jsx` (NUEVO) | Modal de subida + preview de recorte + input nombre |
| `api.js` | `peopleAPI.train(imageBase64)` → `POST /api/v1/people/train` |

---

## Funcionalidad 2: "Explorador de Galería Inteligente" *(En Diseño — Sin solución definitiva)*

### El Concepto
El usuario define parámetros: personas a buscar (ej. "Mario" y "Mau") y un período temporal (ej. "2024"). MyMemo busca en las fotos del carrete del dispositivo aquellas que cumplan ambas condiciones, de forma pseudoaleatoria, y si el usuario acepta una, la manda directamente al flujo de crear un nuevo recuerdo.

### Flujo de Usuario Definido
1. El usuario accede a la pantalla "Explorar Galería".
2. Configura los filtros: **Personas** (nombre de personas ya registradas en su BD) + **Período** (año o rango de fechas).
3. MyMemo le solicita permiso para acceder a fotos → el usuario selecciona un lote grande de su carrete (ej. 300 fotos de 2024).
4. **Paso 1 — Filtro local (EXIF, en el dispositivo, sin enviar nada al servidor):** Se leen los metadatos EXIF de cada foto y se descartan las que no están dentro del período pedido. Solo las que sí cumplen pasan al siguiente paso.
5. El array de fotos que pasan el filtro se **mezcla aleatoriamente (shuffle)** para evitar que siempre salgan los mismos resultados en corridas distintas.
6. **Paso 2 — Reconocimiento facial (backend):** Los thumbnails de las fotos mezcladas se mandan al servidor en batches de 3, procesando en paralelo. El servidor corre `face_recognition` y devuelve qué fotos contienen a las personas pedidas.
7. En cuanto se encuentran **hasta 5 matches**, el proceso se **detiene**. Las fotos restantes nunca se envían al servidor.
8. Los matches se presentan al usuario uno por uno. Para cada foto:
   - **Aceptar** → va al flujo `CreateMemory` con la foto y la fecha EXIF pre-cargadas.
   - **Ignorar** → muestra la siguiente.
   - Si ninguna convence, el usuario puede correr de nuevo con un nuevo shuffle.
9. **Solo la foto que se convierte en recuerdo se guarda en S3 y en BD.** Las demás nunca se persisten.

### Barreras y Problemas Abiertos

| Problema | Detalle |
|---|---|
| **Acceso a galería en iOS** | Safari en PWA no permite leer el carrete automáticamente. El usuario debe seleccionar las fotos manualmente. |
| **EXIF perdido** | Fotos compartidas por WhatsApp/redes sociales pierden los metadatos de fecha y ubicación. El filtro de fecha no puede aplicarse a ellas → ¿las descartamos o las mandamos todas al backend? |
| **Costo si no hay matches** | En el peor caso, se procesan ~150 thumbnails completos sin encontrar matches. Esto equivale a ~$0.01 de cómputo pero son potencialmente 3-5 minutos de espera. |
| **Privacidad de embeddings** | Los thumbnails que se mandan al servidor para reconocimiento facial: ¿se conservan en memoria o se garantiza que son eliminados inmediatamente tras la comparación? |
| **Solución definitiva** | Pendiente de revisión — no llegamos a una decisión final en esta sesión. |
