ALTER TABLE "operation_approvals" ADD COLUMN "resourceHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "operation_approvals" ALTER COLUMN "resourceHash" DROP DEFAULT;
