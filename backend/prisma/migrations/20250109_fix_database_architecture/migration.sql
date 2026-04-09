-- =====================================================
-- Database Architecture Fixes Migration
-- Addresses: Indexes, Data Integrity, Constraints, Schema Consistency
-- =====================================================

-- =====================================================
-- 1. ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for common transaction queries by user + date
CREATE INDEX IF NOT EXISTS "idx_transactions_user_date" ON "Transaction"("userId", "date" DESC);

-- Index for soft-delete filtering (common pattern across all tables)
CREATE INDEX IF NOT EXISTS "idx_accounts_deleted_at" ON "Account"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_transactions_deleted_at" ON "Transaction"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_goals_deleted_at" ON "Goal"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_loans_deleted_at" ON "Loan"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_investments_deleted_at" ON "Investment"("deletedAt") WHERE "deletedAt" IS NULL;

-- Missing foreign key indexes for performance
CREATE INDEX IF NOT EXISTS "idx_loan_payments_user_id" ON "LoanPayment"("loanId"); -- Already exists but verify

-- Index for notification filtering
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "Notification"("userId", "isRead") WHERE "isRead" = false;

-- =====================================================
-- 2. SECURITY: REMOVE PLAIN TEXT PIN
-- =====================================================

-- Remove plain text pin_code from profiles table
-- The hashed PIN is already in UserPin table
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "pin_code";

-- Add comment warning about attachment storage
COMMENT ON COLUMN "Transaction"."attachment" IS 'Store internal storage path only - never expose direct file URL';
COMMENT ON COLUMN "ExpenseBill"."storagePath" IS 'Internal storage path - generate signed URLs for access';

-- =====================================================
-- 3. DATA INTEGRITY: ADD CHECK CONSTRAINTS
-- =====================================================

-- Financial amounts must be positive
ALTER TABLE "Transaction" ADD CONSTRAINT "chk_transaction_amount_positive" 
  CHECK ("amount" > 0);

ALTER TABLE "Investment" ADD CONSTRAINT "chk_investment_quantity_positive" 
  CHECK ("quantity" > 0);

ALTER TABLE "Investment" ADD CONSTRAINT "chk_investment_prices_positive" 
  CHECK ("buyPrice" >= 0 AND "currentPrice" >= 0);

ALTER TABLE "Loan" ADD CONSTRAINT "chk_loan_principal_positive" 
  CHECK ("principalAmount" > 0);

ALTER TABLE "LoanPayment" ADD CONSTRAINT "chk_loan_payment_positive" 
  CHECK ("amount" > 0);

ALTER TABLE "Payment" ADD CONSTRAINT "chk_payment_amount_positive" 
  CHECK ("amount" > 0);

ALTER TABLE "Goal" ADD CONSTRAINT "chk_goal_amounts_positive" 
  CHECK ("targetAmount" > 0 AND "currentAmount" >= 0);

ALTER TABLE "GoalContribution" ADD CONSTRAINT "chk_goal_contribution_positive" 
  CHECK ("amount" > 0);

-- AI confidence must be between 0 and 1
ALTER TABLE "AiScan" ADD CONSTRAINT "chk_aiscan_confidence_range" 
  CHECK ("confidence" >= 0.0 AND "confidence" <= 1.0);

-- Booking amount must be positive
ALTER TABLE "BookingRequest" ADD CONSTRAINT "chk_booking_amount_positive" 
  CHECK ("amount" > 0);

-- =====================================================
-- 4. ADD MISSING deleted_at COLUMNS FOR SOFT DELETE CONSISTENCY
-- =====================================================

-- Add deleted_at to tables missing it
ALTER TABLE "LoanPayment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Create indexes for soft delete filtering on new columns
CREATE INDEX IF NOT EXISTS "idx_loan_payments_deleted_at" ON "LoanPayment"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_notifications_deleted_at" ON "Notification"("deletedAt") WHERE "deletedAt" IS NULL;

-- =====================================================
-- 5. DATA MIGRATION: REMOVE DERIVED COLUMN VALUES
-- =====================================================

-- Note: The balance, profitLoss, outstandingBalance columns will remain
-- for caching but should be computed via triggers or application logic.
-- These triggers ensure data consistency:

-- Function to recalculate account balance from transactions
CREATE OR REPLACE FUNCTION recalculate_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate balance from all non-deleted transactions for this account
  UPDATE "Account" 
  SET "balance" = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN "type" = 'income' THEN "amount"
        WHEN "type" = 'expense' THEN -"amount"
        WHEN "type" = 'transfer' AND "transferToAccountId" IS NULL THEN -"amount"
        ELSE 0
      END
    ), 0)
    FROM "Transaction"
    WHERE "accountId" = NEW."accountId" 
    AND "deletedAt" IS NULL
  )
  WHERE "id" = NEW."accountId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update balance on transaction changes
DROP TRIGGER IF EXISTS trg_update_account_balance ON "Transaction";
CREATE TRIGGER trg_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_account_balance();

-- Function to recalculate loan outstanding balance
CREATE OR REPLACE FUNCTION recalculate_loan_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Loan"
  SET "outstandingBalance" = "principalAmount" - (
    SELECT COALESCE(SUM("amount"), 0)
    FROM "LoanPayment"
    WHERE "loanId" = NEW."loanId"
    AND "deletedAt" IS NULL
  )
  WHERE "id" = NEW."loanId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update loan balance on payment changes
DROP TRIGGER IF EXISTS trg_update_loan_balance ON "LoanPayment";
CREATE TRIGGER trg_update_loan_balance
  AFTER INSERT OR UPDATE OR DELETE ON "LoanPayment"
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_loan_balance();

-- Function to recalculate investment values
CREATE OR REPLACE FUNCTION recalculate_investment_values()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Investment"
  SET 
    "currentValue" = "quantity" * "currentPrice",
    "totalInvested" = "quantity" * "buyPrice",
    "profitLoss" = ("quantity" * "currentPrice") - ("quantity" * "buyPrice")
  WHERE "id" = NEW."id";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update investment values on price changes
DROP TRIGGER IF EXISTS trg_update_investment_values ON "Investment";
CREATE TRIGGER trg_update_investment_values
  AFTER INSERT OR UPDATE OF "quantity", "buyPrice", "currentPrice" ON "Investment"
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_investment_values();

-- =====================================================
-- 6. NORMALIZE SETTINGS: Remove duplicate columns from profiles
-- =====================================================

-- Remove duplicate settings columns from profiles
-- UserSettings table is the single source of truth
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "language";

-- =====================================================
-- 7. GROUP EXPENSES REFACTOR PREP
-- =====================================================

-- Create junction table for group expense members (proper relational design)
CREATE TABLE IF NOT EXISTS "GroupExpenseMember" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "groupExpenseId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "shareAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hasPaid" BOOLEAN NOT NULL DEFAULT false,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  
  CONSTRAINT "GroupExpenseMember_groupExpenseId_fkey" 
    FOREIGN KEY ("groupExpenseId") REFERENCES "group_expenses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_group_expense_members_group_id" ON "GroupExpenseMember"("groupExpenseId");
CREATE INDEX IF NOT EXISTS "idx_group_expense_members_user_id" ON "GroupExpenseMember"("userId");
CREATE INDEX IF NOT EXISTS "idx_group_expense_members_deleted" ON "GroupExpenseMember"("deletedAt") WHERE "deletedAt" IS NULL;

-- Note: Migration of existing JSON members data to relational table requires application-level script

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

COMMENT ON TABLE "Transaction" IS 'Financial transactions with CHECK constraints ensuring positive amounts';
COMMENT ON TABLE "Investment" IS 'Investment positions with computed value fields maintained by triggers';
COMMENT ON TABLE "Loan" IS 'Loan records with outstanding balance computed from payments';
COMMENT ON TABLE "Account" IS 'Financial accounts with balance computed from transactions';
