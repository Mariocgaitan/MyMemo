FROM python:3.12-slim

# Install system dependencies for face_recognition (dlib) and AI libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./

# Install all dependencies including AI libraries
RUN uv pip install --system \
    setuptools>=70.0.0 \
    fastapi>=0.115.0 \
    uvicorn[standard]>=0.32.0 \
    sqlalchemy>=2.0.36 \
    asyncpg>=0.30.0 \
    psycopg2-binary>=2.9.10 \
    pydantic>=2.10.0 \
    pydantic-settings>=2.6.0 \
    python-multipart>=0.0.17 \
    python-jose[cryptography]>=3.3.0 \
    passlib[bcrypt]>=1.7.4 \
    python-dotenv>=1.0.1 \
    celery>=5.4.0 \
    redis>=5.2.0 \
    boto3>=1.35.0 \
    pillow>=11.0.0 \
    face-recognition>=1.3.0 \
    deepface>=0.0.93 \
    openai>=1.54.0 \
    geoalchemy2>=0.15.2 \
    shapely>=2.0.0 \
    slowapi>=0.1.9 \
    httpx>=0.28.0

# Install git and setuptools with pkg_resources for face_recognition_models
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
# Install older setuptools that includes pkg_resources
RUN pip install --no-cache-dir 'setuptools==69.5.1' wheel
RUN uv pip install --system git+https://github.com/ageitgey/face_recognition_models

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
