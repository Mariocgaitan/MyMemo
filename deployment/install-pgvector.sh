#!/bin/bash
# Install pgvector extension in PostgreSQL

set -e

# Install build dependencies
apt-get update
apt-get install -y --no-install-recommends \
    build-essential \
    git \
    postgresql-server-dev-$PG_MAJOR \
    ca-certificates

# Clone and install pgvector
cd /tmp
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make clean
make OPTFLAGS=""
make install

# Cleanup
cd /
rm -rf /tmp/pgvector
apt-get remove -y build-essential git postgresql-server-dev-$PG_MAJOR
apt-get autoremove -y
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "pgvector installed successfully"
