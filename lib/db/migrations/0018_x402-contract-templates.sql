-- Migration: Add x402 contract template support
-- Adds multi-file template support and bundle tracking for x402 settlement contracts

-- Add new columns to Contract_Template table for multi-file support
ALTER TABLE "Contract_Template" ADD COLUMN IF NOT EXISTS "sourceFiles" jsonb;
ALTER TABLE "Contract_Template" ADD COLUMN IF NOT EXISTS "deploymentConfig" jsonb;

-- Add new columns to User_Contract table for bundle tracking
ALTER TABLE "User_Contract" ADD COLUMN IF NOT EXISTS "bundleId" uuid;
ALTER TABLE "User_Contract" ADD COLUMN IF NOT EXISTS "bundleRole" varchar(64);

-- Create index for efficient bundle queries
CREATE INDEX IF NOT EXISTS "idx_user_contract_bundle_id" ON "User_Contract" ("bundleId");
