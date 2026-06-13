---
description: Prisma Schema Migration
---

# Workflow: Prisma Schema Migration

Use this workflow when modifying `prisma/schema.prisma`.

## Steps

1. Modify `schema.prisma`.
2. Propose the migration command to the user:

```bash
docker compose -f docker-compose.dev.yml exec app bunx prisma migrate dev --name <migration_name>
```

3. Wait for explicit approval.
4. If Prisma Client is out of sync, run:

```bash
docker compose -f docker-compose.dev.yml exec app bunx prisma generate
```

5. Verify application behavior after migration.

## Notes

- NEVER execute migration automatically.
- Always explain the purpose of the migration.
