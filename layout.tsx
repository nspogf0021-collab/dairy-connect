packages:
  "recharts": "For the weekly trend charts in distributor dashboard"
  "date-fns": "For readable date formatting across dashboards"
  "framer-motion": "For polished page transitions and micro-interactions"
  "clsx": "Utility for constructing class names conditionally"
  "tailwind-merge": "Utility to resolve Tailwind class conflicts"

images:
  - path: "artifacts/milk-ledger/public/images/login-bg.png"
    description: "Warm, inviting vector illustration of a rural Indian dairy farm at sunrise. Soft milky whites, gentle sky blues, and pastoral greens. Clean, modern, flat design style suitable for a SaaS landing page background."
    aspect_ratio: "16:9"

notes:
  - Expects @workspace/api-client-react to be built and exporting React Query hooks.
  - Using localStorage 'milkLedgerUserId' to persist session across reloads.
  - Orval generated hooks use the signature `mutate({ data: { ... } })`
