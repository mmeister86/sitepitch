---
id: TASK-4.9
title: 'Implement credits, billing, and plan gates'
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
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
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the MVP commercial foundation for credit-based audits and paid plans. The system should make remaining credits visible, block cost-generating actions when credits are unavailable, process billing provider webhooks, and preserve usage/billing history through ledger-style events.

Use Lemon Squeezy unless the implementation owner deliberately chooses Stripe and documents the reason. Free, Starter, Pro, Agency, and extra-credit package behavior should be modeled closely enough for test-mode validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can see remaining monthly and extra credits in the dashboard or billing settings.
- [ ] #2 Audit creation is blocked when the workspace has no usable credits, with a clear upgrade or buy-credits CTA.
- [ ] #3 Starting an audit reserves or gates credits according to the PRD, invalid pre-start URLs consume no credits, and successful audits consume credits through ledger events.
- [ ] #4 Provider or job failures follow a documented credit outcome such as refund, no-consume, or failed_refunded and record the decision.
- [ ] #5 Billing webhooks update customer, subscription, payment, order, plan, and credit-package state after signature verification.
- [ ] #6 Admin or support can manually adjust credits with an auditable ledger reason.
<!-- AC:END -->
