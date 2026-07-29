# ORB-369 — AI Usage Warning Accuracy

**Status:** Approved and accepted by Stan on 2026-07-29; implemented and
verified as v0.6.255; ORB-369 closed; release approved.

## Verified cause

At the instant the incorrect bulletin was written, the July ledger contained:

- Operational: $14.588019 against a $16 reserve.
- Strategic: $0.607646 against a $24 reserve.
- Voice: $25.211577 with a $0 reserve.
- Monthly total: $40.407242 against a $40 total.

`checkOrbBudget()` intentionally changes `spentUsd` and `limitUsd` to the
monthly figures after the monthly hard gate is reached. The proactive monitor
incorrectly treated those blocking-scope values as role values, dividing the
same $40.407242 total by both role reserves. That produced the false 253%
operational and 168% strategic bulletin.

## Implementation

1. Add an explicit `roleSpentUsd` field to `OrbBudgetCheck`; preserve the
   existing `spentUsd`/`limitUsd` blocking-scope contract.
2. Use `roleSpentUsd` for role warning scopes.
3. Add one explicit monthly-total warning scope using `totalSpentUsd` and
   `totalLimitUsd`.
4. Distinguish “approaching” below 100% from “exceeded” at or above 100% in
   tickets, email, push, and broadcast copy.
5. Restore the cataloged `.input` treatment to every numeric field in
   Settings → AI Settings. This removes native number spinners and restores
   consistent field sizing without introducing a new UI pattern.
6. Remove the false July strategic-warning record and clear the incorrect
   automatic bulletin; verify both database mutations.

## Platform and verification

- The UI change uses the existing `s-page` / `s-card` / `s-form` / `input`
  Settings family. Verify Mac, iPad, and iPhone field sizing.
- Run TypeScript, focused ESLint, UI catalog verification, and a deterministic
  calculation check using the production totals above.
- This is not an Orb-conversation capability change, so no eval case applies.

## Impact decisions

- **Database:** no schema, new query pattern, index, Realtime subscription, or
  high-frequency write. Two one-time corrective data mutations.
- **Performance:** no new request, initialization, or interactive path. The
  existing 15-minute background check does the same work, so no new
  instrumentation is required.
- **UI catalog:** no catalog update; the fix restores an existing documented
  Settings field pattern.
