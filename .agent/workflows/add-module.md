---
description: Adding a New Module
---

# Workflow: Adding a New Module

## Steps

1. Confirm module responsibility and boundaries.
2. Generate the module using Nest CLI:

```bash
docker compose -f docker-compose.dev.yml exec app nest g resource <module-name>
```

3. Review generated files and remove unused boilerplate.
4. Apply existing guards, interceptors, and validation rules.
5. Verify RBAC and logging integration.
