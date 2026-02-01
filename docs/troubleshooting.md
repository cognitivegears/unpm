# Troubleshooting

Common issues and solutions when using UNPM.

## "pnpm: command not found"

UNPM requires pnpm to be installed. Install it with:

```bash
npm install -g pnpm
```

Or with corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Package fails to build

Some packages require running install scripts. Add them to the allowlist:

```bash
unpm allow-scripts add <package-name>
unpm install
```

Common packages that need script permissions:
- `esbuild` - Binary download
- `sharp` - Native image processing
- `node-sass` - Sass compilation
- `sqlite3` - Native database driver
- `bcrypt` - Password hashing

## "Package does not meet minimumReleaseAge constraint"

This means the package version is too new. Options:

1. **Wait** for the package to age past the minimum (default: 2 days)

2. **Allow the specific package**:
   ```bash
   unpm install --allow-recent=<package> <package>
   ```

3. **Lower the minimum age** (not recommended for production):
   ```bash
   unpm install --min-release-age=1h <package>
   ```

4. **Disable age check** (not recommended):
   ```bash
   unpm install --no-min-release-age <package>
   ```

## "dlx is blocked"

The `dlx` command is blocked by default for security. To allow it:

```bash
unpm dlx --allow-dlx <package> [args...]
```

In strict mode, `dlx` is completely blocked.

## "explore is blocked"

The `explore` command is blocked by default for security. To allow it:

```bash
unpm explore --allow-explore <package>
```

In strict mode, `explore` is completely blocked.

## "--force-scripts is blocked in strict mode"

In strict mode, `--force-scripts` is not allowed. Options:

1. Run without strict mode
2. Add specific packages to the allowlist instead:
   ```bash
   unpm allow-scripts add <package>
   ```

## Lockfile Issues

### "Use unpm or pnpm instead of npm"

This message appears after running `unpm migrate`. Your project is now in post-migration mode:

```bash
# Use unpm or pnpm instead
unpm install lodash
# or
pnpm add lodash
```

To revert to npm (not recommended):
```bash
rm pnpm-lock.yaml
rm npm-shrinkwrap.json
rm .npmrc  # or edit to remove engine-strict=true
# Edit package.json to remove "engines.npm" and "preinstall" script
npm install
```

### Lockfile sync warnings

In pre-migration mode, you may see sync warnings:

```
Warning: Could not import package-lock.json. Continuing with fresh resolution.
```

This is usually harmless—pnpm will resolve dependencies fresh. To fix:
1. Ensure `package-lock.json` is valid JSON
2. Check for npm version compatibility issues
3. Run `npm install` to regenerate a clean lockfile

### Lockfile sync errors in strict mode

In strict mode, sync warnings become errors:

```
Error: Could not import package-lock.json. Continuing with fresh resolution.
In strict mode, lockfile sync must succeed.
```

Options:
1. Fix the underlying lockfile issue
2. Run without strict mode for this operation
3. Run `unpm migrate` to switch to pnpm-only mode

### Both lockfiles exist

If you have both `package-lock.json` and `pnpm-lock.yaml`:

```bash
# Option 1: Complete migration (recommended)
unpm migrate

# Option 2: Remove pnpm lockfile to stay in pre-migration mode
rm pnpm-lock.yaml
```

The presence of `pnpm-lock.yaml` indicates post-migration mode.

## Command not working as expected

Use verbose mode to see what commands are being executed:

```bash
unpm -v install lodash
# or
unpm --verbose install lodash
```

## Debug mode

For detailed debugging information:

```bash
DEBUG=* unpm install
```

## Getting Help

- Run `unpm --help` for command help
- Run `unpm <command> --help` for command-specific help
- File issues at [GitHub](https://github.com/depgate/unpm/issues)
