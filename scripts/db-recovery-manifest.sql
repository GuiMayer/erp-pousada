-- Fingerprints compare restored documents without printing personal data.
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;
CREATE TEMP TABLE recovery_manifest (table_name text, rows bigint, fingerprint text);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
  EXECUTE format('INSERT INTO recovery_manifest SELECT %L, count(*), md5(coalesce(string_agg(to_jsonb(r)::text, E''\n'' ORDER BY to_jsonb(r)::text), '''')) FROM public.%I r', t.tablename, t.tablename);
 END LOOP;
END $$;
SELECT table_name,rows,fingerprint FROM recovery_manifest ORDER BY table_name;
COMMIT;
