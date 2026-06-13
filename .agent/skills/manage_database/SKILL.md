---
name: manage_database
description: Manage the application database (migrate, seed, reset) using Prisma.
workflow: prisma-migration
---

# Database Management Skill

This skill allows you to manage the PostgreSQL database for the NestJS application using Prisma.

## Capabilities

1.  **Migrate Database**: Apply schema changes to the database.
2.  **Generate Client**: Regenerate the Prisma Client after schema changes.
3.  **Seed Database**: Populate the database with initial data (e.g., admin account).
4.  **Reset Database**: Wipes all data and re-applies migrations/seeds (Use with EXTREME CAUTION).

## Instructions

### 1. Migrate Database (`prisma:migrate`)

Use this when you have modified `prisma/schema.prisma` and need to update the database schema.

```bash
# Standard dev migration
docker compose -f docker-compose.dev.yml exec app bunx prisma migrate dev
```

If you need to name the migration:

```bash
docker compose -f docker-compose.dev.yml exec app bunx prisma migrate dev --name <migration_name>
```

### 2. Generate Client (`prisma:generate`)

Use this if the Prisma Client definitions are out of sync with the schema.

```bash
docker compose -f docker-compose.dev.yml exec app bunx prisma generate
```

### 3. Seed Database (`prisma:seed`)

Use this to populate default data (like the default internal staff admin).

```bash
docker compose -f docker-compose.dev.yml exec app bun run prisma:seed
```

### 4. Reset Database (`prisma:reset`)

**WARNING**: This will DELETE ALL DATA.

```bash
docker compose -f docker-compose.dev.yml exec app bunx prisma migrate reset --force
```

## Important Notes

- **Environment**: Ensure the dev environment is running (`bun run dev`) before running these commands.
- **Container Execution**: These commands **MUST** be run through `docker compose exec app`.
- **Migration Policy**: **DO NOT** execute `prisma migrate` commands automatically. Provide the command text to the user for manual execution unless they explicitly ask the agent to run it.
- **Hot Reload**: The application will automatically reload after `prisma generate` or `prisma migrate`.
