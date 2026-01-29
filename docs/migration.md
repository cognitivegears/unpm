# Migrating from npm

UNPM is designed as a drop-in replacement for npm. Migration is straightforward.

## Quick Migration

Simply replace `npm` with `unpm` in your commands:

```bash
# Instead of: npm install
unpm install

# Instead of: npm run build
unpm run build
```

## Automatic Migration

UNPM provides a migration command to convert existing npm projects:

```bash
unpm migrate
```

This will:
1. Convert `package-lock.json` to `pnpm-lock.yaml`
2. Initialize LavaMoat configuration
3. Add UNPM configuration to `package.json`
4. Install dependencies securely

### Migration Options

```bash
# Preview changes without applying them
unpm migrate --dry-run

# Skip LavaMoat configuration
unpm migrate --skip-lavamoat
```

## Shell Alias (Optional)

To transparently replace npm with unpm, add an alias to your shell configuration:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
alias npm='unpm'
```

After reloading your shell, all `npm` commands will automatically use unpm.

## CI/CD Migration

For CI/CD pipelines, update your scripts:

```yaml
# Before
- npm ci
- npm test

# After
- unpm ci
- unpm test
```

For enhanced security in CI, use strict mode:

```yaml
- UNPM_STRICT=true unpm ci
- unpm test
```

Or with the CLI flag:

```yaml
- unpm --strict ci
- unpm test
```

## Handling Script Errors

Some packages require running install scripts. If a build fails after migration:

```bash
# Check which packages want to run scripts
unpm allow-scripts list

# Add required packages to the allowlist
unpm allow-scripts add esbuild sharp
```

Common packages that need script permissions:
- `esbuild` - Binary download
- `sharp` - Native image processing
- `node-sass` - Sass compilation
- `sqlite3` - Native database driver
- `bcrypt` - Password hashing

## Lockfile Handling

If you have both `package-lock.json` and `pnpm-lock.yaml`:

```bash
unpm migrate
```

This properly converts the npm lockfile to pnpm format.

To keep using npm's lockfile format alongside pnpm (not recommended):

```bash
# Just install without migration
unpm install
```
