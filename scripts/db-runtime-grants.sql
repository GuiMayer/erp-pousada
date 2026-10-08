GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pousada_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pousada_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pousada_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pousada_backup;
REVOKE ALL ON TABLE _prisma_migrations FROM pousada_app;
REVOKE UPDATE, DELETE ON TABLE audit_entries FROM pousada_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE _prisma_migrations FROM pousada_backup;
