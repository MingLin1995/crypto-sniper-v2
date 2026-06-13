---
trigger: always_on
---

# NestJS Coding Rules

## Controller & Response

- Controllers must only return `data`.
- Global response wrapping is handled by `TransformInterceptor`.

## Validation

- Global `ValidationPipe` is enabled.
- DTOs must strictly define input types.

## Authentication & Authorization

- All APIs are JWT-protected by default.
- Use `@Public()` to explicitly bypass authentication.
- Use `@Roles(Role.ADMIN)` for RBAC enforcement.

## Password Handling

- Passwords must be hashed using bcrypt (10 rounds).
- Prisma queries must omit password fields automatically.
