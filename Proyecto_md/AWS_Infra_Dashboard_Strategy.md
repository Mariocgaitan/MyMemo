# AWS Infra Dashboard Strategy

## Objetivo

Construir una capa de observabilidad y costos de infraestructura para MyMemo que permita ver, desde el dashboard admin, una visión profesional de:

- Costos reales de AWS
- Estado operativo de EC2 y base de datos
- Relación entre costo de IA y costo de infraestructura
- Tendencias por servicio y por período

## Principio de arquitectura

La integración con AWS no debe vivir en el dashboard de Streamlit.

La arquitectura recomendada es:

1. Backend consulta AWS
2. Backend normaliza y cachea los datos
3. Backend expone endpoints admin internos
4. Dashboard consume esos endpoints

Esto evita exponer credenciales AWS en el cliente y mantiene la lógica de negocio centralizada.

## Fase 1: Costos reales de AWS

### Fuente

- AWS Cost Explorer

### Objetivo

Obtener costos diarios y estimaciones mensuales para:

- EC2
- RDS
- S3
- Data Transfer
- Total infraestructura

### Entregable técnico

Nuevo endpoint admin, por ejemplo:

`GET /api/v1/admin/infrastructure`

Respuesta esperada:

```json
{
  "generated_at": "2026-03-12T20:10:00Z",
  "costs": {
    "daily": [
      {
        "date": "2026-03-01",
        "ec2": 1.12,
        "rds": 0.84,
        "s3": 0.09,
        "transfer": 0.03,
        "total": 2.08
      }
    ],
    "monthly_estimate": {
      "ec2": 33.6,
      "rds": 25.2,
      "s3": 2.7,
      "transfer": 0.9,
      "total": 62.4
    }
  }
}
```

### Requisitos

- IAM con permiso `ce:GetCostAndUsage`
- Recomendado: filtrar por tags de proyecto
- Cache backend de 6 a 12 horas

### Tags recomendadas

- `Project=MyMemo`
- `Environment=prod`
- `Component=backend`
- `Component=db`
- `Component=storage`
- `Owner=Mario`

Sin estas tags, el detalle será menos preciso.

## Fase 2: Salud operativa

### Fuente

- AWS CloudWatch

### Objetivo

Exponer métricas de uso y salud para infraestructura productiva.

### Métricas sugeridas

#### EC2

- CPU promedio y pico
- Network in/out
- Status checks

#### RDS

- CPU promedio
- Conexiones activas
- Espacio libre
- Memoria libre si aplica

### Requisitos

- `cloudwatch:GetMetricData`
- `cloudwatch:ListMetrics`
- `ec2:DescribeInstances`
- `rds:DescribeDBInstances`
- Cache backend de 5 a 15 minutos

## Fase 3: Dashboard profesional

### Secciones nuevas

#### Pestaña Costos AWS

- Costo diario por servicio
- Donut de composición mensual
- Tabla por servicio
- Comparación `IA vs Infraestructura`
- Total mensual estimado

#### Pestaña Infraestructura

- KPIs de CPU, conexiones y almacenamiento
- Series de tiempo 24h / 7d / 30d
- Estado general `Healthy / Warning / Critical`

## Decisiones técnicas

### Opción recomendada

Consultar AWS desde el backend.

### Opción no recomendada

Consultar AWS directo desde Streamlit.

Razones para no hacerlo:

- Riesgo de seguridad por credenciales
- Mayor acoplamiento del dashboard
- Sin cache centralizada
- Más difícil de reutilizar y testear

## Consideraciones de seguridad

- Ideal: usar IAM Role en la instancia/servicio que ejecuta el backend
- Evitar access keys hardcodeadas en el dashboard
- Limitar permisos al mínimo necesario
- Mantener los endpoints protegidos con `X-Admin-Key`

## Riesgos y limitaciones

- Cost Explorer no es tiempo real; puede tener retraso
- Sin tags, el desglose será incompleto
- CloudWatch muestra uso, no facturación
- Algunas métricas pueden requerir configuración adicional del recurso

## Próximo paso cuando retomemos este tema

1. Definir el contrato final del endpoint `/api/v1/admin/infrastructure`
2. Añadir permisos IAM necesarios
3. Implementar integración con Cost Explorer
4. Mostrar costos AWS en el dashboard
5. Implementar integración con CloudWatch
6. Añadir pestaña de infraestructura operativa

## Prioridad actual

Esta estrategia queda documentada para retomarla después.

Por ahora, el enfoque del proyecto cambia a otra tarea.