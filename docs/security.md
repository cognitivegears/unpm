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

## Trust Policy

UNPM supports pnpm's trust policy feature to prevent version downgrades that could introduce malicious code:

```bash
# Default: trust policy is set to no-downgrade
unpm install

# Disable trust policy (not recommended)
unpm install --no-trust-policy

# Set custom ignore-after duration (packages unchanged longer are exempt)
unpm install --trust-policy-ignore-after=1y

# Exclude specific packages from trust policy
unpm install --trust-policy-exclude=my-internal-pkg
```

### Configuration

```json
{
  "unpm": {
    "trustPolicy": "no-downgrade",
    "trustPolicyIgnoreAfter": "1y",
    "trustPolicyExclude": ["internal-pkg"]
  }
}
```

## Blocking Exotic Subdependencies

Exotic subdependencies (git URLs, tarballs) bypass registry security and can introduce unvetted code:

```bash
# Enable blocking of exotic subdeps
unpm install --block-exotic-subdeps

# Disable blocking
unpm install --no-block-exotic-subdeps
```

This feature is opt-in. Enable it during migration:

```bash
unpm migrate --block-exotic-subdeps
```

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
| Unreviewed build scripts | Warning | Fail |
| Audit failures | Warning | Fail (if auditAfterInstall enabled) |

## DepGate Ephemeral Proxy Mode

UNPM can route install-family commands (`install`, `ci`, `add`, `update`) through a short-lived DepGate proxy without writing npm/pnpm registry config files.

### Requirements

Use a DepGate build that supports prepare mode:

```bash
depgate run --prepare --manager <manager> --log-level WARNING
```

At the time of writing, this is available from DepGate's wrappers work and newer releases that include it.
Reference branch: [cognitivegears/depgate `feature/wrappers`](https://github.com/cognitivegears/depgate/tree/feature/wrappers).

### Usage

```bash
unpm --depgate install
unpm --depgate --depgate-config ./depgate-policy.yml --depgate-decision-mode warn add lodash
```

### Troubleshooting

- `DepGate binary "... was not found"`: install DepGate and/or set `--depgate-bin`.
- `Timed out waiting for DepGate prepare output`: verify your DepGate version supports `run --prepare`.
- `DepGate prepare output was not valid JSON` or `missing proxy settings`: verify DepGate is running in prepare mode and no wrapper script is modifying stdout.
- `DepGate exited before sending prepare output`: inspect DepGate stderr and verify policy/config values are valid.
- `DepGate does not support manager "... in prepare mode"`: upgrade DepGate to a build with wrapper support for that manager.

### Trust Model

The `--depgate-bin` flag (or `depgate.binaryPath` config) specifies the DepGate binary that UNPM will execute. This binary controls the ephemeral proxy and provides environment variables and arguments that are applied to the package manager child process. Only use a DepGate binary you trust — a compromised binary could set arbitrary environment variables (e.g., `NODE_OPTIONS`) on the package manager process.

### Strict Dep Builds

In strict mode, installation fails if any packages have build scripts that are not in the allowlist:

```bash
# This will fail if esbuild is not in allowlist
unpm --strict install

# To fix, add the package to allowlist:
unpm allow-scripts add esbuild
```

### Configuration

You can configure strict mode in `package.json`:

```json
{
  "unpm": {
    "strict": {
      "enabled": true,
      "minReleaseAgeDays": 7,
      "strictDepBuilds": true,
      "blockAuditFailures": true,
      "auditLevel": "high"
    }
  }
}
```

## Post-Install Audit

UNPM can run a security audit automatically after install:

```json
{
  "unpm": {
    "auditAfterInstall": true,
    "auditLevel": "high"
  }
}
```

In strict mode with `blockAuditFailures: true`, audit failures will cause the install to fail.

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

## Lockfile Security

### Bidirectional Sync (Pre-Migration)

Before running `unpm migrate`, UNPM syncs with npm's `package-lock.json` to allow gradual adoption:

```
unpm install lodash
    │
    ▼
1. pnpm import (package-lock.json → temp pnpm-lock.yaml)
    │
    ▼
2. pnpm add lodash --ignore-scripts --minimum-release-age=2d
    │
    ▼
3. Export back to package-lock.json
    │
    ▼
4. Delete temp pnpm-lock.yaml
```

**Security is preserved during sync:**
- `--ignore-scripts` is always applied
- `--minimum-release-age` is enforced
- All other security features remain active

### Strict Mode Sync Behavior

In strict mode, lockfile sync errors are fatal (not warnings):

```bash
# In strict mode, sync failures block the command
UNPM_STRICT=true unpm install
# Error: Could not import package-lock.json. Continuing with fresh resolution.
# In strict mode, lockfile sync must succeed.
```

### Post-Migration Lockfile

After `unpm migrate`:
- `pnpm-lock.yaml` persists as the migration marker
- npm is blocked via multiple mechanisms:
  - `engines.npm` constraint in package.json
  - `npm-shrinkwrap.json` triggers engine check before node_modules parsing
  - preinstall script as backup
- `.pnpmrc` is created with secure defaults for direct pnpm usage

## LavaMoat Integration

UNPM integrates with [@lavamoat/allow-scripts](https://github.com/LavaMoat/LavaMoat/tree/main/packages/allow-scripts) for managing script permissions. If you already use LavaMoat, UNPM will respect your existing configuration.

Initialize LavaMoat configuration:

```bash
unpm setup-lavamoat
```

### Reviewing Script Allowlist

Review all packages with install scripts and their allowlist status:

```bash
unpm allow-scripts review
```

This shows:
- **Allowed**: Packages with scripts that are in the allowlist
- **Blocked**: Packages with scripts that are NOT in the allowlist
- **Stale**: Packages in the allowlist that are not installed or have no scripts

## Package Provenance

Check package attestations and provenance information:

```bash
# Show provenance info for a package
unpm provenance lodash
unpm prov react@18.2.0
```

This displays:
- Repository and homepage links
- Package maintainers
- Publisher information
- Integrity hashes
- Attestations (if published with provenance)
- Signatures
- Security summary

## Security Doctor

Run security-focused diagnostics:

```bash
unpm doctor --security
```

This checks:
- Trust policy configuration
- Minimum release age settings
- Lockfile presence and git status
- Stale allowlist entries
- Exotic sources in direct dependencies
- Migration status
- npm blocking mechanisms
