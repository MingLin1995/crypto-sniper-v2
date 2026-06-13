---
description: Starting the Development Environment
---

# Workflow: Starting the Development Environment

## Command

```bash
bun run dev
```

## Logic

- This command executes the `dev.sh` script.
- The script cleans old Docker containers and starts the `app` service in build mode (`--build`).
- The application source code is mounted as a Docker Volume, so hot-reloading is enabled automatically inside the container.

## Agent Note

This command runs continuously to provide hot-reloading. If you need to execute further commands in the CLI, you should run it in the background:

```bash
bun run dev &
```
