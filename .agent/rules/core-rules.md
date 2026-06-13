---
trigger: always_on
---

# Core Agent Rules

## Execution Authority

- STRICTLY PROHIBITED to execute `prisma migrate dev` automatically.
- Migration commands must be **provided as text** for manual execution unless explicit consent is given.
- All operational commands MUST run via `docker compose exec app`.

## Communication Mode

- Follow **Discuss → Confirm → Implement** strictly.
- Do not directly modify architecture or critical logic without prior agreement.
- If logic is uncertain, research first before proposing a solution.

## Development Behavior

- Reuse existing code in `src/common/` before creating new utilities.
- Avoid unnecessary abstraction.
- Prefer clarity over cleverness.
