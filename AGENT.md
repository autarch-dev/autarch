# Autarch Development Guidelines

This document outlines architectural guidelines for AI agents and developers working on this codebase.

## Core Principles

- **Type-safety**: Use Zod schemas for API contracts, shared between backend and frontend via `src/shared/`
- **No `as` casting**: Avoid type assertions; if unavoidable, add a comment explaining why
- **Code splitting**: Avoid god files; use folder-based component organization (e.g., `Component/index.tsx`, `Component/SubComponent.tsx`)
- **ShadCN components**: Use existing UI components from `src/components/ui/` or source new ones via `bunx --bun shadcn@latest`
- **Feature-based structure**: Organize by feature (e.g., `src/features/onboarding/`)
- **Readability/maintainability**: This will grow into a large application; prioritize clarity
- **Principle of least surprise**: Use predictable patterns and naming conventions
- **Pragmatic SOLID**: Good architecture without over-engineering

## Project Structure

```
src/
├── backend/           # Bun server, routes, services
│   ├── routes/        # API route handlers (code-split by domain)
│   └── services/      # Business logic and data access
├── shared/            # Code shared between frontend and backend
│   └── schemas/       # Zod schemas for API contracts
├── features/          # Feature-based frontend modules
│   └── [feature]/
│       ├── index.ts           # Public exports
│       ├── components/        # UI components
│       ├── hooks/             # React hooks and state
│       └── api/               # API client functions
├── components/        # Shared UI components (ShadCN)
│   └── ui/
└── lib/               # Shared utilities
```

## Technology Stack

- **Runtime**: Bun (not Node.js, npm, or pnpm)
- **Frontend**: React 19, wouter (routing), zustand (state), react-hook-form
- **Backend**: Bun.serve() with HTML imports
- **Database**: SQLite via Kysely + bun:sqlite
- **Styling**: Tailwind CSS v4, ShadCN components
- **Validation**: Zod schemas (shared between client/server)
