# Nydus API — Frontend Contract

This is the HTTP contract for the Nydus backend. Everything the dashboard does is one of
these requests. Shapes below are exact (taken from the handlers). If a field isn't listed,
don't assume it exists.

---

## Base URL & auth

- Base path: `<host>/api/...`.
- The backend exposes two interfaces: an **internal** one (no auth — intended for server-to-server
  calls on a private network) and a **public** one (auth required). The public interface enforces
  auth on every `/api/*` request via the header **`X-Auth-Key: <key>`**:
  - Missing key → `401 {"error":"Missing X-Auth-Key"}`.
  - Invalid/expired key → `403 {"error":"<reason>"}`.
  - Practical rule: **send `X-Auth-Key` on every `/api/*` request.** It's required on the public
    interface and harmless on the internal one, so always sending it is correct.
- `/webhook/*` is NOT under `/api/`; it's called by GitHub (HMAC-signed), never by the dashboard.
- CORS is open (`Access-Control-Allow-Origin: *`, allowed header `X-Auth-Key`).

## Conventions

- All request and response bodies are JSON. JSON keys are `snake_case`.
- **Errors** always look like `{"error": "<message>"}` with a non-2xx HTTP status. Check the
  HTTP status first, then read `.error`.
- Long-running actions (deploy, rebuild) return `202 {"run_id": "..."}` immediately and you
  watch progress over a separate SSE log stream (see **SSE** below).
- Timestamps are ISO-8601 strings (or `null`).

## ⚠️ Changes in this release — handle these or the UI breaks

1. **Rebuild returns `run_id`, not `run_uuid`.** `POST /api/deploy/rebuild/{deployment_uuid}`
   responds `202 {"run_id":"..."}`. (Deploy already returns `run_id`.) Read `run_id` for both.
   If you read `run_uuid` the rebuild log stream silently never connects.
2. **New deployment `status` value: `"unhealthy"`.** A deployment can now be
   `pending | active | failed | unhealthy`. `unhealthy` = the site is live but its health
   check isn't returning HTTP 200. Render it (suggest amber) — don't treat unknown status as a
   crash. `deleted` is NOT a status; deleted/failed deployments are removed from the list.
3. **Deploy/rebuild log stream now sends clean sentinels** (see SSE §A). A successful run ends
   with `data: [done]`; quiet periods send `data: [keepalive]`. Previously the stream just
   dropped and showed a false "connection lost" error — that's fixed; treat `[done]` as success.
4. **`POST /api/databases/users` accepts an optional `allowed_hosts`** field (see that endpoint).
5. **New `POST /api/selftest`** runs the deployment pipeline end-to-end against throwaway
   fixtures and streams over the **existing** deploy-logs SSE (§A) — reuse that same client/proxy,
   no new stream format. See **Self-test** below.

---

## SSE (log streaming) — there are THREE different frame formats

All SSE endpoints respond with `Content-Type: text/event-stream` and emit `data: ...\n\n`
lines. **The body format differs by endpoint** — this matters:

**A. Deploy/rebuild logs** — `GET /api/deploy/logs/{run_uuid}`
- Normal line: `data: {"line":"[NGINX] Config written..."}` (JSON, read `.line`).
- `data: [keepalive]` — ignore (heartbeat during quiet build steps).
- `data: [done]` — stream finished successfully; close the connection.

**B. Control-plane & maintenance logs** — `GET /api/deployments/{uuid}/logs/{kind}`,
`GET /api/services/{uuid}/logs`, `GET /api/maintenance/logs/{service}`
- Each line is **raw text**: `data: <log line as-is>` (NOT JSON — don't `JSON.parse`).
- The `build` kind (deployment logs) replays stored text and ends with `data: [done]`.
- The live kinds (`app`, `nginx-access`, `nginx-error`, maintenance) stream until you disconnect.

**C. Maintenance restart progress** — `GET /api/maintenance/restart/{service}`
- Each line is JSON: `data: {"status":"progress|success|error","message":"...","done":true|false}`.
- Stop when you receive an object with `"done": true`.

> Note: `EventSource` cannot send an `X-Auth-Key` header. If your client needs auth on SSE,
> proxy these through your own server (which can add the header) rather than hitting them
> directly from the browser.

---

## Deployments

### `GET /api/deployments`
List all deployments. → `200` array of **Deployment** objects.

**Deployment object:**
```json
{
  "deployment_uuid": "uuid", "project_uuid": "uuid", "subdomain": "myapp",
  "tech_stack": "node|laravel|static", "assigned_port": 3133,
  "deploy_path": "/var/www/myapp", "env_file_name": ".env",
  "cf_record_id": "abc123", "status": "pending|active|failed|unhealthy",
  "deployed_by": "discord_id", "deployed_at": "2026-06-13T...", "branch": "main",
  "updated_at": "2026-06-13T..."
}
```
(`assigned_port` is null for static/laravel.)

### `GET /api/deployments/{deployment_uuid}`
→ `200` one Deployment object, or `404 {"error":"Deployment not found"}`.

### `POST /api/deploy`
Start a deployment. Body:
```json
{ "project_uuid": "uuid", "subdomain": "myapp", "github_pat": "ghp_...", "triggered_by": "discord_id" }
```
→ `202 {"run_id":"uuid"}` (watch via SSE §A). Missing fields → `400`. Unknown project → `404`.

### `POST /api/deploy/rebuild/{deployment_uuid}`
Body: `{ "triggered_by": "discord_id" }` → `202 {"run_id":"uuid"}` (watch via SSE §A).
**Read `run_id` (see change #1).**

### `DELETE /api/deployments/{deployment_uuid}`
→ `200 {"status":"deleted","message":"..."}` or `400 {"error":"..."}`.

### Env vars
- `GET /api/deployments/{deployment_uuid}/env` → `200 {"env":[{"key":"X","value":"y"}, ...]}`.
- `PUT /api/deployments/{deployment_uuid}/env` body `{"key","value"}` → `200 {"status":"updated","key"}`.
- `POST /api/deployments/{deployment_uuid}/env` body `{"key","value"}` → `200 {"status":"added","key"}` (fails if key exists).
- `DELETE /api/deployments/{deployment_uuid}/env?key=KEY` → `200 {"status":"deleted","key"}`.

---

## Self-test (NEW)

Runs the **real** deploy pipeline against hermetic, throwaway git fixtures and tears everything
back down — the one button to confirm "deploys still work" after a change. It performs actual
server work (clones, builds, nginx, Cloudflare A records, pm2, **Let's Encrypt _staging_** certs)
under temporary `selftest-*` subdomains, then deletes all of it. Treat it as a privileged/admin
action: it takes minutes and touches real infrastructure (on staging certs, so no LE rate-limit risk).

### `POST /api/selftest`
Body (all optional):
```json
{ "variants": "all", "cert_staging": true }
```
- `variants`: `"all"` (default) or a CSV of `static,node,rebuild,webhook,rollback`. Node-dependent
  steps (`rebuild`/`webhook`/`rollback`) auto-include `node`. Unknown values fall back to the full suite.
- `cert_staging`: keep `true` (default). `false` issues **real** certs — don't expose that in normal UI.

→ `202 { "status":"started", "run_id":"uuid", "variants":[...], "cert_staging":true, "log_stream":"/api/deploy/logs/<run_id>" }`
→ `409 {"error":"A self-test is already running; only one runs at a time."}` (single-flight; disable the button while one runs)
→ `503 {"error":"Self-test module unavailable"}`

### Watching it
Stream `GET /api/deploy/logs/{run_id}` — **identical to deploy/rebuild logs (SSE §A)**: `data: {"line":...}`
frames, `[keepalive]` heartbeats, terminating `[done]`. Reuse the same `EventSource`/proxy you use for deploys.

**Structured result:** the second-to-last line is a normal log line whose text starts with `[RESULT] `
followed by JSON — parse it for a pass/fail panel instead of scraping the log:
```jsonc
// from a frame {"line":"[RESULT] {...}"} — strip the "[RESULT] " prefix, JSON.parse the rest
{ "token":"a1b2c3d4", "passed":5, "total":5, "ok":true,
  "steps":[ {"step":"static-deploy","ok":true,"detail":"status=active, stack=static, port=null"},
            {"step":"node-deploy","ok":true,"detail":"..."},
            {"step":"node-rebuild","ok":true,"detail":"..."},
            {"step":"webhook","ok":true,"detail":"ping=200(200) bad-sig=401(401) push=202(202)"},
            {"step":"node-rollback","ok":true,"detail":"head=… good=… broken=… log=success"} ] }
```
Each `steps[]` entry is one pipeline assertion; `ok` is the overall pass. A self-test summary also lands
in the alerts feed (`source:"selftest"`, critical only on failure).

UI suggestion: a "Run self-test" button (admin-only) → POST → open the log stream in the same
viewer as deploys → on `[RESULT]` render the per-step checklist, on `[done]` mark finished.
No new server action shape and no new SSE proxy route are needed beyond what deploys already use.

---

## Control plane — per deployment (NEW)

### `GET /api/deployments/{deployment_uuid}/status`
Live aggregated status. → `200`:
```json
{
  "deployment_uuid":"uuid", "subdomain":"myapp", "fqdn":"myapp.arvo.team",
  "stack":"node", "status":"active",
  "pm2": { "status":"online", "restarts":0, "uptime":1718200000000, "cpu":0.3, "memory":51200000 },
  "http": { "ok":true, "code":200 },
  "ssl": { "days_left": 80 },
  "dns": { "present":true, "content":"1.2.3.4", "proxied":true, "drift":false },
  "disk_bytes": 184320000,
  "assigned_port": 3133, "deployed_at":"...", "deployed_by":"discord_id"
}
```
(`pm2` is null if not a node app or process missing. `http` is `{ok:false, code:null, error:"..."}` on
failure. `ssl.days_left` and `disk_bytes` may be null if unknown.)

### `GET /api/deployments/{deployment_uuid}/logs/{kind}`
SSE **format B** (raw text). `kind` — `app` | `nginx-access` | `nginx-error` | `build`.
- `app` is node-only → `400 {"error":"No app process for this stack"}` otherwise.
- `build` replays the last run's stored log then `data: [done]`.
- Unknown kind → `400 {"error":"Unknown log kind"}`.

### `GET /api/deployments/{deployment_uuid}/config`
→ `200 { "nginx_config": "<file text or null>", "package_scripts": { "build":"...", ... } | null, "env_file_name": ".env" }`.

### `POST /api/deployments/{deployment_uuid}/process`  (node only)
Body `{ "action": "start|stop|restart|reload|flush" }` (default `restart`).
→ `200 {"status":"<action>","detail":"..."}` | `400 {"error":"..."}` (incl. non-node → `400`).

### `POST /api/deployments/{deployment_uuid}/nginx`
Body `{ "action": "reload|enable|disable|test" }` (default `reload`).
→ `200 {"status":"<action>","detail":"..."}` | `400 {"error":"..."}`.

### `POST /api/deployments/{deployment_uuid}/ssl/renew`
No body. → `200 {"status":"renewed","detail":"..."}` | `400 {"error":"..."}`.
(Note: certbot only actually renews a cert within ~30 days of expiry; otherwise it's a no-op success.)

### `POST /api/deployments/{deployment_uuid}/dns/reconcile`
No body. Forces the Cloudflare A record back to the correct IP + proxied.
→ `200 {"status":"reconciled","detail":"ok"}` | `400 {"error":"..."}`.

### Webhook (GitHub auto-deploy) — one webhook per deployment
A push to the webhook URL rebuilds the deployment (when the pushed branch matches).

- `GET /api/deployments/{deployment_uuid}/webhook` → existing webhook, or `404 {"error":"No webhook configured"}`:
  ```json
  { "webhook_uuid":"uuid", "url":"https://<host>/webhook/uuid", "secret":"hex",
    "branch":"main", "content_type":"application/json", "events":["push"] }
  ```
- `POST /api/deployments/{deployment_uuid}/webhook` → creates it (idempotent — returns the
  existing one if already configured). `201` (or `200` if it existed) with the same object above.
- `DELETE /api/deployments/{deployment_uuid}/webhook` → `200 {"status":"deleted"}` | `404`.

Show the user the `url` + `secret` to paste into GitHub (Settings → Webhooks: Payload URL =
`url`, Content type = `application/json`, Secret = `secret`, "Just the push event"). The `url`
host comes from the backend's `WEBHOOK_PUBLIC_BASE` env var; if it's unset the API returns a
path-only `url` (`/webhook/uuid`) and the user must prefix their public host.

---

## Control plane — server-wide & managed services (NEW)

"Managed services" are sites/processes Nydus operates but didn't deploy (the main site
arvo.team, the UI, the bot, nginx). They live separately from deployments.

### `GET /api/server/overview`
One call for a dashboard. → `200`:
```json
{
  "system": { },
  "deployments": [ { } ],
  "managed_services": [ ]
}
```
(`system` is the same shape as `GET /api/stats`; `deployments[]` are like the `/status` object but
without `disk_bytes`; `managed_services[]` are ManagedService objects.)

### `GET /api/server/discover`
What's actually running on the box (for adoption/drift). → `200`:
```json
{
  "pm2": [ {"name":"arvo.team","status":"online","cwd":"/var/www/arvo.team","restarts":0} ],
  "nginx_sites": [ {"file":"myapp.arvo.team","server_names":["myapp.arvo.team"],"ports":[3133],"roots":[],"enabled":true} ],
  "certs": [ {"name":"myapp.arvo.team","domains":["myapp.arvo.team"],"days_left":80} ]
}
```

### `GET /api/services`
→ `200` array of **ManagedService** objects:
```json
{
  "service_uuid":"uuid", "name":"arvo.team", "service_type":"pm2|systemd|nginx|static",
  "pm2_name":"arvo.team", "systemd_unit":null, "fqdn":"arvo.team",
  "health_url":"https://arvo.team", "deploy_path":"/var/www/arvo.team",
  "port":null, "git_url":null, "branch":"main", "enabled":1,
  "created_at":"...", "updated_at":"..."
}
```

### `POST /api/services`
Body (only `name` + `service_type` required):
```json
{ "name":"arvo.team", "service_type":"pm2", "pm2_name":"arvo.team", "systemd_unit":null,
  "fqdn":"arvo.team", "health_url":"https://arvo.team", "deploy_path":"/var/www/arvo.team",
  "port":null, "git_url":null, "branch":"main" }
```
→ `201 {"service_uuid":"uuid","name":"...","service_type":"..."}` | `400` (bad fields) | `500` (duplicate name).

### `DELETE /api/services/{service_uuid}` → `200 {"status":"deleted"}` | `500 {"error":"Delete failed"}`.

### `POST /api/services/{service_uuid}/process`
Body `{ "action": "start|stop|restart|reload|flush" }` (default `restart`).
→ `200 {"status":"<action>","detail":"..."}` | `400 {"error":"..."}` | `404` (service not found).

### `GET /api/services/{service_uuid}/logs?lines=100`
SSE **format B** (raw text). `404` if the service isn't found; `400` if its type has no logs.

---

## Alerts / notifications (NEW — frontend-first)

Every monitoring/deploy event (deploy success/failure, unhealthy, rebuild, watchdog
down/recovered, resource thresholds, control-plane actions) is recorded here for the dashboard.
Discord is secondary — only `is_critical: 1` events are also pushed there. **The notification UI
should read these endpoints, not Discord.**

### `GET /api/alerts?limit=50&unacknowledged=false&level=`
→ `200` array, newest first. **Alert object:**
```json
{
  "alert_uuid":"uuid", "level":"info|success|warning|error|critical",
  "source":"deploy|rebuild|watchdog|monitor|control|database|webhook",
  "title":"Deployment complete", "message":"`myapp.arvo.team` is live.",
  "target":"myapp.arvo.team",
  "is_critical":0, "acknowledged_at":null, "created_at":"2026-06-13T..."
}
```
(`target` is the affected subdomain/service, may be null.)
Query params: `limit` (default 50), `unacknowledged=true` to get only unread, `level=error` to filter.

### `GET /api/alerts/count` → `200 {"unacknowledged": 3}`  (drive the bell badge with this).
### `POST /api/alerts/{alert_uuid}/ack` → `200 {"status":"acknowledged"}` | `404` (mark one read).
### `POST /api/alerts/ack-all` → `200 {"status":"acknowledged"}`  ("Clear All").

For the notification dropdown: render `title` (bold) + `message` (subtext), color by `level`,
badge from `/api/alerts/count`, "Clear All" → `ack-all`. Requires the alerts migration
(`migrations/2026-06-13_alerts_feed.sql`).

## Databases

### `GET /api/databases?include_deleted=false` → `200` array of database objects.
### `GET /api/databases/{uuid}` → `200` object | `404`.
### `POST /api/databases`
Body `{ "database_type":"mysql", "database_name":"...", "allowed_hosts":"localhost", "created_by":"discord_id" }`
→ `201 {"database_uuid":"uuid"}` | `400` | `500`.
### `DELETE /api/databases/{uuid}`
Body `{ "database_name", "database_type", "deleted_by" }` → `200 {"status":"deleted"}`.

### `GET /api/databases/users?include_deleted=false` → `200` array.
### `POST /api/databases/users`  **(changed: `allowed_hosts` added)**
Body:
```json
{ "database_type":"mysql", "username":"...", "password":"...", "created_by":"discord_id",
  "allowed_hosts":"%" }
```
`allowed_hosts` is OPTIONAL. `"%"` = remote (default), `"localhost"` = local only, `"*"` → `"%"`, or CSV of hosts.
→ `201 {"user_uuid":"uuid"}` | `400` | `500`. Omit `allowed_hosts` → defaults to `%` (remote).
### `DELETE /api/databases/users/{user_uuid}`
Body `{ "database_type","username","deleted_by" }` → `200 {"status":"deleted"}`.

### Privileges / backups / schedules (unchanged)
- `POST /api/databases/{uuid}/privileges` body `{database_type,database_name,user_uuid,username,privileges,granted_by}` → `200 {"status":"granted"}`.
- `DELETE /api/databases/{uuid}/privileges/{user_uuid}` body `{database_type,database_name,username,revoked_by}` → `200 {"status":"revoked"}`.
- `GET /api/databases/{uuid}/privileges` · `GET /api/databases/privileges` → arrays.
- `POST /api/databases/{uuid}/backup` body `{database_type,database_name}` → `201 {"backup_uuid"}`.
- `POST /api/databases/{uuid}/restore` body `{database_type,database_name,backup_file_path}` → `200 {"status":"restored"}`.
- `GET /api/databases/{uuid}/backups` · `GET /api/databases/backups?limit=50` → arrays.
- `GET /api/databases/backups/{backup_uuid}/download` → file stream (gzip).
- `POST /api/databases/quickgen` body `{database_type,created_by}` → `200 {database_uuid,database_name,user_uuid,username,password}` (user is remote `%`).
- `POST /api/databases/pma-token` body `{user_uuid}` → `200 {"token":"..."}`.
- `GET /api/databases/users/{user_uuid}/credentials` → `200 {username,password}` | `404`.
- `GET /api/databases/schedules` · `POST /api/databases/schedules/{schedule_uuid}/toggle` → `{enabled}` · `POST /api/databases/schedules/{schedule_uuid}/run` → `{status:"queued"}`.

---

## Cloudflare, projects, stats, maintenance (unchanged)

- `GET /api/stats` → system resource averages object.
- `GET /api/cloudflare/records?type=&name=&page=` → CF list result. `POST` body `{type,name,content,ttl,proxied,comment}` → `201`. `PUT /api/cloudflare/records/{record_id}` same body. `DELETE /api/cloudflare/records/{record_id}` → `{status:"deleted"}`.
- `GET /api/cloudflare/analytics?days=7` · `GET /api/cloudflare/dynamic-analytics?days=7` → stats objects.
- `GET /api/github-projects` → array · `POST` body `{name,owner,owner_type,description,url_path,git_url,ssh_url,visibility,branch,owner_discord_id}` → `201 {uuid}` · `DELETE /api/github-projects/{uuid}`.
- `GET /api/attached-projects?owner_discord_id=...` → array.
- `GET /api/maintenance/logs/{service}` → SSE **format B**. `GET /api/maintenance/restart/{service}` → SSE **format C**. (`service` e.g. `arvo-team`, `nginx`, `nydus-ui`, `nydus`.)
- `POST /api/toggle-public` body `{action:"start|stop"}` · `GET /api/public-status` → `{running:bool}`.

---

## Requires the DB migration
The `unhealthy` status, the DB-user `allowed_hosts` field, and all `managed_services` endpoints
depend on `migrations/2026-06-13_reliability_and_control_plane.sql` being applied on the server.
Until it is, `unhealthy` won't appear, DB-user creation errors, and `/api/services` returns empty/500.
