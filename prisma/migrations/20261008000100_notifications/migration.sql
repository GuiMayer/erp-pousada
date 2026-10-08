CREATE TABLE "notification_events" (
"id" TEXT PRIMARY KEY, "dedupKey" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL,
"title" TEXT NOT NULL, "message" TEXT NOT NULL, "priority" TEXT NOT NULL DEFAULT 'medium',
"reference" TEXT, "module" TEXT NOT NULL, "actorId" TEXT, "requiredPermissions" TEXT[] NOT NULL,
"conditionKey" TEXT UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3));
CREATE INDEX "notification_events_createdAt_id_idx" ON "notification_events"("createdAt", "id");
CREATE TABLE "user_notifications" ("id" TEXT PRIMARY KEY, "eventId" TEXT NOT NULL REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
"userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE, "readAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), UNIQUE("eventId", "userId"));
CREATE INDEX "user_notifications_userId_archivedAt_readAt_idx" ON "user_notifications"("userId", "archivedAt", "readAt");
CREATE TABLE "notification_preferences" ("userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE, "value" JSONB NOT NULL DEFAULT '{}');
CREATE TABLE "notification_worker_state" ("id" TEXT PRIMARY KEY, "lastSuccess" TIMESTAMP(3), "lastError" TEXT);
ALTER TABLE "system_settings" ADD COLUMN "notificationRules" JSONB NOT NULL DEFAULT '{}';
