# StudyPilot — AI Study Planner

StudyPilot is a full-stack university course project for organizing courses, tasks, quick notes, and AI-generated study plans. It includes a responsive React frontend, an Express REST API, and Microsoft SQL Server persistence.

## Project structure

```text
study-pilot/
├── frontend/    # React, Vite, React Router, native fetch, plain CSS
├── backend/     # Node.js, Express, JWT authentication, Gemini integration
└── database/    # Guarded SQL Server schema and optional sample data
```

Detailed setup and API documentation are in [backend/README.md](backend/README.md). Frontend architecture and troubleshooting are in [frontend/README.md](frontend/README.md).

## Run locally

The backend expects the browser origin `http://localhost:5173`; the frontend expects the API at `http://localhost:5000/api`.

Terminal 1:

```powershell
Set-Location .\backend
npm.cmd install
npm.cmd run dev
```

Terminal 2:

```powershell
Set-Location .\frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Check the API independently at `http://localhost:5000/api/health`.

## Quality checks

Backend:

```powershell
Set-Location .\backend
npm.cmd test
```

Frontend:

```powershell
Set-Location .\frontend
npm.cmd run lint
npm.cmd run build
```

Local `.env` files are ignored. Use each folder's `.env.example` as the safe configuration template, and never put backend secrets in the frontend.
