# KISTS — Kernitect Interactive Safety Training System

**People | Safety | Progress**

KISTS (Kernitect Interactive Safety Training System) is a browser-based workplace safety training platform developed by **Team Kernitect** as part of the CET257 Enterprise Project. The system provides interactive safety learning experiences designed to help trainees understand workplace hazards, practise safe working procedures, complete assessments, and track their training progress.

## Project Overview

KISTS provides structured training through two safety modules:

- **Manual Handling Safety** — interactive learning content and 360° workplace scenarios focused on safe manual handling practices.
- **Forklift & Pedestrian Safety** — interactive learning content and 360° workplace scenarios focused on forklift operations, pedestrian awareness, and workplace safety.

Each module follows a structured learning journey:

**Learning Content → Interactive 360° Scenario → Final Assessment**

The platform also supports training progress tracking, assessment records, and digital certification based on the completion of the required training and assessment criteria.

## Key Features

- **Two Safety Training Modules:** Manual Handling and Forklift & Pedestrian Safety.
- **Interactive 360° Scenarios:** Five-point 360° scenario experiences in both modules.
- **Final Assessments:** Assessment activities to evaluate trainees' understanding of the learning content.
- **Progress Tracking:** Records training progress and completion status.
- **Digital Certification:** Supports certification based on the required training and assessment completion criteria.
- **User Authentication:** Supports controlled access to the application's protected features.
- **Backend Access Controls:** Applies server-side authorisation and record-ownership checks to protect user data.
- **Responsive Web Interface:** Provides a browser-based interface for accessing the training system.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express.js
- TypeScript

### Database
- PostgreSQL

### Testing
- Automated server and integration tests
- Frontend end-to-end tests

## System Architecture

KISTS uses a frontend–backend–database architecture.

1. **Frontend:** React and TypeScript provide the user interface for accessing training content, interactive scenarios, assessments, and progress information.
2. **Backend:** Node.js and Express.js handle application APIs, authentication, authorisation, progression, assessment processing, and certification-related operations.
3. **Database:** PostgreSQL stores application data, including user information, training progress, assessment records, and certification-related information.

The frontend communicates with the backend through API requests, while the backend manages data operations and enforces server-side access controls.

## Getting Started

### Prerequisites

Before running the project, ensure that you have the following installed:

- Node.js and npm
- PostgreSQL, configured according to the project's local database setup
- Git, if cloning the repository

### Installation

1. Clone the repository or download the project source code.
2. Open a terminal in the project root directory.
3. Install the project dependencies:

   ```bash
   npm install
   ```

4. Configure the required environment variables and database connection settings using the project's existing environment configuration or setup instructions.
5. Ensure the local PostgreSQL database is configured and available.

### Running the Application

Use the development scripts defined in the project's `package.json`.

For the frontend, run:

```bash
npm run dev
```

For the backend and its associated local development setup, use the project's configured server command:

```bash
npm run dev:server
```

Follow the terminal output for the local application URL and any database setup instructions.

**Note:** The exact commands and environment configuration should be checked against the current repository's `package.json` and database setup scripts before running the application.

## Testing

The project includes automated testing to verify application behaviour and integration.

The final project testing evidence recorded:

- **77 server/integration tests passing**
- **48 frontend end-to-end tests passing**

These tests support verification of the implemented functionality and the interaction between the application's components. Refer to the project's test scripts and test files for the available test commands and coverage.

## Security and Access Control

KISTS incorporates server-side authentication and authorisation controls. Protected operations are handled by the backend, with access restrictions and record-ownership checks applied where required.

The database and application configuration should be maintained securely. Environment variables and credentials must not be committed to version control.

## Project Scope

The completed project focuses on browser-based workplace safety training, interactive 360° scenarios, final assessments, progress tracking, and digital certification.

Dedicated virtual reality headset integration is outside the current implemented scope and may be considered for future development.

## Project Team

**Team:** Kernitect

**Product:** KISTS — Kernitect Interactive Safety Training System

**Tagline:** People | Safety | Progress

## Acknowledgements

Developed as part of the CET257 Enterprise Project, incorporating requirements analysis, client consultation, iterative development, testing, documentation, and project evaluation.

