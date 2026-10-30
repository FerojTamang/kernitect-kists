# KISTS — Kernitect Interactive Safety Training System

**People | Safety | Progress**

KISTS (Kernitect Interactive Safety Training System) is a browser-based workplace safety training platform developed by **Team Kernitect** as part of the CET257 Enterprise Project.

The platform provides interactive workplace safety learning experiences that help trainees understand workplace hazards, practise safe working procedures, complete assessments, and monitor their training progress.

---

## Project Overview

KISTS provides two workplace safety training modules:

### 1. Manual Handling Safety

Provides structured learning content and interactive 360° workplace scenarios focused on safe manual handling practices, hazard identification, and appropriate workplace procedures.

### 2. Forklift & Pedestrian Safety

Provides structured learning content and interactive 360° workplace scenarios focused on forklift operations, pedestrian awareness, hazard identification, and workplace safety.

Both modules follow the same structured training journey:

**Learning Content → Interactive 360° Scenario → Final Assessment**

The system also supports training assignments, progress tracking, assessment records, and digital certification based on the required training and assessment completion criteria.

---

## Key Features

- **Two Safety Training Modules:** Manual Handling and Forklift & Pedestrian Safety.
- **Interactive 360° Scenarios:** Five-point interactive 360° scenario experiences in both modules.
- **Structured Learning Content:** Organised training materials for each safety module.
- **Hazard Identification:** Interactive workplace scenarios that allow trainees to identify and respond to safety hazards.
- **Final Assessments:** Assessment activities to evaluate trainees' understanding of the training content.
- **Training Assignments:** Administrators can assign required or optional training modules to trainees.
- **Progress Tracking:** Records trainee progress and training completion status.
- **Digital Certification:** Supports certification based on the required training and assessment completion criteria.
- **User Authentication:** Provides controlled access to protected application features.
- **Role-Based Access Control:** Separates administrator and trainee functionality.
- **Responsive Interface:** Provides browser-based access across supported screen sizes.

---

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite 7
- React Router 7
- Photo Sphere Viewer 5

### Backend

- Node.js
- Express.js 5
- TypeScript
- Helmet
- PostgreSQL client (`pg`)

### Database and Storage

- PostgreSQL
- Supabase
- Supabase Storage

### Development and Testing Tools

- npm Workspaces
- Playwright
- Node.js Test Runner
- ESLint
- Prettier

---

## System Architecture

KISTS follows a frontend–backend–database architecture.

### Frontend

The frontend is developed using React and TypeScript. It provides the user interface for:

- Training content
- Interactive 360° scenarios
- Final assessments
- Training assignments
- Progress information
- User account settings

Photo Sphere Viewer is used to provide interactive 360° viewing experiences, with its markers plugin supporting scenario interactions.

### Backend

The backend is developed using Node.js, Express.js, and TypeScript.

It handles:

- Application API requests
- User authentication
- Role-based authorisation
- Training assignments
- Training progression
- Assessment processing
- Progress records
- Certification-related operations
- Protected user resources

Server-side authorisation and record-ownership checks help protect application data and restrict access to authorised operations.

### Database and Storage

PostgreSQL stores application information, including:

- User records
- Training modules
- Training content
- Scenarios and hazards
- Assessments and questions
- Assessment responses
- Training progress
- Certification-related records

Supabase provides the production PostgreSQL database and storage services used by the application.

Supabase Storage is used for user profile images. The avatar bucket is private, with access handled through the authenticated backend.

---

## Production Deployment

KISTS uses the following services for its production environment:

| Component | Platform |
|---|---|
| Frontend hosting | Vercel |
| Backend hosting | Render |
| PostgreSQL database | Supabase |
| File storage | Supabase Storage |
| Source code management | GitHub |

The frontend communicates with the deployed backend through the configured API base URL.

The backend connects to the production PostgreSQL database using securely configured environment variables.

Production configuration and credentials are maintained through the respective hosting services rather than being stored in the source code.

### Production Environment Configuration

The frontend uses:

```text
VITE_API_BASE_URL
```

This variable specifies the backend API origin used by the production frontend.

Production environment variables and private credentials must be configured through the hosting platforms.

---

## Getting Started

### Prerequisites

Before running KISTS locally, ensure that you have:

- Node.js 22.12.0 or newer
- npm
- Windows PowerShell (for the provided local PostgreSQL startup script)
- Git (if cloning the repository)

### 1. Clone the Repository

```bash
git clone https://github.com/FerojTamang/kernitect-kists.git
```

Navigate into the project directory:

```bash
cd kernitect-kists
```

### 2. Install Dependencies

Install the project dependencies from the root directory:

```powershell
npm.cmd ci
```

KISTS uses npm Workspaces to manage the frontend and backend applications.

### 3. Configure Environment Variables

The repository provides the following environment example files:

- `client/.env.example`
- `server/.env.example`

Review these files and configure the required local environment settings.

The local PostgreSQL startup script creates or updates the ignored `server/.env.local` configuration for the project-owned database connection.

Do not commit `.env`, `.env.local`, database credentials, API keys, Supabase service role keys, or other sensitive configuration values to version control.

### 4. Start the Local PostgreSQL Database

KISTS provides a PowerShell script to start its configured local PostgreSQL instance.

Run:

```powershell
npm.cmd run db:local:start
```

The project-owned PostgreSQL setup uses a local database configuration and does not require modifying an existing PostgreSQL Windows service.

### 5. Run Database Migrations

Apply the database migrations:

```powershell
npm.cmd run db:migrate
```

### 6. Seed the Development Database

Populate the local development database:

```powershell
npm.cmd run db:seed
```

### 7. Set Up Demo Authentication

Run the local demo authentication setup:

```powershell
npm.cmd run auth:demo
```

This prepares the configured local authentication demo environment.

### 8. Start the Backend

Open a terminal in the project root directory and run:

```powershell
npm.cmd run dev:server
```

The backend development command also starts the configured local PostgreSQL instance before launching the server.

### 9. Start the Frontend

Open a second terminal in the project root directory and run:

```powershell
npm.cmd run dev:client
```

Follow the terminal output for the local frontend and backend URLs.

**Windows note:** If PowerShell blocks the `npm` command because of script execution restrictions, use `npm.cmd` as shown in the examples.

---

## Database Management

KISTS provides scripts for managing the local development database.

| Operation | Command |
|---|---|
| Start local PostgreSQL | `npm.cmd run db:local:start` |
| Run migrations | `npm.cmd run db:migrate` |
| Seed database | `npm.cmd run db:seed` |
| Run database tests | `npm.cmd run test:db` |
| Reset database | `npm.cmd run db:reset` |

**Warning:** Database reset operations may remove existing data. Use them only in an appropriate local development or test environment. Never run destructive database commands against production.

For additional database instructions, refer to:

- `database/README.md`
- `docs/database.md`

---

## Build and Code Quality

### Build the Application

Build the frontend and backend workspaces:

```powershell
npm.cmd run build
```

### Type Checking

Run project-wide TypeScript checks:

```powershell
npm.cmd run typecheck
```

### Linting

Run ESLint:

```powershell
npm.cmd run lint
```

### Formatting

Check code formatting:

```powershell
npm.cmd run format:check
```

Format project files:

```powershell
npm.cmd run format
```

---

## Testing

KISTS includes automated tests to verify application functionality, backend behaviour, authentication, database operations, and frontend interactions.

### Run Server Tests

```powershell
npm.cmd test
```

### Run Authentication Tests

```powershell
npm.cmd run test:auth
```

### Run Database Tests

```powershell
npm.cmd run test:db
```

### Run Frontend End-to-End Tests

Before running browser tests for the first time, install the required Playwright Chromium browser:

```powershell
npm.cmd exec playwright -- install chromium
```

Run the frontend end-to-end tests:

```powershell
npm.cmd run test:frontend
```

### Recorded Project Testing Results

The project testing evidence recorded:

- **77 passing server and integration tests**
- **48 passing frontend end-to-end tests**

These figures represent recorded project testing results and are not a guarantee of the current test count.

---

## Security and Access Control

KISTS incorporates security measures to protect application functionality and user information.

These include:

- Server-side authentication.
- Role-based access restrictions.
- Backend authorisation for protected operations.
- Record-ownership checks where required.
- Secure handling of application configuration and credentials.
- Protected access to user profile images and other private resources.
- HTTPS communication in the production environment.

Environment variables, database credentials, API keys, service role keys, and other sensitive information must never be committed to version control.

---

## Project Structure

The repository is organised into the following main directories:

```text
kists/
│
├── client/
│   ├── public/
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── src/
│   ├── test/
│   ├── certs/
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── migrations/
│   ├── scripts/
│   ├── seeds/
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   ├── authentication.md
│   └── database.md
│
├── package.json
├── package-lock.json
├── playwright.config.ts
└── README.md
```

---

## Project Scope and Future Development

The completed project focuses on browser-based workplace safety training, interactive 360° scenarios, final assessments, training assignments, progress tracking, and digital certification.

Dedicated virtual reality headset integration is outside the current implemented scope and may be considered for future development.

---

## Project Team

**Team:** Kernitect

**Product:** KISTS — Kernitect Interactive Safety Training System

**Tagline:** People | Safety | Progress

---

## Acknowledgements

Developed as part of the **CET257 Enterprise Project**, incorporating requirements analysis, client consultation, system design, iterative development, implementation, testing, documentation, and project evaluation.

**Kernitect — People | Safety | Progress**
