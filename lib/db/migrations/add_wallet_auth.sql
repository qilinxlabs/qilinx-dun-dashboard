-- Add wallet authentication columns to User table
-- This migration adds support for Solana wallet authentication

-- Add walletAddress column (nullable for backward compatibility)
ALTER TABLE "User" ADD COLUMN "walletAddress" VARCHAR(44);

-- Add nonce column for signature verification
ALTER TABLE "User" ADD COLUMN "nonce" VARCHAR(64);

-- Make email nullable (for wallet-only users)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Add unique constraint on walletAddress
ALTER TABLE "User" ADD CONSTRAINT "User_walletAddress_unique" UNIQUE("walletAddress");

-- Create index on walletAddress for faster lookups
CREATE INDEX IF NOT EXISTS "User_walletAddress_idx" ON "User"("walletAddress");
