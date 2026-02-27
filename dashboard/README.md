# Dashboard Admin — MyMemo

Panel de administración para monitorear uso de IA y costos del sistema.

## Instalación

```bash
cd dashboard
pip install -r requirements.txt
```

## Uso

```bash
# Con backend local (default)
streamlit run app.py

# Con backend en produccion
MYMEMO_API_URL=http://tu-servidor:8000 streamlit run app.py
```

Luego abre en el navegador: `http://localhost:8501`

## Lo que muestra

| Sección | Descripción |
|---|---|
| **KPIs** | Total tokens OpenAI, costo estimado USD, faces detectadas, memorias |
| **Tokens/día** | Gráfica de barras de consumo de tokens por día |
| **Costo acumulado** | Línea del costo diario USD |
| **Faces/día** | Caras detectadas por día |
| **Tabla detallada** | Últimas 100 métricas raw |
| **Personas** | Resumen de nombradas vs desconocidas + top por apariciones |

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `MYMEMO_API_URL` | `http://localhost:8000` | URL del backend MyMemo |
