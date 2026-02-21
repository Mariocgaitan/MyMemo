# AWS Lambda Handlers

**⚠️ IMPORTANTE: Estos handlers NO se usan en el deployment actual de Lightsail.**

Estos archivos están preparados para una futura migración a serverless (AWS Lambda).

## Estructura

```
lambda/
├── face_handler.py       # Lambda para face recognition
├── nlp_handler.py        # Lambda para NLP extraction
└── README.md            # Este archivo
```

## Uso Actual (Lightsail)

El proyecto actualmente usa:
- **Celery workers** para tareas asíncronas
- **Redis** para cola de mensajes
- **Docker Compose** para orquestación

Los Celery tasks están en `backend/tasks/` y son thin wrappers que llaman a `backend/services/`.

## Migración Futura a Lambda

Cuando decidas migrar a serverless, sigue estos pasos:

### 1. Preparar Deployment Package

```bash
# Crear layer con dependencias
cd backend
pip install -t python/lib/python3.12/site-packages/ \
    sqlalchemy psycopg2-binary openai face-recognition

zip -r lambda-layer.zip python/
```

### 2. Deploy Lambda Functions

```bash
# Subir layer
aws lambda publish-layer-version \
    --layer-name lifelog-dependencies \
    --zip-file fileb://lambda-layer.zip \
    --compatible-runtimes python3.12

# Deploy face recognition function
cd lambda
zip face-handler.zip face_handler.py
aws lambda create-function \
    --function-name lifelog-face-recognition \
    --runtime python3.12 \
    --handler face_handler.lambda_handler \
    --zip-file fileb://face-handler.zip \
    --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
    --timeout 30 \
    --memory-size 2048 \
    --environment Variables={DATABASE_URL=postgresql://...}

# Deploy NLP function
zip nlp-handler.zip nlp_handler.py
aws lambda create-function \
    --function-name lifelog-nlp-extraction \
    --runtime python3.12 \
    --handler nlp_handler.lambda_handler \
    --zip-file fileb://nlp-handler.zip \
    --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
    --timeout 15 \
    --memory-size 512 \
    --environment Variables={DATABASE_URL=postgresql://...,OPENAI_API_KEY=sk-...}
```

### 3. Configurar Triggers

Opción A: **EventBridge** (eventos síncronos)
```bash
aws events put-rule \
    --name lifelog-process-memory \
    --event-pattern '{"source":["lifelog.api"],"detail-type":["MemoryCreated"]}'

aws events put-targets \
    --rule lifelog-process-memory \
    --targets Id=1,Arn=arn:aws:lambda:...:function:lifelog-face-recognition
```

Opción B: **SQS** (cola con retries)
```bash
# Crear cola
aws sqs create-queue --queue-name lifelog-tasks

# Configurar Lambda trigger
aws lambda create-event-source-mapping \
    --function-name lifelog-face-recognition \
    --event-source-arn arn:aws:sqs:...:lifelog-tasks \
    --batch-size 1
```

### 4. Actualizar API para Enviar Eventos

En `backend/api/v1/endpoints/memories.py`:

```python
# Reemplazar:
from tasks.face_recognition import process_face_recognition
process_face_recognition.delay(str(new_memory.id))

# Por:
import boto3
lambda_client = boto3.client('lambda')
lambda_client.invoke(
    FunctionName='lifelog-face-recognition',
    InvocationType='Event',  # Async
    Payload=json.dumps({'memory_id': str(new_memory.id)})
)
```

### 5. Testing

```bash
# Test local
python lambda/face_handler.py

# Test remoto
aws lambda invoke \
    --function-name lifelog-face-recognition \
    --payload '{"memory_id":"your-uuid"}' \
    response.json

cat response.json
```

## Ventajas de Lambda

- ✅ **Costo**: Solo pagas por ejecución (~$0.30/mes para 20 memorias)
- ✅ **Escalabilidad**: Auto-scaling automático
- ✅ **Mantenimiento**: Sin servidores que mantener
- ✅ **Confiabilidad**: AWS maneja retries y dead-letter queues

## Desventajas de Lambda

- ❌ **Cold starts**: ~2-5 seg primera invocación
- ❌ **Timeouts**: Máximo 15 minutos
- ❌ **Complejidad**: Setup más complejo que Docker
- ❌ **Debugging**: Logs en CloudWatch, no en terminal

## Comparación de Costos

| Opción | Costo/mes (20 memorias) | Setup | Mantenimiento |
|--------|-------------------------|-------|---------------|
| **Lightsail** | $5 | 30 min | Bajo |
| **Lambda** | $0.30 | 4-6 hrs | Muy bajo |

## Recomendación

- **< 100 memorias/mes**: Quedarse en Lightsail (simple, funciona)
- **> 500 memorias/mes**: Considerar Lambda (escala mejor)
- **Aprendizaje**: Experimentar con Lambda en branch separado

---

**Última actualización**: Febrero 19, 2026
**Status**: Preparado pero no deployado
