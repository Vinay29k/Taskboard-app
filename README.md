# TaskBoard

A small Kanban-style task board (To Do → In Progress → Done), built as the
sample application for a hands-on DevOps learning path.

**Stack:** Node.js 22, Express 5, vanilla JS frontend, and PostgreSQL (optional).

## Project layout

```
taskboard-app/
├── public/                # Frontend (HTML/CSS/JS, served by Express)
├── src/
│   ├── server.js          # Entry point: starts HTTP server, graceful shutdown
│   ├── app.js             # Express app (routes, middleware)
│   ├── config.js          # All config from environment variables
│   ├── logger.js          # JSON logs to stdout
│   ├── metrics.js         # Prometheus metrics
│   ├── routes/            # health + tasks API
│   └── store/             # memory store and PostgreSQL store
├── tests/                 # Jest + Supertest API tests
├── .env.example
└── eslint.config.js
```

## Configuration

| Variable              | Default       | Description                                          |
|-----------------------|---------------|------------------------------------------------------|
| `PORT`                | `3000`        | HTTP port                                            |
| `HOST`                | `0.0.0.0`     | Bind address                                         |
| `NODE_ENV`            | `development` | Environment name (shown in the UI footer)            |
| `LOG_LEVEL`           | `info`        | `debug`, `info`, `warn`, `error`, `silent`           |
| `DATABASE_URL`        | *(empty)*     | PostgreSQL URL. Empty = in-memory store              |
| `APP_VERSION`         | from package  | Version string shown in `/api/info`                  |
| `SHUTDOWN_TIMEOUT_MS` | `10000`       | Max time for graceful shutdown                       |

## Endpoints

| Method | Path              | Purpose                                     |
|--------|-------------------|---------------------------------------------|
| GET    | `/`               | Web UI                                      |
| GET    | `/api/tasks`      | List tasks (optional `?status=todo`)        |
| POST   | `/api/tasks`      | Create `{title, description?, priority?, status?}` |
| GET    | `/api/tasks/:id`  | Get one task                                |
| PATCH  | `/api/tasks/:id`  | Update any of title/description/status/priority |
| DELETE | `/api/tasks/:id`  | Delete a task                               |
| GET    | `/api/info`       | Version, environment, hostname, storage     |
| GET    | `/healthz`        | Liveness probe                              |
| GET    | `/readyz`         | Readiness probe (checks the database)       |
| GET    | `/metrics`        | Prometheus metrics                          |

`status` ∈ `todo | in_progress | done`, `priority` ∈ `low | medium | high`.

## Scripts

```bash
npm install          # install dependencies
npm run dev          # run with auto-reload, loads .env if present
npm start            # run for production
npm test             # run tests
npm run lint         # lint
```
