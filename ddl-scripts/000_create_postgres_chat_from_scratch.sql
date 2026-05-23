-- Rebuild the local SECA Postgres database from scratch.
--
-- Run from the repo root with a Postgres superuser/admin connection, for example:
--   psql -U postgres -d postgres -f ddl-scripts/000_create_postgres_chat_from_scratch.sql
--
-- This script intentionally reuses the Docker init schema so the manual DDL
-- path and container bootstrap path stay in sync.

\set ON_ERROR_STOP on

\connect postgres

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'chat'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS chat;
CREATE DATABASE chat;

\connect chat

\ir ../docker/postgres/init/001-seca-init.sql
