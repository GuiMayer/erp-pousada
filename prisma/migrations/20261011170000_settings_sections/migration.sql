-- One-time migration. New explicit overrides always win over legacy grants.
DO $$
DECLARE entry RECORD; overrides JSONB; category TEXT; action TEXT; legacy TEXT;
BEGIN
  FOR entry IN SELECT id, "permissionOverrides", "accessProfile", role FROM users LOOP
    overrides := COALESCE(entry."permissionOverrides", '{}'::jsonb);
    legacy := overrides->>'systemSettings.edit';
    IF legacy IN ('allow', 'deny') THEN
      FOREACH category IN ARRAY ARRAY['business','lodging','commercial','alerts'] LOOP
        IF NOT overrides ? ('settings.' || category || '.edit') THEN
          overrides := overrides || jsonb_build_object('settings.' || category || '.edit', legacy);
        END IF;
        IF legacy = 'allow' AND NOT overrides ? ('settings.' || category || '.read') THEN
          overrides := overrides || jsonb_build_object('settings.' || category || '.read', 'allow');
        END IF;
      END LOOP;
    END IF;
    IF NOT overrides ? 'settings.access' AND (legacy = 'allow' OR overrides->>'users.manage' = 'allow' OR overrides->>'data.import' = 'allow') THEN
      overrides := overrides || '{"settings.access":"allow"}'::jsonb;
    END IF;
    overrides := overrides - 'systemSettings.edit' - 'systemSettings.create' - 'systemSettings.delete';
    UPDATE users SET "permissionOverrides" = overrides, "accessVersion" = "accessVersion" + 1, "recordVersion" = "recordVersion" + 1 WHERE id = entry.id;
  END LOOP;
END $$;
