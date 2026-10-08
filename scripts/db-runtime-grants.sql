GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pousada_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pousada_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pousada_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pousada_backup;
REVOKE ALL ON TABLE _prisma_migrations FROM pousada_app;
REVOKE UPDATE, DELETE ON TABLE audit_entries FROM pousada_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE _prisma_migrations FROM pousada_backup;

-- Events are immutable except their operational resolution; retention belongs to the worker.
REVOKE UPDATE, DELETE ON notification_events FROM pousada_app;
GRANT UPDATE ("conditionKey", "resolvedAt") ON notification_events TO pousada_app;
REVOKE ALL ON notification_worker_state FROM pousada_app;
SELECT format('CREATE ROLE pousada_notifications LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'worker_password') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pousada_notifications') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO pousada_notifications', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO pousada_notifications;
GRANT SELECT ON system_settings, stock_items, pos_products, reservations, restaurant_orders, accounts_receivable, account_receivable_installments, notification_events, user_notifications, notification_worker_state TO pousada_notifications;
GRANT INSERT, DELETE ON notification_events TO pousada_notifications;
GRANT UPDATE ("conditionKey", "resolvedAt") ON notification_events TO pousada_notifications;
GRANT INSERT ON user_notifications TO pousada_notifications;
GRANT INSERT, UPDATE ON notification_worker_state TO pousada_notifications;
REVOKE ALL ON users FROM pousada_notifications;
GRANT SELECT (id, active, role, "accessProfile", "permissionOverrides") ON users TO pousada_notifications;
