---
id: TASK-4.9
title: 'Implement credits, billing, and plan gates'
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-11 19:29'
labels:
  - mvp
  - billing
  - credits
dependencies:
  - TASK-4.3
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the MVP commercial foundation for credit-based audits and paid plans. The system should make remaining credits visible, block cost-generating actions when credits are unavailable, process billing provider webhooks, and preserve usage/billing history through ledger-style events.

Use Lemon Squeezy unless the implementation owner deliberately chooses Stripe and documents the reason. Free, Starter, Pro, Agency, and extra-credit package behavior should be modeled closely enough for test-mode validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can see remaining monthly and extra credits in the dashboard or billing settings.
- [x] #2 Audit creation is blocked when the workspace has no usable credits, with a clear upgrade or buy-credits CTA.
- [x] #3 Starting an audit reserves or gates credits according to the PRD, invalid pre-start URLs consume no credits, and successful audits consume credits through ledger events.
- [x] #4 Provider or job failures follow a documented credit outcome such as refund, no-consume, or failed_refunded and record the decision.
- [x] #5 Billing webhooks update customer, subscription, payment, order, plan, and credit-package state after signature verification.
- [x] #6 Admin or support can manually adjust credits with an auditable ledger reason.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Finalize credit and subscription schema
2. Implement idempotent credit lifecycle and Lemon Squeezy webhooks
3. Add checkout, portal, billing UI, and audit gates
4. Add automated tests and run verification
5. Await user confirmation before marking Done
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started 2026-07-11. Product decisions: no ongoing free plan; one-time 3-credit trial; Starter 25, Pro 100, Agency 300 monthly credits; 25-credit extra pack; Lemon Squeezy checkout and portal; past-due/cancelled credits remain usable until period end.

Implementation completed for automated verification. Added one-time 3-credit trial, idempotent reserve/consume/refund lifecycle, monthly/extra balance breakdown, Lemon Squeezy checkout and portal, signed webhook processing with event/order deduplication, 25/100/300 monthly grants, 25-credit packs, test/live separation, admin adjustment consistency, and zero-credit UI gates. Verification: 257 Vitest tests pass, schema contract passes, TypeScript passes, production build passes outside sandbox. Awaiting user manual confirmation; task intentionally remains In Progress.

Checkout redirect issue fixed after manual test: SITE_URL was missing from the Convex dev deployment, so Lemon Squeezy received no product_options.redirect_url and fell back to my-orders. Set SITE_URL=https://trysitepitch.com, hardened checkout creation to require it, added checkout success return URL, and redeployed Convex functions. Existing checkout URLs remain unchanged; retest with a newly generated checkout.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped and manually verified the commercial MVP foundation: one-time trial credits, paid Starter/Pro/Agency plans, separate monthly and extra-credit balances, idempotent audit reserve/consume/refund ledger flow, zero-credit gates and CTAs, Lemon Squeezy checkout/customer portal, signed and deduplicated billing webhooks, plan-period grants, credit packs, support adjustments, and post-checkout redirect. Automated tests, schema contracts, typecheck, and production build passed; local test checkout and redirect were confirmed by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
