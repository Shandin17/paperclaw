#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER paperless WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE paperless OWNER paperless;

    CREATE USER gestor WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE gestor OWNER gestor;
EOSQL
