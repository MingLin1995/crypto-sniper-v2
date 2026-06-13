---
trigger: always_on
---

# Architecture Rules

## Design Principles

- Follow SOLID principles.
- Prefer composition over inheritance.
- Maintain clear separation of concerns.
- For complex business logic, recommend **Clean Architecture** or **DDD** patterns.
- **Flexibility**: Do not be rigid; suggest the most appropriate design pattern based on the project context.

## Logging System

- Use dual-channel logging:
  - Console: ERROR / WARN
  - Database: Auditing
- LoggingInterceptor must capture:
  - CUD operations
  - Slow requests (>1s)
  - Exceptions

## Authentication Flow

- **Guard Order**: `JwtAuthGuard` → `RolesGuard` → `Controller`.

## Request Lifecycle Awareness

Middleware → Guard → Interceptor (before) → Pipe → Controller → Service → Interceptor (after) → Filter
