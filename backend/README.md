# StudyPilot backend

StudyPilot is a course-project REST API for a university study planner. Students can register, manage their own courses, tasks, and notes, and ask Google Gemini to generate a saved study plan. Administrators can inspect aggregate statistics, activate or deactivate accounts, and review recent safe AI audit logs.

The server is intentionally straightforward: controllers issue typed, named T-SQL parameters through one reusable SQL Server pool, JWT middleware reloads the current user on every protected request, and all JSON responses use one predictable envelope.

## Technology stack

- Node.js 20 or newer and CommonJS modules
- Express 5
- Microsoft SQL Server Express using the `dbo` schema
- `mssql` with the `msnodesqlv8` adapter and Microsoft ODBC Driver 18 for SQL Server
- Windows Authentication; no database username or password is stored in `.env`
- JWT authentication with `jsonwebtoken`
- Password hashing with `bcryptjs`
- `helmet`, origin-restricted `cors`, and login-only rate limiting
- Official Google Gen AI JavaScript SDK and the Gemini Developer API
- Node's built-in test runner and `supertest`
- `nodemon` for development

## Project structure

```text
study-pilot/
├── database/
│   ├── schema.sql          # Database, tables, constraints, and indexes
│   └── sample-data.sql     # Optional data for an existing sample student
├── backend/
│   ├── config/             # SQL Server pool and configuration validation
│   ├── controllers/        # HTTP validation, SQL operations, and responses
│   ├── middleware/         # Authentication, authorization, 404, and errors
│   ├── routes/             # Express route definitions
│   ├── scripts/            # Administrator creation script
│   ├── services/           # Gemini integration
│   ├── tests/              # Node test-runner API and unit tests
│   ├── utils/              # Errors, response helpers, and validation
│   ├── .env.example        # Safe configuration template
│   ├── package.json
│   └── server.js           # App composition, startup, and shutdown
└── README.md
```

## Prerequisites

- Node.js 20+ and npm
- Microsoft SQL Server Express with the `SQLEXPRESS` instance installed; the `SQL Server (SQLEXPRESS)` service must be running
- SQL Server Management Studio (SSMS) for inspecting the database and, when necessary, executing the repository schema
- Microsoft ODBC Driver 18 for SQL Server, matching the architecture of Node.js
- A Windows account that can connect to `StudyPilot`; the backend uses the identity of the user running Node
- Optional: a Gemini Developer API key for successful AI generation. The rest of the API works without one, and missing-key requests are deliberately logged as failures.

Confirm the required ODBC driver from PowerShell:

```powershell
Get-OdbcDriver -Name 'ODBC Driver 18 for SQL Server'
```

The configured connection target is:

| Setting | Value |
| --- | --- |
| Machine | `DESKTOP-1NNA0J7` |
| Instance | `SQLEXPRESS` |
| Full server name | `DESKTOP-1NNA0J7\SQLEXPRESS` |
| Database | `StudyPilot` |
| Schema | `dbo` |
| Authentication | Windows Authentication |
| Driver | `ODBC Driver 18 for SQL Server` |

## Setup

Run commands from the repository root unless a step says otherwise.

### 1. Inspect or apply the schema with SSMS

The live `StudyPilot` database and its six tables—`dbo.users`, `dbo.courses`, `dbo.tasks`, `dbo.notes`, `dbo.study_plans`, and `dbo.ai_logs`—already exist. Do not drop, reset, clear, or recreate them. The repository schema is a non-destructive reference and is useful when provisioning another machine or creating objects that are genuinely missing.

To execute [database/schema.sql](../database/schema.sql) in SQL Server Management Studio:

1. Open SSMS and connect to `DESKTOP-1NNA0J7\SQLEXPRESS` with **Windows Authentication**.
2. Choose **File → Open → File**, then select `database/schema.sql` from this repository.
3. Review the script and confirm that its query context is `StudyPilot`; the script also contains `USE [StudyPilot]`.
4. Choose **Execute** or press `F5`.

The script contains guarded `IF DB_ID`, `IF OBJECT_ID`, and index-existence checks. It creates only missing database objects and indexes; it contains no `DROP`, `TRUNCATE`, or data-deletion statements. Existing tables and rows remain in place. It is not a migration engine and does not rewrite an existing table definition.

Optional classroom data is in [database/sample-data.sql](../database/sample-data.sql). Its prerequisite is an existing student registered through the API with the exact email `student@example.com`. After that account exists, open the file in SSMS against `StudyPilot` and execute it only if sample rows are wanted. The guarded script avoids duplicate sample rows and creates neither users nor password hashes. Create administrators with the Node seed command instead.

### 2. Create local configuration

PowerShell:

```powershell
Set-Location .\backend
Copy-Item .env.example .env
```

Bash:

```bash
cd backend
cp .env.example .env
```

Edit `.env` before starting the server. Do not commit it. All values below are read by the current implementation.

```env
NODE_ENV=development
PORT=5000

DB_SERVER=DESKTOP-1NNA0J7
DB_INSTANCE=SQLEXPRESS
DB_NAME=StudyPilot
DB_AUTH_MODE=windows
DB_TRUST_SERVER_CERTIFICATE=true
DB_ENCRYPT=false
DB_CONNECTION_LIMIT=10
DB_REQUEST_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=15000

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=8h

CLIENT_ORIGIN=http://localhost:5173

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite

ADMIN_NAME=StudyPilot Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
```

| Variable | Required | Purpose and constraints |
| --- | --- | --- |
| `NODE_ENV` | Recommended | Use `development` locally and `production` in production. |
| `PORT` | No | HTTP port; defaults to `5000` and must be an integer from 1 through 65535. |
| `DB_SERVER` | Yes | Server machine name. Use `DESKTOP-1NNA0J7`; do not append the instance here. |
| `DB_INSTANCE` | Yes | Named instance. Use `SQLEXPRESS`; the driver combines it with `DB_SERVER`. |
| `DB_NAME` | Yes | Database selected by the pool: `StudyPilot`. |
| `DB_AUTH_MODE` | No | Must be `windows`; that is also the default. Other authentication modes are deliberately rejected. |
| `DB_TRUST_SERVER_CERTIFICATE` | No | `true` or `false`; defaults to `true`. The local configuration trusts the instance certificate. |
| `DB_ENCRYPT` | No | `true` or `false`; defaults to `false` for this local Express instance. |
| `DB_CONNECTION_LIMIT` | No | Positive pool size; defaults to `10`. |
| `DB_REQUEST_TIMEOUT` | No | Positive request timeout in milliseconds; defaults to `30000`. |
| `DB_CONNECTION_TIMEOUT` | No | Positive connection timeout in milliseconds; defaults to `15000`. |
| `JWT_SECRET` | Yes | Private signing secret, at least 24 characters. Replace the template value with a long random value. |
| `JWT_EXPIRES_IN` | Yes | `jsonwebtoken` duration such as `8h`. |
| `CLIENT_ORIGIN` | Yes | The one browser origin allowed by CORS, including scheme and port, such as `http://localhost:5173`. |
| `GEMINI_API_KEY` | No | Server-only Gemini Developer API key. Leave blank to disable generation cleanly; never expose it to React. |
| `GEMINI_MODEL` | No | Gemini model ID; defaults to the free-tier-eligible `gemini-3.5-flash-lite`. |
| `ADMIN_NAME` | For admin script | Administrator display name, 2–100 characters. |
| `ADMIN_EMAIL` | For admin script | Valid administrator email; normalized to lowercase. |
| `ADMIN_PASSWORD` | For admin script | Administrator password, 6–72 characters. Replace the template password. It is never printed. |

There are intentionally no database username, password, or port variables. Windows Authentication uses the identity running `node`, and a named Express instance may use a dynamic port. The backend does not assume port 1433.

For this local setup, `DB_ENCRYPT=false` and `DB_TRUST_SERVER_CERTIFICATE=true` avoid certificate-chain failures from a development instance. On a production network, prefer encryption with a certificate trusted by the client rather than relying on certificate trust bypass.

Startup fails early with a readable message if required database settings, JWT settings, or `CLIENT_ORIGIN` are absent or invalid. Boolean settings accept only `true` or `false`, timeout/pool values must be positive integers, and `DB_AUTH_MODE` must be `windows`. `GEMINI_API_KEY` is intentionally not a startup requirement.

### 3. Install every package

From `backend/`:

```powershell
npm.cmd install
```

This installs the locked backend dependencies, including `mssql` and its `msnodesqlv8` Windows adapter. Confirm them with:

```powershell
npm.cmd ls mssql msnodesqlv8
```

For a clean reproducible reinstall, `npm.cmd ci` is also supported by the committed lockfile.

> **Windows PowerShell note:** on systems where the execution policy blocks `npm.ps1`, use `npm.cmd` as the drop-in executable. For example, use `npm.cmd install`, `npm.cmd run dev`, `npm.cmd start`, and `npm.cmd test`. In a shell where `npm` already works, either form is fine.

### 4. Create the administrator

Make sure the schema exists and `ADMIN_*` values are set in `.env`, then run from `backend/`:

```powershell
npm.cmd run create-admin
```

The script hashes the password, creates an active administrator, and closes the pool. Re-running it for the same administrator is safe. It will not silently promote a student who already uses that email.

### 5. Run the API

Development with automatic restart:

```powershell
npm.cmd run dev
```

Production-style start:

```powershell
$env:NODE_ENV = 'production'
npm.cmd start
```

Bash equivalent:

```bash
NODE_ENV=production npm start
```

Before listening, the server connects to the named SQL Server instance and executes `SELECT 1 AS connection_test;`. It handles `SIGINT` and `SIGTERM`, closing both the HTTP server and SQL Server pool.

Verify startup:

```powershell
curl.exe http://localhost:5000/api/health
```

```json
{
  "success": true,
  "message": "StudyPilot API is running"
}
```

### Verified live connection

During migration verification on this machine, the Node database layer connected successfully with Windows Authentication to `DESKTOP-1NNA0J7\SQLEXPRESS`, selected `StudyPilot`, and returned `1` from `SELECT 1 AS connection_test;`. A live API run also verified health, registration, login, `/auth/me`, course/task/note create-read-update-delete flows, study-plan listing, safe missing-key AI logging, administrator creation/login/statistics/users/logs, and deactivation/reactivation. The verification-only students were left deactivated, their course/task/note rows were removed through their own API endpoints, and no user rows or pre-existing data were deleted. During the Gemini provider migration, one live generation request returned `201` with non-empty plain text; the saved plan and successful AI log were both verified through the existing APIs. Its temporary study plan was deleted and its verification student was deactivated, while the successful audit log remains by design. The private API key was never printed or returned.

## Package commands

Run these in `backend/`.

| Command | Purpose |
| --- | --- |
| `npm install` | Install all production and development dependencies and honor the lockfile. |
| `npm ci` | Perform a clean install exactly from the lockfile. |
| `npm run dev` | Start with `nodemon`. |
| `npm start` | Start with Node. |
| `npm run create-admin` | Create the configured administrator if it does not exist. |
| `npm test` | Run all `node:test` tests. |
| `npm run check` | Syntax-check the server entry point. |

## API conventions

The default base URL is:

```text
http://localhost:5000/api
```

Send JSON request bodies with `Content-Type: application/json`. Except for health, registration, and login, send the JWT returned by login as:

```http
Authorization: Bearer <token>
```

There are no cookies, refresh tokens, or public administrator-registration fields. A successful single-resource operation uses this shape:

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "id": 1,
    "title": "Web Development"
  }
}
```

List endpoints return:

```json
{
  "success": true,
  "count": 1,
  "data": []
}
```

Errors contain a safe message and usually a stable code:

```json
{
  "success": false,
  "message": "Course not found",
  "code": "NOT_FOUND"
}
```

All current delete endpoints return HTTP `200` with a success message and no `data` field. Date values returned by the JSON API are serialized as ISO date strings.

## Route reference

### General and authentication

| Method | Route | Access | Body / behavior | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Server health response. | `200` |
| `POST` | `/api/auth/register` | Public | `{ "name", "email", "password" }`; creates only a student. Unknown fields such as `role` or `isActive` are rejected. | `201` safe user |
| `POST` | `/api/auth/login` | Public | `{ "email", "password" }`; returns `{ token, user }`. Limited to 10 failed attempts per 15-minute window per client. | `200` |
| `GET` | `/api/auth/me` | Active JWT | Returns the current database-backed safe user. | `200` |

Names are trimmed and must be 2–100 characters, emails are trimmed and lowercased, and registration passwords must be 6–72 characters.

### Courses

Every course route requires an active student JWT.

| Method | Route | Body / behavior | Success |
| --- | --- | --- | --- |
| `GET` | `/api/courses` | Lists only the student's courses, newest first, with `taskCount`, `completedTaskCount`, and rounded `progressPercentage`. | `200` list |
| `POST` | `/api/courses` | `{ "title": "Web Development" }`; title is required and at most 100 characters. | `201` |
| `GET` | `/api/courses/:id` | Returns one owned course. | `200` |
| `PUT` | `/api/courses/:id` | `{ "title" }`; title is the only accepted field. | `200` |
| `DELETE` | `/api/courses/:id` | Deletes an owned course; its tasks are removed by the foreign-key cascade. | `200` |

### Tasks

Every task route requires an active student JWT. A task belongs to a course; it has no `user_id` column.

| Method | Route | Body / behavior | Success |
| --- | --- | --- | --- |
| `GET` | `/api/courses/:courseId/tasks` | Lists owned-course tasks: pending first, nearest non-null deadline first, then newest. | `200` list |
| `POST` | `/api/courses/:courseId/tasks` | `{ "title", "description?", "deadline?", "priority?", "status?" }`; defaults are `medium` and `pending`. | `201` |
| `GET` | `/api/tasks/:id` | Returns one task after joining its course to check ownership. | `200` |
| `PUT` | `/api/tasks/:id` | Any nonempty subset of `title`, `description`, `deadline`, `priority`, and `status`. | `200` |
| `DELETE` | `/api/tasks/:id` | Deletes a task only after course-based ownership verification. | `200` |

Task titles are at most 150 characters. `priority` is `low`, `medium`, or `high`; `status` is `pending` or `completed`; optional deadlines must be valid ISO-style dates. Impossible calendar dates such as `2026-02-30` are rejected. A task description may be omitted or `null`, is validated to at most 65,535 characters, and is stored as `NVARCHAR(MAX)`.

### Notes

Every note route requires an active student JWT.

| Method | Route | Body / behavior | Success |
| --- | --- | --- | --- |
| `GET` | `/api/notes` | Lists only the student's notes, newest first. | `200` list |
| `POST` | `/api/notes` | `{ "title", "content" }`; both are required. | `201` |
| `GET` | `/api/notes/:id` | Returns one owned note. | `200` |
| `PUT` | `/api/notes/:id` | A nonempty subset of `{ "title", "content" }`. | `200` |
| `DELETE` | `/api/notes/:id` | Deletes one owned note. | `200` |

Note titles are at most 150 characters and content is at most 50,000 characters.

### AI study plans

Every study-plan route requires an active student JWT.

| Method | Route | Body / behavior | Success |
| --- | --- | --- | --- |
| `GET` | `/api/study-plans` | Lists only the student's saved plans, newest first. | `200` list |
| `POST` | `/api/study-plans/generate` | `{ "subject", "topic", "difficulty?", "availableMinutes", "deadline?" }`; calls Gemini, logs the request, and saves the result. | `201` |
| `GET` | `/api/study-plans/:id` | Returns one owned saved plan. | `200` |
| `DELETE` | `/api/study-plans/:id` | Deletes one owned saved plan. Generated content cannot be manually updated. | `200` |

`subject` is at most 100 characters, `topic` at most 150, `difficulty` is `easy`, `medium`, or `hard` and defaults to `medium`, and `availableMinutes` must be an integer from 15 through 480. An optional deadline must be a real ISO-style calendar date; impossible dates are rejected.

### Administrator

Every route below runs `authenticate` followed by `authorize('admin')`. Administrators do not gain access to student CRUD routes.

| Method | Route | Body / behavior | Success |
| --- | --- | --- | --- |
| `GET` | `/api/admin/stats` | Counts students, active students, courses, tasks, completed tasks, and successful/failed/total AI requests. Empty tables produce zeroes. | `200` |
| `GET` | `/api/admin/users` | Lists safe user records newest first. Optional query: `?status=active` or `?status=inactive`. | `200` list |
| `PATCH` | `/api/admin/users/:id/status` | `{ "isActive": true }` or `false`; does not change role or delete the user. An admin cannot deactivate their own account. | `200` |
| `GET` | `/api/admin/ai-logs` | Returns at most 50 newest logs with user identity, status, a prompt truncated to 2,000 characters, safe error text, and creation date. | `200` list |

There are deliberately no public create, update, or delete routes for AI logs.

## Ownership and authorization

- Client-supplied ownership fields are never accepted. Ownership always comes from `req.user.id`.
- Courses use `courses.user_id`; notes use `notes.user_id`; study plans use `study_plans.user_id`.
- Task reads, updates, and deletes establish ownership through `tasks JOIN courses`, because tasks do not contain `user_id`.
- An ID belonging to another student is returned as `404`, which avoids revealing that the resource exists.
- The authentication middleware verifies the JWT, reloads the latest user and role from SQL Server, and checks `is_active` on every request. A token issued before deactivation is therefore rejected immediately.
- Student endpoints require the current role to be `student`; administrator powers exist only under `/api/admin`.
- The database cascades a user deletion to owned records and a course deletion to tasks, although this API deactivates users instead of deleting them.

Frontend button visibility is only a convenience; all access control is enforced by this backend.

## AI behavior

For `POST /api/study-plans/generate`, the server validates and bounds the student's fields, quotes subject and topic as context, and builds a controlled prompt requesting an objective, four to six timed steps, hands-on practice, and a final five-minute review. Only that server-built prompt is sent to the configured Gemini model. The API key never appears in a response and must never be placed in frontend code.

On success, the plain-text response is written both to a successful `ai_logs` row and to a `study_plans` row in one transaction. No task rows are generated. A representative response is:

```json
{
  "success": true,
  "message": "Study plan generated successfully",
  "data": {
    "id": 4,
    "subject": "JavaScript",
    "topic": "Promises and async/await",
    "difficulty": "hard",
    "availableMinutes": 90,
    "deadline": "2030-08-12T18:00:00.000Z",
    "generatedPlan": "Objective: ...",
    "createdAt": "2030-08-01T12:00:00.000Z"
  }
}
```

If `GEMINI_API_KEY` is blank, the server still starts. A generation request creates a failed AI log with a short safe explanation, creates no study plan, and returns HTTP `503`:

```json
{
  "success": false,
  "message": "AI study planning is not configured",
  "code": "AI_NOT_CONFIGURED"
}
```

Provider failures and empty provider responses are also safely logged and returned as `503` errors without raw SDK objects, headers, credentials, stack traces, or fake fallback output.

## More request and response examples

Register:

```powershell
'{"name":"Mohammad","email":"mohammad@example.com","password":"password123"}' |
  curl.exe -sS -X POST http://localhost:5000/api/auth/register `
    -H "Content-Type: application/json" --data-binary '@-'
```

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": 1,
    "name": "Mohammad",
    "email": "mohammad@example.com",
    "role": "student",
    "isActive": true
  }
}
```

Log in and use the returned token:

```powershell
$Login = '{"email":"mohammad@example.com","password":"password123"}' |
  curl.exe -sS -X POST http://localhost:5000/api/auth/login `
    -H "Content-Type: application/json" --data-binary '@-' |
  ConvertFrom-Json

$Token = $Login.data.token
curl.exe -sS http://localhost:5000/api/courses `
  -H "Authorization: Bearer $Token"
```

The course list has calculated progress:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "title": "Web Development",
      "createdAt": "2030-08-01T12:00:00.000Z",
      "updatedAt": "2030-08-01T12:00:00.000Z",
      "taskCount": 2,
      "completedTaskCount": 1,
      "progressPercentage": 50
    }
  ]
}
```

## Automated tests

From `backend/`, run:

```powershell
npm.cmd test
npm.cmd run check
```

The current suite contains 52 tests covering:

- the health response, malformed JSON, CORS rejection, safe unknown-route response, and protected router mounting;
- SQL Server configuration defaults and validation, including ODBC Driver 18, the named instance, Windows-only authentication, booleans, pool size, and timeouts;
- reusable input validation and role authorization;
- authentication with SQL Server-shaped mocks, including a typed named parameter, reloading the current database role instead of trusting the token, inactive users, and users that no longer exist;
- controller query contracts such as named parameters, `OUTPUT INSERTED`, empty ownership recordsets, task ownership through `courses`, an ownership-safe task delete join, and safe registration output;
- SQL Server errors 2601/2627 and 547 mapping to controlled responses while unexpected driver errors remain generic;
- missing-Gemini-key behavior at both service and controller level, including the safe `503 AI_NOT_CONFIGURED` response and exactly one sanitized failed `ai_logs` insert;
- Gemini model selection, plain-text output configuration, provider timeout, output limits, and provider-error sanitization; and
- successful `ai_logs` plus `study_plans` insertion in one transaction, including rollback on persistence failure.

The query-contract tests mock SQL Server requests and recordsets, while the separate live verification described above exercised the database-backed API. The manual sequence below remains useful for repeatable verification on another machine.

## End-to-end manual test with PowerShell and `curl.exe`

Prerequisites for this sequence:

- Confirm the existing `StudyPilot` database and `dbo` tables in SSMS, then configure `.env` as described above. Execute the guarded schema only when objects are actually missing.
- Run `npm.cmd run create-admin`, then keep `npm.cmd run dev` running in another terminal. Plain `npm` is equivalent when it is not blocked by PowerShell's execution policy.
- Put a valid `GEMINI_API_KEY` in `.env` and restart the server if step 7 should return a generated plan. With no key, step 7 should instead return the documented `503`; the remaining steps still work and the failure will appear in step 15.
- Use unique generated student emails as shown. Do not execute `sample-data.sql` for this sequence; that optional file has its separate `student@example.com` prerequisite.

Start in a new PowerShell terminal:

```powershell
$BaseUrl = 'http://localhost:5000/api'
$RunId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$EmailA = "student.a.$RunId@example.com"
$EmailB = "student.b.$RunId@example.com"
$StudentPassword = 'StudentPass123!'
$AdminEmail = 'admin@example.com' # Change if ADMIN_EMAIL differs in .env
$AdminPassword = '<ADMIN_PASSWORD from backend/.env>'
```

1. Register Student A and retain the database ID.

```powershell
$Body = @{
  name = 'Student A'
  email = $EmailA
  password = $StudentPassword
} | ConvertTo-Json -Compress

$RegisterA = $Body |
  curl.exe -sS -X POST "$BaseUrl/auth/register" `
    -H "Content-Type: application/json" --data-binary '@-' |
  ConvertFrom-Json
$RegisterA
$StudentAId = $RegisterA.data.id
```

Expected: HTTP `201`, `role` is `student`, and no password hash is returned.

2. Log in as Student A and retain the JWT.

```powershell
$Body = @{ email = $EmailA; password = $StudentPassword } |
  ConvertTo-Json -Compress
$LoginA = $Body |
  curl.exe -sS -X POST "$BaseUrl/auth/login" `
    -H "Content-Type: application/json" --data-binary '@-' |
  ConvertFrom-Json
$TokenA = $LoginA.data.token
$LoginA.data.user
```

3. Create Student A's course and retain its ID.

```powershell
$Body = @{ title = 'Web Development' } | ConvertTo-Json -Compress
$Course = $Body |
  curl.exe -sS -X POST "$BaseUrl/courses" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-' |
  ConvertFrom-Json
$Course
$CourseId = $Course.data.id
```

4. Create a task in that course and retain its ID.

```powershell
$Body = @{
  title = 'Build login page'
  description = 'Connect the React form to the authentication API'
  deadline = '2030-08-10T18:00:00Z'
  priority = 'high'
  status = 'pending'
} | ConvertTo-Json -Compress

$Task = $Body |
  curl.exe -sS -X POST "$BaseUrl/courses/$CourseId/tasks" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-' |
  ConvertFrom-Json
$Task
$TaskId = $Task.data.id
```

5. Mark Student A's task completed.

```powershell
$Body = @{ status = 'completed' } | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -X PUT "$BaseUrl/tasks/$TaskId" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-'
```

Then confirm `completedTaskCount` and `progressPercentage`:

```powershell
curl.exe -sS "$BaseUrl/courses" -H "Authorization: Bearer $TokenA"
```

6. Create and then update a note.

```powershell
$Body = @{
  title = 'Exam reminder'
  content = 'Review chapters 4 and 5.'
} | ConvertTo-Json -Compress
$Note = $Body |
  curl.exe -sS -X POST "$BaseUrl/notes" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-' |
  ConvertFrom-Json
$NoteId = $Note.data.id

$Body = @{
  title = 'Updated exam reminder'
  content = 'Review chapters 4, 5, and the lab examples.'
} | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -X PUT "$BaseUrl/notes/$NoteId" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-'
```

7. Generate and automatically save an AI study plan.

```powershell
$Body = @{
  subject = 'JavaScript'
  topic = 'Promises and async/await'
  difficulty = 'hard'
  availableMinutes = 90
  deadline = '2030-08-12T18:00:00Z'
} | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -i -X POST "$BaseUrl/study-plans/generate" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $TokenA" --data-binary '@-'
```

Expected with a valid key: `201` and a saved plain-text `generatedPlan`. Expected without a key: `503 AI_NOT_CONFIGURED`, no plan, and one failed AI log.

8. Register and log in as Student B.

```powershell
$Body = @{
  name = 'Student B'
  email = $EmailB
  password = $StudentPassword
} | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -X POST "$BaseUrl/auth/register" `
    -H "Content-Type: application/json" --data-binary '@-'

$Body = @{ email = $EmailB; password = $StudentPassword } |
  ConvertTo-Json -Compress
$LoginB = $Body |
  curl.exe -sS -X POST "$BaseUrl/auth/login" `
    -H "Content-Type: application/json" --data-binary '@-' |
  ConvertFrom-Json
$TokenB = $LoginB.data.token
```

9. Prove Student B cannot read Student A's course or task by changing IDs.

```powershell
curl.exe -sS -i "$BaseUrl/courses/$CourseId" `
  -H "Authorization: Bearer $TokenB"

curl.exe -sS -i "$BaseUrl/tasks/$TaskId" `
  -H "Authorization: Bearer $TokenB"
```

Expected: both return HTTP `404` (`Course not found` and `Task not found`), not Student A's records.

10. Log in as the administrator created by `npm.cmd run create-admin`.

```powershell
$Body = @{ email = $AdminEmail; password = $AdminPassword } |
  ConvertTo-Json -Compress
$AdminLogin = $Body |
  curl.exe -sS -X POST "$BaseUrl/auth/login" `
    -H "Content-Type: application/json" --data-binary '@-' |
  ConvertFrom-Json
$AdminToken = $AdminLogin.data.token
$AdminLogin.data.user
```

Expected: the returned safe user has `role: "admin"`.

11. View administrator statistics.

```powershell
curl.exe -sS "$BaseUrl/admin/stats" `
  -H "Authorization: Bearer $AdminToken"
```

12. Deactivate Student A.

```powershell
$Body = @{ isActive = $false } | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -X PATCH "$BaseUrl/admin/users/$StudentAId/status" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $AdminToken" --data-binary '@-'
```

13. Prove Student A's already-issued token is now rejected.

```powershell
curl.exe -sS -i "$BaseUrl/auth/me" `
  -H "Authorization: Bearer $TokenA"
```

Expected: HTTP `403` with code `ACCOUNT_INACTIVE`. Authentication reads the current database status; it does not trust the old token alone.

14. Reactivate Student A and confirm the still-unexpired token works again.

```powershell
$Body = @{ isActive = $true } | ConvertTo-Json -Compress
$Body |
  curl.exe -sS -X PATCH "$BaseUrl/admin/users/$StudentAId/status" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $AdminToken" --data-binary '@-'

curl.exe -sS "$BaseUrl/auth/me" `
  -H "Authorization: Bearer $TokenA"
```

Expected: activation returns `200`; `/auth/me` also returns `200` unless the JWT naturally expired.

15. View the recent AI audit logs.

```powershell
curl.exe -sS "$BaseUrl/admin/ai-logs" `
  -H "Authorization: Bearer $AdminToken"
```

Expected: at most 50 safe log records. Step 7 appears as `success` with a valid key or `failed` without one. The endpoint never returns an API key, authorization header, stack trace, or raw SDK error.

## Common errors

| Symptom | Likely cause and fix |
| --- | --- |
| Startup says required configuration is missing | Copy `.env.example` to `.env`; set `DB_SERVER`, `DB_INSTANCE`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `CLIENT_ORIGIN`. Ensure `JWT_SECRET` has at least 24 characters. |
| `DB_AUTH_MODE must be windows` | Set `DB_AUTH_MODE=windows`. This backend deliberately does not accept database credentials. |
| ODBC error `IM002`, “data source name not found,” or “no default driver specified” | Install **Microsoft ODBC Driver 18 for SQL Server** with the same architecture as Node. Confirm it with `Get-OdbcDriver -Name 'ODBC Driver 18 for SQL Server'`. |
| Instance-specific connection error or timeout | Confirm the `SQL Server (SQLEXPRESS)` service is running and use `DB_SERVER=DESKTOP-1NNA0J7` plus `DB_INSTANCE=SQLEXPRESS`. Check SQL Server Configuration Manager if instance protocols are disabled. |
| Named instance cannot be found from another machine | SQL Server Browser normally resolves a dynamic named-instance port; start it and allow the required discovery/firewall traffic, commonly UDP 1434. Alternatively configure an approved fixed TCP port. Do not assume port 1433. A local connection may still work while Browser is stopped, so its stopped state alone does not prove the local setup is broken. |
| Windows login failure or “Cannot open database `StudyPilot`” | Node uses the Windows identity running the process. Run it as an authorized account or grant that Windows login/user access to `StudyPilot`; do not add a database password to `.env`. |
| Certificate-chain or encryption error | For this local instance, verify `DB_ENCRYPT=false` and `DB_TRUST_SERVER_CERTIFICATE=true`. For production, use encryption and a certificate trusted by the client. |
| `Invalid object name 'dbo.…'` | Confirm `DB_NAME=StudyPilot`, inspect the six `dbo` tables in SSMS, and apply the guarded repository schema only if an object is genuinely missing. Never reset the existing database as a troubleshooting shortcut. |
| Native adapter load/install error | Run `npm.cmd install`, use Node 20+ with a compatible architecture, and verify ODBC Driver 18 is installed. |
| Browser reports CORS failure or API returns `CORS_FORBIDDEN` | `CLIENT_ORIGIN` must exactly match the frontend's scheme, host, and port. Restart after changing `.env`. Requests such as curl with no `Origin` header are allowed. |
| `401 AUTHENTICATION_REQUIRED` | Supply `Authorization: Bearer <token>` with no missing token. |
| `401 INVALID_TOKEN` | The JWT is malformed, signed with another secret, or expired. Log in again; changing `JWT_SECRET` invalidates existing tokens. |
| `403 ACCOUNT_INACTIVE` | An administrator deactivated the current database account; reactivation is required. |
| `403 FORBIDDEN` | The authenticated role cannot use that route. Students use student routes; admins use `/api/admin`. |
| `404 NOT_FOUND` for an ID that exists | The record may belong to another student. This is deliberate ownership hiding. |
| `409 DUPLICATE_EMAIL` | Register with a unique email or log in to the existing account. |
| `429` on login | More than 10 failed logins occurred in 15 minutes from that client. Wait for the window; successful logins are skipped by the limiter. |
| `400 VALIDATION_ERROR` | Check field names, required strings, positive numeric IDs, enum spelling, boolean types, date format, and length limits. Unknown JSON fields are rejected. |
| `413 PAYLOAD_TOO_LARGE` | Keep the JSON request below the configured 100 KB body limit. |
| `503 AI_NOT_CONFIGURED` | Add a server-side `GEMINI_API_KEY` and restart, or leave AI generation disabled. The failed attempt is still safely logged. |
| `503 AI_PROVIDER_UNAVAILABLE` or `AI_EMPTY_RESPONSE` | Verify the model/key/account and try later. The backend does not fabricate a plan. |

For an unknown method or URL, the final 404 middleware returns the attempted method/path in a safe JSON error. Unexpected server and database errors return generic HTTP `500` responses without SQL, secrets, or stack traces.
