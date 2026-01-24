-- Migration: Fix x402 DApp template defaults
-- Updates facilitatorFee to "0" and defaultPaymentAmount to "0.1"

-- Update x402 Reward Points DApp Template
UPDATE "Dapp_Template"
SET "defaultConfig" = jsonb_set(
  jsonb_set(
    "defaultConfig"::jsonb,
    '{x402Config,facilitatorFee}',
    '"0"'
  ),
  '{x402Config,defaultPaymentAmount}',
  '"0.1"'
)::json
WHERE "id" = '210401b3-0bc1-4d63-a041-7cdf0957c0ad';

-- Update x402 NFT Mint DApp Template
UPDATE "Dapp_Template"
SET "defaultConfig" = jsonb_set(
  jsonb_set(
    "defaultConfig"::jsonb,
    '{x402Config,facilitatorFee}',
    '"0"'
  ),
  '{x402Config,defaultPaymentAmount}',
  '"0.1"'
)::json
WHERE "id" = '3f4ea2c3-497a-4504-bb21-5aeafd0b9ea7';

-- Update x402 Split Payment DApp Template
UPDATE "Dapp_Template"
SET "defaultConfig" = jsonb_set(
  jsonb_set(
    "defaultConfig"::jsonb,
    '{x402Config,facilitatorFee}',
    '"0"'
  ),
  '{x402Config,defaultPaymentAmount}',
  '"0.1"'
)::json
WHERE "id" = '5ef9eac8-54ea-4214-b237-f842bb1dc094';

-- Also fix any existing User_Dapp records with wrong defaults
UPDATE "User_Dapp"
SET "uiConfig" = jsonb_set(
  jsonb_set(
    "uiConfig"::jsonb,
    '{x402Config,facilitatorFee}',
    '"0"'
  ),
  '{x402Config,defaultPaymentAmount}',
  '"0.1"'
)::json
WHERE ("uiConfig"::jsonb)->'x402Config'->>'facilitatorFee' = '100000';
