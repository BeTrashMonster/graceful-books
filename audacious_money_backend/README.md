# Audacious Money Backend

Backend API for the Audacious Money platform, built with Bun and Hono.

## Prerequisites

- **Bun** runtime (v1.0 or higher) - [Install Bun](https://bun.sh)
- **PostgreSQL** 15+ (running locally or remotely)
- **Database** `audacious_money` created and accessible

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set your database connection:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/audacious_money
```

### 3. Run Migrations

Set up the database schema:

```bash
# Check migration status
bun run migrate:status

# Run all pending migrations
bun run migrate:up
```

### 4. Start Development Server

```bash
bun run dev
```

The API will be available at `http://localhost:3001`

## Database Migrations

The migration system provides version-controlled database changes with transaction safety and automatic rollback.

### Migration Commands

```bash
# Run all pending migrations
bun run migrate:up

# Check migration status
bun run migrate:status

# Show rollback instructions
bun run migrate:down
```

### Creating a New Migration

1. Create a new SQL file in `src/db/migrations/`:
   ```bash
   touch src/db/migrations/002_add_feature.sql
   ```

2. Write your SQL migration:
   ```sql
   -- 002_add_feature.sql
   CREATE TABLE new_feature (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );
   ```

3. Run the migration:
   ```bash
   bun run migrate:up
   ```

See [src/db/migrations/README.md](src/db/migrations/README.md) for detailed migration documentation.

## Project Structure

```
audacious_money_backend/
├── src/
│   ├── db/
│   │   ├── migrate.ts          # Migration system
│   │   └── migrations/         # SQL migration files
│   │       ├── README.md       # Migration documentation
│   │       └── 001_initial_schema.sql
│   ├── routes/                 # API route handlers (to be added)
│   ├── middleware/             # Middleware functions (to be added)
│   ├── utils/                  # Utility functions (to be added)
│   └── index.ts                # Application entry point (to be added)
├── .env                        # Environment variables (not committed)
├── .env.example                # Example environment variables
├── package.json                # Project dependencies and scripts
└── README.md                   # This file
```

## Migration System Features

### Transaction Safety
All migrations run in database transactions. If any part of a migration fails, all changes are automatically rolled back.

### Audit Trail
Every migration execution is logged in the `schema_migrations` table with:
- Version number
- Migration name
- Execution timestamp
- Success/failure status
- Error message (if failed)

### Idempotency
Migrations are tracked to prevent running the same migration twice. The system checks the `schema_migrations` table before executing.

### Security Best Practices
- Uses parameterized queries (via PostgreSQL client)
- No SQL injection vulnerabilities
- Transactions ensure atomic operations
- Failed migrations logged for audit

## Database Connection

The system uses the PostgreSQL client from the `pg` package. Connection string format:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Example:
```
DATABASE_URL=postgresql://postgres:BEtheCHANG3!@localhost:5432/audacious_money
```

For production with SSL:
```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

## Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/audacious_money` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |

See `.env.example` for all available configuration options.

## Development Workflow

1. **Make database changes** - Create a new migration file
2. **Test locally** - Run `bun run migrate:status` and `bun run migrate:up`
3. **Verify changes** - Connect to database and verify schema
4. **Commit migration** - Add migration file to git
5. **Deploy** - Migrations run automatically in CI/CD or manually in production

## Troubleshooting

### "bun: command not found"

Install Bun runtime:
```bash
curl -fsSL https://bun.sh/install | bash
```

Or use npm/npx (slower):
```bash
npm install -g bun
```

### "Connection refused" or "Database does not exist"

1. Ensure PostgreSQL is running:
   ```bash
   # Windows (if installed as service)
   net start postgresql

   # Check connection
   psql -U postgres -l
   ```

2. Create the database if it doesn't exist:
   ```bash
   createdb audacious_money
   # or
   psql -U postgres -c "CREATE DATABASE audacious_money;"
   ```

3. Verify credentials in `.env` file

### "Migration failed" errors

1. Check the error in migration output
2. View failed migrations:
   ```bash
   bun run migrate:status
   ```
3. Fix the issue in the migration file
4. Delete the failed migration record:
   ```sql
   DELETE FROM schema_migrations WHERE version = '002' AND success = false;
   ```
5. Re-run migrations:
   ```bash
   bun run migrate:up
   ```

### "schema_migrations table does not exist"

The table is created automatically on first run. If you encounter this error:
```bash
bun run migrate:status
```

This will initialize the migration system.

## Testing

To test the migration system without running the full backend:

```bash
# Check migration status (safe, read-only)
bun run migrate:status

# Dry run by reviewing migration files
cat src/db/migrations/001_initial_schema.sql
```

## Next Steps

After setting up migrations:

1. **Task 0.4** - Set up the Hono application server
2. **Task 0.5** - Implement JWT authentication middleware
3. **Task 0.6** - Add input validation system
4. **Phase 1** - Build authentication endpoints

See [Roadmaps/Roadmap_Tasks.md](../Roadmaps/Roadmap_Tasks.md) for the full development roadmap.

## Security Notes

- Never commit `.env` files (already in `.gitignore`)
- Rotate JWT secrets between development and production
- Use strong database passwords (not the example password!)
- Enable SSL for production database connections
- Review migration files before running in production

## Support

For questions or issues:
- Review the migration documentation: `src/db/migrations/README.md`
- Check the roadmap: `Roadmaps/Roadmap_Tasks.md`
- Review security requirements: `Roadmaps/agent_review_checklist.md`

## License

See LICENSE file in repository root.
