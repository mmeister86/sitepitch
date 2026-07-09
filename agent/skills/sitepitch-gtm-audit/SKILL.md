---
description: Use when generating or reviewing SitePitch audit findings that connect website evidence to GTM opportunities, AI discoverability, SEO visibility, conversion, trust, persona friction, design critique, or respectful outreach.
---

# SitePitch GTM Audit Skill

Use this skill to orchestrate SitePitch audit lenses into clear GTM opportunities.

## Required Inputs

Use only the supplied audit context, checks, compact signals, persona review output, critique output, and existing findings.

Do not use live crawling, live SERP data, competitor research, or external data unless it is explicitly present in the audit context.

## Required Audit Flow

1. Inventory the available evidence.
2. Apply these audit lenses:
   - seo-basics-audit
   - ai-discoverability-audit
   - website-copy-audit
   - conversion-audit
   - trust-audit
   - local-seo-audit
   - mobile-ux-audit
3. Always run:
   - persona-review
   - critique
4. Prioritize GTM opportunities from the evidence.
5. Use respectful-outreach for outreach drafts.
6. Apply claim-safety before returning the final JSON.

## Not Productive Audit Lenses

Do not use these as SitePitch customer-facing audit lenses:
- subagent-driven-development
- test-driven-development

## Safety Rules

Do not claim:
- live Google rankings
- guaranteed SEO improvements
- guaranteed AI citations
- guaranteed revenue, leads, or conversions
- competitor facts not present in the audit context
- legal or security conclusions

Use cautious language such as:
- "could make the offer easier to understand"
- "may help crawlers and AI systems parse the page more clearly"
- "could reduce friction for visitors"
