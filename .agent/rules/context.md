---
trigger: always_on
---

# Project Context

This project is **CryptoSniper v2**, an enterprise-grade cryptocurrency trading and alerting platform built as a Bun-based monorepo.

## Tech Stack

- Runtime: Bun 1.x
- Monorepo Orchestration: Turborepo
- Backend Framework: NestJS 11.x (TypeScript 5.x)
- Frontend Framework: Next.js 14.x (App Router)
- Database: PostgreSQL 16
- ORM: Prisma 7.x (v7.2.0)
- Cache & Queue: Redis 7.x + BullMQ
- Authentication: Passport + JWT
- Containerization: Docker + Docker Compose

## Project Structure

```
crypto-sniper-v2/
├── apps/
│   ├── api/                       # NestJS Backend API
│   │   ├── src/
│   │   │   ├── main.ts            # API Entry point
│   │   │   ├── app.module.ts      # Root module
│   │   │   ├── auth/              # Authentication logic (JWT strategies, guards)
│   │   │   ├── users/             # User management (CRUD, soft delete)
│   │   │   ├── market/            # Market data ingestion & screener engine
│   │   │   ├── alerts/            # Price alerts matching & multi-channel push
│   │   │   └── backtest/          # Quantitative backtest engine & BullMQ queue
│   │   └── prisma/
│   │       ├── schema.prisma      # Database schema
│   │       └── seed.ts            # Database seeder
│   └── web/                       # Next.js Frontend App Router
│       └── src/
│           └── app/               # Pages: /screener, /backtest, /alerts, /watchlist, /profile
├── packages/
│   └── shared/                    # Shared TypeScript models and DTO validations
├── docs/                          # Comprehensive architectural and operational documentation
├── .env.example                   # Environment variable template
├── docker-compose.dev.yml         # Dev containers (db, redis, app/api, web)
├── docker-compose.prod.yml        # Prod containers configuration
└── package.json                   # Root workspace scripts and dependencies
```
