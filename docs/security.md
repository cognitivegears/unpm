# Security Features

UNPM provides multiple layers of security to protect against supply chain attacks.

## Script Blocking

By default, UNPM blocks install scripts (preinstall, postinstall, etc.) from dependencies. This protects against supply chain attacks where malicious packages execute code during installation.

When a package tries to run a blocked script, you'll see:

```
Warning: Package "esbuild" wants to run install scripts but is not in allowlist.
To allow this package's scripts, run:
  unpm allow-scripts add esbuild
```

### Allowing Package Scripts

Some packages legitimately need to run install scripts (e.g., `esbuild`, `sharp`, `node-sass`). You can allow them:

```bash
# Add a package to the allowlist
unpm allow-scripts add esbuild

# Add multiple packages
unpm allow-scripts add esbuild sharp node-sass

# List allowed packages
unpm allow-scripts list

# Remove a package from the allowlist
unpm allow-scripts remove esbuild
```

The allowlist is stored in your `package.json` under `lavamoat.allowScripts`:

```json
{
  "lavamoat": {
    "allowScripts": {
      "esbuild": true,
      "sharp": true
    }
  }
}
```

### Force Scripts

If you need to allow all dependency scripts (not recommended), use `--force-scripts`:

```bash
unpm install --force-scripts
```

This flag is blocked in strict mode.

## Minimum Release Age

UNPM enforces a minimum release age for packages by default (2 days). This protects against supply chain attacks where malicious packages are published and quickly used before detection.

```bash
# Install with default 2-day minimum age
unpm install lodash

# Override minimum release age
unpm install --min-release-age=4h lodash    # 4 hours
unpm install --min-release-age=1w lodash    # 1 week
unpm install --min-release-age=30m lodash   # 30 minutes

# Allow a specific package regardless of age (e.g., for urgent security fix)
unpm install --allow-recent=critical-fix critical-fix

# Disable minimum release age entirely (not recommended)
unpm install --no-min-release-age lodash
```

### Duration Formats

- `m` or `min` - minutes (e.g., `30m`)
- `h`, `hr`, or `hours` - hours (e.g., `4h`)
- `d` or `days` - days (e.g., `2d`)
- `w` or `weeks` - weeks (e.g., `1w`)

## Strict Mode

For CI/CD environments and high-security use cases, UNPM provides strict mode which enables additional protections:

```bash
# Enable via CLI flag
unpm --strict install

# Enable via environment variable
UNPM_STRICT=true unpm install
```

### Strict Mode Enforcements

| Protection | Default | Strict Mode |
|------------|---------|-------------|
| Minimum release age | 2 days | 7 days |
| dlx command | Requires `--allow-dlx` | Completely blocked |
| explore command | Requires `--allow-explore` | Completely blocked |
| --force-scripts | Allowed | Blocked |
| ci frozen lockfile | Default | Enforced |

### Configuration

You can configure strict mode in `package.json`:

```json
{
  "unpm": {
    "strict": {
      "enabled": true,
      "minReleaseAgeDays": 7
    }
  }
}
```

## dlx Security

The `dlx` command (download and execute) is blocked by default because it can execute arbitrary code from packages:

```bash
# This will be blocked
unpm dlx cowsay hello

# To allow dlx, use --allow-dlx
unpm dlx --allow-dlx cowsay hello
```

In strict mode, `dlx` is completely blocked even with `--allow-dlx`.

## Explore Command Security

The `explore` command opens a subshell in a package's directory, which is a security risk:

```bash
# This will be blocked
unpm explore lodash

# To allow explore, use --allow-explore
unpm explore --allow-explore lodash
```

In strict mode, `explore` is completely blocked even with `--allow-explore`.

## Unused Dependency Detection

UNPM integrates with [knip](https://knip.dev/) to detect unused dependencies. Unused dependencies increase your attack surface and should be removed.

```bash
# Check for unused dependencies
unpm unused

# Remove unused dependencies automatically
unpm unused --fix

# Full analysis (unused files, exports, types, etc.)
unpm unused --everything

# Full analysis with automatic fixes
unpm unused --everything --fix
```

If knip is installed locally as a dev dependency, UNPM uses it. Otherwise, it runs via `pnpm dlx` automatically—no installation required.

### Why Remove Unused Dependencies?

- **Reduced attack surface**: Each dependency is a potential vector for supply chain attacks
- **Smaller install size**: Faster CI/CD pipelines and deployments
- **Cleaner codebase**: Easier to audit and maintain
- **Security hygiene**: Part of a defense-in-depth strategy

## LavaMoat Integration

UNPM integrates with [@lavamoat/allow-scripts](https://github.com/LavaMoat/LavaMoat/tree/main/packages/allow-scripts) for managing script permissions. If you already use LavaMoat, UNPM will respect your existing configuration.

Initialize LavaMoat configuration:

```bash
unpm setup-lavamoat
```
