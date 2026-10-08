-- Executed by the database administrator; no credentials are printed.
SELECT format('CREATE ROLE pousada_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'migrator_password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pousada_migrator') \gexec
SELECT format('CREATE ROLE pousada_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pousada_app') \gexec
SELECT format('CREATE ROLE pousada_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'backup_password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pousada_backup') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO pousada_migrator, pousada_app, pousada_backup', current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO pousada_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO pousada_migrator;
GRANT USAGE ON SCHEMA public TO pousada_app, pousada_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE pousada_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pousada_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pousada_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pousada_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pousada_migrator IN SCHEMA public GRANT SELECT ON TABLES TO pousada_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE pousada_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO pousada_backup;
