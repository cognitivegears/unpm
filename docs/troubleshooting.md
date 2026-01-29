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

## Lockfile conflicts

If you have both `package-lock.json` and `pnpm-lock.yaml`:

```bash
unpm migrate
```

This properly converts the npm lockfile to pnpm format.

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
