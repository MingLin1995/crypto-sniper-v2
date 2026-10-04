---
trigger: always_on
---

# Database Policies

## Prisma Usage

- NEVER use raw `delete()` for User entities.
- Always use soft-delete via `deletedAt` for User. Non-user transactional logs and job entities (such as BacktestJob, RefreshToken, WatchlistItem, etc.) are allowed to use raw `delete()`.

## Migration Policy

- Database migrations must NEVER be auto-executed by the agent.
- Migration commands must always be reviewed and executed manually by the user.

## Seed Policy

- Use `prisma/seed.ts` for initializing system data.
- Seed scripts must be idempotent when possible.
