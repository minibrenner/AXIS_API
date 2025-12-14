-- AlterEnum
BEGIN;
CREATE TYPE "PrintJobType_new" AS ENUM ('SALE_RECEIPT', 'CASH_CLOSING', 'ORDER_TICKET', 'TEST_PRINT');
ALTER TABLE "PrintJob" ALTER COLUMN "type" TYPE "PrintJobType_new" USING (
  CASE
    WHEN "type"::text IN ('KITCHEN_ORDER','BAR_ORDER') THEN 'ORDER_TICKET'
    ELSE "type"::text
  END::"PrintJobType_new"
);
DROP TYPE "PrintJobType";
ALTER TYPE "PrintJobType_new" RENAME TO "PrintJobType";
COMMIT;
