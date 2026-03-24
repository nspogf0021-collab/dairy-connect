# Milk Ledger

## Overview

A digital dairy management SaaS platform connecting village milk producers (Sellers) with collectors (Collectors) and city distributors (Distributors). Admin role manages the overall system.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/milk-ledger)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: recharts (distributor dashboard)
- **Animations**: framer-motion

## User Roles

- **Seller** — Village milk producer. Logs daily milk (liters, fat%). Linked to a collector via invite code.
- **Collector** — Generates invite codes for sellers. Manages seller pickups, tracks payments.
- **Distributor** — City dairy buyer. Sees aggregated milk supply, quality data, weekly trends.
- **Admin** — System owner. Manages all users, views analytics.

## Authentication

- OTP-based phone login (no Firebase — simulated backend)
- OTP for testing: `123456`
- userId stored in localStorage as `milkLedgerUserId`
- Role-based routing after login

## Demo Accounts (OTP: 123456)

| Role        | Phone          | Name            |
|-------------|----------------|-----------------|
| Collector   | +919876543210  | Ramesh Kumar    |
| Distributor | +919876543211  | Dairy Fresh Ltd |
| Admin       | +919876543212  | System Admin    |
| Seller      | +919876543213  | Shyam Lal       |
| Seller      | +919876543214  | Geeta Devi      |

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (all routes)
│   └── milk-ledger/        # React + Vite frontend
│       ├── src/pages/      # login, onboarding, seller/collector/distributor/admin dashboards
│       ├── src/components/ # layout, ui-elements
│       └── src/App.tsx     # routing + auth guard
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/     # users, milkEntries, payments, inviteCodes
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## API Routes

- `POST /api/auth/login` — Login with phone + OTP
- `GET /api/auth/me?userId=xxx` — Get current user
- `POST /api/auth/onboard` — Set role during onboarding
- `GET /api/users` — List users (admin)
- `GET /api/milk-entries` — List milk entries
- `POST /api/milk-entries` — Create milk entry
- `PUT /api/milk-entries/:id` — Update/verify entry
- `GET /api/payments` — List payments
- `POST /api/payments` — Create payment
- `GET /api/invite-codes?collectorId=xxx` — List codes
- `POST /api/invite-codes` — Generate invite code
- `POST /api/invite-codes/validate` — Validate and link seller
- `GET /api/dashboard/seller/:userId` — Seller dashboard data
- `GET /api/dashboard/collector/:userId` — Collector dashboard data
- `GET /api/dashboard/distributor/:userId` — Distributor dashboard data
- `GET /api/dashboard/admin` — Admin dashboard data

## Database Tables

- `users` — id, phone, name, role, collector_id, created_at
- `milk_entries` — id, seller_id, liters, fat, snf, status, notes, timestamp
- `payments` — id, seller_id, collector_id, amount, status, created_at, paid_at
- `invite_codes` — id, code, collector_id, used_by_seller_id, is_used, created_at

## Running Locally

```bash
# Install dependencies
pnpm install

# Push DB schema
pnpm --filter @workspace/db run push

# Run API server (starts on PORT)
pnpm --filter @workspace/api-server run dev

# Run frontend (starts on PORT)
pnpm --filter @workspace/milk-ledger run dev
```

## Codegen

After modifying `lib/api-spec/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```
