# StudyPilot frontend

The StudyPilot frontend is a Vite-powered React application for the university AI Study Planner. Students can register, restore a saved session, manage courses and tasks, keep notes, and generate or review study plans. Administrators receive a role-specific dashboard for platform statistics, account activation, and recent AI activity.

All displayed application data comes from the existing StudyPilot REST API. The frontend contains no mock users, courses, tasks, notes, plans, or statistics.

## Requirements

- Node.js 20 or newer
- npm
- The StudyPilot backend running at `http://localhost:5000`
- The backend's `CLIENT_ORIGIN` set to `http://localhost:5173`
- SQL Server available to the backend as documented in `../backend/README.md`

## Installation

From the repository root:

```powershell
Set-Location .\frontend
npm.cmd install
```

On systems where PowerShell permits the npm script shim, `npm` may be used instead of `npm.cmd`.

## Environment setup

The safe public template contains only the API base URL:

```powershell
Copy-Item .env.example .env
```

```env
VITE_API_URL=http://localhost:5000/api
```

The local `.env` is ignored. Never place a JWT signing secret, SQL Server setting, administrator password, or Gemini key in a Vite variable: every `VITE_*` value is public to browser code.

## Development

Start the backend first in one terminal:

```powershell
Set-Location .\backend
npm.cmd run dev
```

Start React in a second terminal:

```powershell
Set-Location .\frontend
npm.cmd run dev
```

Open `http://localhost:5173`. Vite is configured with a strict port so it cannot silently move to an origin rejected by the backend's CORS policy.

## Production build

```powershell
npm.cmd run build
```

Preview the generated `dist/` directory locally with:

```powershell
npm.cmd run preview
```

Run the configured static checks with:

```powershell
npm.cmd run lint
```

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Guest | Sign in as a student or administrator |
| `/register` | Guest | Create a student account |
| `/dashboard` | Student | Real course/task overview and upcoming deadlines |
| `/courses` | Student | Course modules and complete task CRUD |
| `/notes` | Student | Quick-note CRUD |
| `/ai-planner` | Student | Generate, view, and delete saved study plans |
| `/admin` | Administrator | Statistics, user status controls, and recent AI activity |
| `/unauthorized` | Any | Role-access explanation |
| `/*` | Any | Not Found page |

Authenticated administrators are redirected away from student pages to `/admin`. Students who request `/admin` see `/unauthorized`. Backend authorization remains authoritative.

## Authentication flow

`AuthContext` owns `user`, `token`, `loading`, `isAuthenticated`, `login`, `register`, `logout`, and `refreshUser`.

1. Login sends the exact `{ email, password }` body and stores the returned token in local storage.
2. On refresh, the provider calls `GET /auth/me`; it never treats decoded JWT data as the user record.
3. Protected UI waits until restoration finishes.
4. Authentication `401` responses and `ACCOUNT_INACTIVE` responses clear only the token that caused the response, avoiding stale-request races.
5. Registration sends `{ name, email, password }`. The current backend returns a safe user without a token, so successful registration redirects to Login.
6. Logout clears the local session and returns to Login.

## API helper

`src/api/api.js` is the single native-fetch entry point. It:

- reads `VITE_API_URL`;
- adds JSON headers only when a body is sent;
- attaches the stored bearer token;
- supports `AbortSignal`;
- parses JSON, text, and empty/`204` responses;
- understands the backend's success/error envelopes;
- exposes the backend's readable error message and stable code;
- converts connection failures into a safe message; and
- handles invalid sessions without reload or redirect loops.

Small domain wrappers in `src/api/` keep endpoint paths out of pages.

## Main frontend structure

```text
src/
├── api/          # Central request helper and endpoint wrappers
├── components/   # Common UI, course/task modules, and navigation
├── context/      # Authentication provider and context
├── hooks/        # useAuth
├── layouts/      # Student and administrator shells
├── pages/        # All route pages
├── routes/       # Authentication and role guards
├── styles/       # Variables and page-focused plain CSS
├── utils/        # Dates, progress, and validation
├── App.jsx       # Route composition
└── main.jsx      # React, Router, and Auth provider entry point
```

## AI unavailable behavior

The AI planner always loads saved-plan history. If the backend has no `GEMINI_API_KEY`, generation returns `503`; the page shows the backend's safe unavailable message and does not fabricate or save a plan. Courses, tasks, and notes remain usable.

## Common connection problems

- **CORS error:** use exactly `http://localhost:5173` and confirm the backend's `CLIENT_ORIGIN` matches it. Do not open the frontend at `127.0.0.1`.
- **Network error:** verify `http://localhost:5000/api/health` and then retry the page action.
- **Unexpected Login redirect:** the stored token may be expired or the account may be inactive. Sign in again or ask an administrator to reactivate the account.
- **AI returns 503:** configure `GEMINI_API_KEY` only in `backend/.env`; never add it to the frontend.
