# Project Database Migrations

This directory contains all database migrations for the project database (`.autarch/project.db`).

## Structure

- Each migration is in its own numbered file: `NNNN-descriptive-name.ts`
- The `index.ts` orchestrator imports and executes all migrations in order
- Migrations are run sequentially on every database initialization

## Naming Convention

Files use 4-digit zero-padded numbering with readable descriptive names:

```
0000-project-meta.ts
0001-channels.ts
0002-workflows.ts
...
0031-pulse-id-sessions-column.ts
```

## Adding a New Migration

1. **Create a new file** with the next sequential number:
   ```
   0032-your-migration-name.ts
   ```

2. **Export a migrate function** with this exact signature:
   ```typescript
   import type { Kysely } from "kysely";
   import type { ProjectDatabase } from "../types";

   export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
     // Your migration logic here
   }
   ```

3. **Make it idempotent** - Migrations may run multiple times:
   - Use `.ifNotExists()` for `createTable` and `createIndex`
   - Wrap `alterTable` column additions in try/catch:
     ```typescript
     try {
       await db.schema
         .alterTable("table_name")
         .addColumn("column_name", "type")
         .execute();
     } catch {
       // Column already exists, ignore
     }
     ```

4. **Add the import and call** in `index.ts`:
   ```typescript
   // Add to imports section
   import { migrate as migrate0032YourMigration } from "./0032-your-migration-name";

   // Add to migrateProjectDb() function (at the end)
   await migrate0032YourMigration(db);
   ```

## Migration Types

### Table Creation
Use `ifNotExists()` for idempotency:
```typescript
await db.schema
  .createTable("table_name")
  .ifNotExists()
  .addColumn("id", "text", (col) => col.primaryKey())
  // ... more columns
  .execute();
```

### Column Addition
Wrap in try/catch for idempotency:
```typescript
try {
  await db.schema
    .alterTable("table_name")
    .addColumn("new_column", "text")
    .execute();
} catch {
  // Column already exists, ignore
}
```

### Complex Schema Changes (e.g., removing NOT NULL)
SQLite doesn't support ALTER COLUMN. Use table recreation:
```typescript
import { sql } from "kysely";

// Disable foreign keys during migration
await sql`PRAGMA foreign_keys = OFF`.execute(db);
try {
  // 1. Rename old table
  // 2. Create new table with correct schema
  // 3. Copy data
  // 4. Drop old table
  // 5. Recreate indexes
} finally {
  await sql`PRAGMA foreign_keys = ON`.execute(db);
}
```

See `0029-remove-review-comment-constraints.ts` for a complete example.

## Important Notes

- **Execution order matters** - Migrations run in numerical order (0000 first)
- **Never modify existing migrations** - Create a new migration instead
- **All migrations run on every startup** - They must be idempotent
- **No rollback support** - Migrations are forward-only
- **Update types** - If adding columns, also update `../types.ts`
