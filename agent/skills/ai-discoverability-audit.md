---
description: Use when auditing AI discoverability, GEO readiness, LLM-readable website structure, llms.txt, robots.txt, sitemap, schema, and content clarity from supplied SitePitch audit evidence.
---

# AI Discoverability Audit Skill

Evaluate whether supplied audit evidence suggests that search crawlers and AI systems may be able to understand the website clearly.

## Scope

Use only supplied SitePitch audit evidence.

Relevant signals:
- title
- meta description
- H1/H2
- service clarity
- sitemap
- robots.txt
- schema types
- structured content
- contact and business information
- copy clarity
- llms.txt, if present

## Rules

Do not claim that ChatGPT, Claude, Perplexity, Google AI Overviews, or any other AI system will cite the website.

Do not claim live visibility in AI search.

Use cautious language:
- "AI systems and search crawlers may parse the offer more easily when..."
- "This could make the page easier to understand for crawlers and AI systems..."
- "Clearer structure may improve machine readability..."

## Category Guidance

Use:
- `seo` for search visibility and metadata issues
- `technical` for crawlability, robots, sitemap, schema, or structured data issues
- `conversion` when the issue is mainly offer clarity or visitor understanding

llms.txt is optional. Do not treat a missing llms.txt file as a required failure.
