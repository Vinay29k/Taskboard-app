# TaskBoard

A small Kanban-style task board (To Do → In Progress → Done), built as the
sample application for a hands-on DevOps learning path.

**Stack:** Node.js 22, Express 5, vanilla JS frontend, and PostgreSQL (optional).

## Project layout

```
taskboard-app/
├── public/                # Frontend (HTML/CSS/JS, served by Express or nginx)
├── src/
│   ├── server.js          # Entry point: starts HTTP server, graceful shutdown
│   ├── app.js             # Express app (routes, middleware)
│   ├── config.js          # All config from environment variables
│   ├── logger.js          # JSON logs to stdout
│   ├── metrics.js         # Prometheus metrics
│   ├── routes/            # health + tasks API
│   └── store/             # memory store and PostgreSQL store
├── tests/                 # Jest + Supertest API tests
├── deploy/
│   ├── linux/             # nginx + systemd for a bare Linux host
│   └── docker/            # nginx config used by docker compose
├── Dockerfile             # App image (non-root, with HEALTHCHECK)
├── docker-compose.yml     # nginx + app + PostgreSQL stack
├── .dockerignore
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
| `POSTGRES_USER`       | *(none)*      | Compose only: DB user, also used to build `DATABASE_URL` |
| `POSTGRES_PASSWORD`   | *(none)*      | Compose only: DB password. Keep it in `.env`, never commit it |

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

## Run with Docker

### Full stack (nginx + app + PostgreSQL)

```bash
cp .env.example .env        # then set POSTGRES_USER and POSTGRES_PASSWORD
docker compose up -d --build
docker compose ps           # wait until app and db show (healthy)
```

Open http://localhost:8080.

| Service | Image              | Published port | Networks          |
|---------|--------------------|----------------|-------------------|
| nginx   | nginx:1.27-alpine  | `8080 → 80`    | frontend          |
| app     | built from repo    | none           | frontend, backend |
| db      | postgres:16-alpine | none           | backend           |

nginx is the only way in. It serves `public/` directly and proxies `/api/`,
`/healthz` and `/readyz` to the app. `/metrics` is blocked from outside.
The database is only reachable from the app.

```bash
docker compose logs -f app nginx    # follow logs
docker compose down                 # stop; data is kept in the pgdata volume
docker compose down -v              # stop AND delete all data
```

### Image only (in-memory store)

```bash
docker build -t taskboard-app .
docker run --rm -p 3001:3000 taskboard-app
```

The image runs as the non-root `node` user and has a `HEALTHCHECK` on `/healthz`.

## Run on a Linux host

For a bare Linux host (systemd + nginx), see [`deploy/linux/`](deploy/linux/).
