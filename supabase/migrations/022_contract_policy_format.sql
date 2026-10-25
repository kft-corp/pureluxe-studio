-- Trip Builder agent v2, Stage 4 (R3): versioned contract policy format.
-- Spec: docs/trip-builder-agent-redesign.md §8 R3, §14 Stage 4 item 43, Appendix A.4.
-- Depends on: 011 (property_contracts).
--
-- Additive. The CHECK is NOT VALID until ops clean up existing policies and VALIDATE.
-- Stage 5 adds the rest of 022 (room mapping, R13–R16, etc.) in a later migration file
-- or an extension of this one after clean-up.

-- =============================================================================
-- R3 — policies must declare schema_version >= 2 (enforced after clean-up)
-- =============================================================================

COMMENT ON COLUMN public.property_contracts.policies IS
  'Contract policy blob. v2+: { "schema_version": 2, stay/payment/cancellation/transfer/legal rules with audience client|team }. Legacy free-text arrays still read until clean-up.';

ALTER TABLE public.property_contracts
  DROP CONSTRAINT IF EXISTS property_contracts_policies_v2;

ALTER TABLE public.property_contracts
  ADD CONSTRAINT property_contracts_policies_v2
    CHECK (
      jsonb_typeof(policies) = 'object'
      AND (policies ? 'schema_version')
      AND (policies->>'schema_version')::int >= 2
    ) NOT VALID;

COMMENT ON CONSTRAINT property_contracts_policies_v2 ON public.property_contracts IS
  'R3: require policies.schema_version >= 2. Added NOT VALID; run VALIDATE CONSTRAINT after advisor review of existing contracts.';
