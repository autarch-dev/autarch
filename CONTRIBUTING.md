# Contributing to Autarch

Thanks for your interest in contributing to Autarch! Whether you're fixing a bug, improving docs, or proposing a new feature, this guide will get you oriented.

## Getting Started

### Prerequisites

Autarch runs on [Bun](https://bun.sh). That's it — no Node.js, npm, yarn, or pnpm needed.

Install Bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/autarch.git
cd autarch

# Install dependencies
bun install

# Start the dev server (with hot reload)
bun run dev
```

The dev server runs with `--hot`, so changes are picked up automatically.

## Coding Conventions

These are the conventions that keep the codebase consistent. Follow them and your PR will have an easy review.

### Type Safety

- Use **Zod schemas** for API contracts, shared between backend and frontend via `src/shared/schemas/`
- Avoid `as` type assertions. If one is truly unavoidable, add a comment explaining why — but try harder first
- Let TypeScript's inference do the work; explicit types where they aid readability

### Project Structure

Autarch uses a **feature-based structure**. Code is organized by what it does, not what it is:

```
src/
├── backend/           # Server, routes, services
├── shared/schemas/    # Zod schemas (shared between client and server)
├── features/          # Feature modules (components, hooks, API clients)
├── components/ui/     # Shared UI components (ShadCN)
└── lib/               # Shared utilities
```

Each feature lives in `src/features/<feature>/` with its own `components/`, `hooks/`, and `api/` subdirectories as needed.

### Component Organization

Use **folder-based component organization** — not one massive file:

```
MyComponent/
├── index.tsx
├── SubComponent.tsx
└── helpers.ts
```

### Design Principles

- **Pragmatic SOLID** — Good architecture without over-engineering. If a pattern doesn't earn its complexity, skip it
- **Principle of least surprise** — Predictable naming, predictable behavior. If someone familiar with the codebase would be confused by your approach, rethink it
- **Readability over cleverness** — This will grow into a large application. Write code that's easy to read six months from now
- **Code splitting** — Avoid god files. If a file is doing too many things, break it up

## Linting and Formatting

Autarch uses [Biome](https://biomejs.dev) for linting and formatting. The configuration lives in `biome.json` and enforces:

- **Tabs** for indentation
- **Double quotes** for JavaScript/TypeScript strings
- **Automatic import organizing** — Biome sorts and groups imports for you

To lint and auto-fix locally:

```bash
bun run lint
```

This runs `biome check --write .` — it will fix what it can and report what it can't.

> **Note:** CI runs `biome ci .` (the strict, no-auto-fix variant). If `bun run lint` passes cleanly, CI will too.

## Running Tests

```bash
bun test --concurrent
```

Tests are co-located with the code they test, using a `__tests__/` directory pattern with `*.test.ts` file naming:

```
src/backend/services/
├── git.ts
└── __tests__/
    └── git.test.ts
```

## Type Checking

```bash
bun run typecheck
```

This runs `tsc --noEmit` — a full type check without emitting output files. Fix any errors before opening a PR.

## The Quality Gate

Every pull request runs through a CI quality gate. All three checks must pass:

1. **Tests** — `bun test --concurrent`
2. **Lint** — `biome ci .`
3. **Typecheck** — `tsc --noEmit`

You can run all three locally before pushing to catch issues early.

## Pull Request Process

1. **Fork** the repository and create a branch from `main`
2. **Make your changes** — keep commits focused and descriptive
3. **Run the quality gate locally** — tests, lint, typecheck
4. **Open a PR** against `main` — the [PR template](.github/PULL_REQUEST_TEMPLATE.md) will guide you through the checklist
5. **CI runs automatically** — the same quality gate described above
6. **Address feedback** — maintainers may request changes

### PR Checklist

The PR template includes a checklist. Before marking your PR as ready for review, make sure:

- [ ] Your changes follow the existing code style
- [ ] You've added tests that prove your fix or feature works
- [ ] All existing tests pass (`bun test --concurrent`)
- [ ] Linting passes (`bun run lint`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] I have read and agree to the [Contributor License Agreement](CLA.md)

## Contributor License Agreement

Before your first contribution can be merged, you'll need to agree to our [Contributor License Agreement](CLA.md). The CLA grants The Autarch Project the right to use and relicense your contributions — you keep full ownership of your work.

Agreeing is simple: by submitting a pull request, you're indicating that you've read and agree to the CLA. No separate paperwork or signature needed.

Why do we have a CLA? It gives the project flexibility to adjust licensing in the future without tracking down every past contributor. This is common practice for open-source projects.

## What Contributions Are Welcome

**All of them.** Seriously. Here's a non-exhaustive list:

- 🐛 **Bug reports and fixes** — Found something broken? File an issue or send a fix
- 📖 **Documentation** — Typos, clarifications, missing guides, better examples
- 🧪 **Test coverage** — More tests make everyone's life better
- 🎨 **UI/UX improvements** — Better interactions, accessibility, visual polish
- ⚡ **Performance** — Faster is better, especially for a local-first tool
- 🔧 **Refactoring** — Cleaner code, better abstractions, reduced complexity
- ✨ **New features** — Please open an issue first to discuss the approach before investing time in implementation
- 💡 **Feature proposals** — Have an idea? Open an issue. We'd love to hear it

## Using Issue Templates

When opening an issue, please use the appropriate template:

- **Bug reports** — Use the [Bug Report](https://github.com/autarch-dev/autarch/issues/new?template=bug_report.yml) template with reproduction steps
- **Feature requests** — Use the [Feature Request](https://github.com/autarch-dev/autarch/issues/new?template=feature_request.yml) template with a clear problem statement

Good issues make good contributions possible.

## Code of Conduct

We keep this simple: **be respectful**.

- Treat everyone with kindness and professionalism
- Assume good intent — especially in code reviews and discussions
- Constructive feedback is welcome; personal attacks are not
- Harassment, discrimination, and hostile behavior won't be tolerated

We're building something together. Act like it.

## Security

If you discover a security vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md) for details on how to report security issues.

---

Questions? Open a discussion or an issue — we're happy to help you get started.
