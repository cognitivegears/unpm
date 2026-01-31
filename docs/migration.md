# Migrating from npm

UNPM is designed as a drop-in replacement for npm. You can migrate gradually or all at once.

## Two Migration Approaches

### 1. Gradual Migration (Recommended)

Start using unpm immediately without any setup. npm and unpm work interchangeably:

```bash
# Use unpm for secure installs
unpm install lodash

# Team members without unpm can still use npm
npm install express

# Both lockfiles stay in sync automatically
unpm add axios
```

**How it works:**
- Before migration, UNPM syncs with `package-lock.json`
- Each unpm command: imports package-lock.json → runs securely → exports back
- npm commands work normally with the same package-lock.json
- All UNPM security features (script blocking, release age) are active

When your team is ready to fully commit:

```bash
unpm migrate
```

### 2. Immediate Migration

Convert your project all at once:

```bash
unpm migrate
```

This will:
1. Convert `package-lock.json` to `pnpm-lock.yaml`
2. Delete `package-lock.json`
3. Set `packageManager` field in package.json (for corepack)
4. Add preinstall script to block npm
5. Create `.pnpmrc` with secure defaults
6. Initialize LavaMoat configuration
7. Install dependencies securely

### Migration Options

```bash
# Preview changes without applying them
unpm migrate --dry-run

# Skip LavaMoat configuration
unpm migrate --skip-lavamoat
```

## Pre-Migration vs Post-Migration

| Aspect | Pre-Migration | Post-Migration |
|--------|---------------|----------------|
| Lockfile | `package-lock.json` | `pnpm-lock.yaml` |
| npm commands | Work normally | Blocked with helpful message |
| unpm commands | Sync with npm lockfile | Use pnpm lockfile directly |
| Team adoption | Gradual (optional) | Required |
| Performance | Slight overhead from sync | Full pnpm speed |

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

### Before Migration

UNPM automatically syncs lockfiles in pre-migration mode:

```bash
# You have: package-lock.json
unpm install lodash
# Behind the scenes:
# 1. pnpm import (creates temp pnpm-lock.yaml)
# 2. pnpm add lodash --ignore-scripts
# 3. Export back to package-lock.json
# 4. Delete temp pnpm-lock.yaml
# Result: Only package-lock.json exists, npm still works
```

### After Migration

After running `unpm migrate`:
- `pnpm-lock.yaml` is the only lockfile
- `package-lock.json` is deleted
- npm install/update commands are blocked with a helpful message:
  ```
  Use unpm or pnpm instead of npm
  ```

### What Migration Creates

The `unpm migrate` command creates/modifies:

1. **`pnpm-lock.yaml`** - Converted from package-lock.json
2. **`packageManager` field** - For corepack enforcement
   ```json
   {
     "packageManager": "pnpm@9.15.0"
   }
   ```
3. **`preinstall` script** - Blocks npm with clear message
   ```json
   {
     "scripts": {
       "preinstall": "node -e \"if(!process.env.npm_execpath?.includes('pnpm')){console.error('Use unpm or pnpm instead of npm');process.exit(1)}\""
     }
   }
   ```
4. **`.pnpmrc`** - Secure pnpm defaults for direct pnpm usage
   ```ini
   ignore-scripts=true
   minimum-release-age=2d
   ```

### Reverting Migration

To revert to npm-only workflow:

```bash
# Remove pnpm-lock.yaml (triggers pre-migration mode)
rm pnpm-lock.yaml

# Remove the blocking preinstall script
# Edit package.json to remove "preinstall" from scripts

# Generate fresh package-lock.json
npm install
```
