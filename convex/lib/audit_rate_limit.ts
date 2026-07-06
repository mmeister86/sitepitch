import { HOUR, RateLimiter } from "@convex-dev/rate-limiter"

import { components } from "../_generated/api"

export const auditRateLimiter = new RateLimiter(components.rateLimiter, {
  auditStarts: {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },
})
