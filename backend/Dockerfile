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

# Copy dependency manifest
COPY pyproject.toml ./

# Install all dependencies declared in pyproject.toml
# face_recognition requires setuptools with pkg_resources, and the model package from git
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir 'setuptools==69.5.1' wheel
RUN uv pip install --system -e . --no-build-isolation
RUN uv pip install --system git+https://github.com/ageitgey/face_recognition_models

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
