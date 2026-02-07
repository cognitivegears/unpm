# UNPM

A secure npm wrapper that protects against supply chain attacks while maintaining full npm compatibility.

## Why UNPM?

npm's default behavior allows packages to execute arbitrary scripts during installation, a vector exploited in numerous supply chain attacks. UNPM wraps npm commands and delegates to pnpm with security-first defaults:

- **Scripts blocked by default** - Dependency install scripts are blocked unless explicitly allowed
- **Minimum release age** - New packages must be at least 2 days old before installation
- **Trust policy** - Prevents version downgrades that could introduce malicious code
- **Strict mode for CI** - Enhanced protections for automated environments
- **DepGate proxy mode** - Route install traffic through a short-lived policy proxy
- **Package provenance** - Verify supply chain integrity with attestation checks
- **Gradual migration** - Use npm and unpm interchangeably before committing to full migration
- **Zero migration required** - Same commands, same flags, drop-in replacement

## Quick Start

### Install

```bash
npm install -g @depgate/unpm
```

Requires [pnpm](https://pnpm.io/) (`npm install -g pnpm`).

### Use

Replace `npm` with `unpm`:

```bash
unpm install              # Install dependencies
unpm --depgate install    # Optional: route install through DepGate proxy
unpm add lodash           # Add a package
unpm run build            # Run scripts
unpm test                 # Run tests
```

That's it. Your project is now protected.

## Key Features

### Script Blocking

Install scripts from dependencies are blocked by default:

```bash
# If a package needs scripts, allow it explicitly
unpm allow-scripts add esbuild
```

### Release Age Protection

Packages must be at least 2 days old, protecting against malicious packages being published and quickly installed:

```bash
# Override for a specific package if needed
unpm install --allow-recent=hotfix hotfix
```

### Trust Policy

Prevents version downgrades that could introduce malicious code:

```bash
unpm install                    # Trust policy enabled by default
unpm install --no-trust-policy  # Disable if needed
```

### Package Provenance

Verify supply chain integrity before installing:

```bash
unpm provenance lodash          # Check attestations and signatures
unpm prov react@18.2.0          # Alias with version
```

### Strict Mode

For CI/CD, enable strict mode for maximum security:

```bash
UNPM_STRICT=true unpm ci
# or
unpm --strict ci
```

Strict mode enforces 7-day release age, blocks `dlx`, requires frozen lockfiles, and fails on unreviewed build scripts.

### DepGate Ephemeral Proxy

UNPM can run install commands through DepGate without writing persistent registry config:

```bash
unpm --depgate install
```

Optional DepGate settings:

```bash
unpm --depgate --depgate-config ./depgate-policy.yml --depgate-decision-mode warn install
```

This mode requires a DepGate build that supports:

```bash
depgate run --prepare --manager <manager> --log-level WARNING
```

If you need it before a release including prepare mode, use the wrappers branch:
[cognitivegears/depgate `feature/wrappers`](https://github.com/cognitivegears/depgate/tree/feature/wrappers)

### Gradual Migration

UNPM supports gradual migration from npm. Before running `unpm migrate`, npm and unpm work interchangeably:

```bash
# These can be used interchangeably before migration
npm install lodash
unpm install express    # Syncs with package-lock.json automatically
npm install axios       # Works seamlessly
```

When ready to fully commit to pnpm's security benefits:

```bash
unpm migrate
```

After migration, npm install/update is blocked to ensure consistent, secure dependency management.

### Security Diagnostics

Check your project's security configuration:

```bash
unpm doctor --security
```

Reviews trust policy, release age settings, lockfile status, allowlist entries, and more.

## Documentation

- [Security Features](docs/security.md) - Script blocking, release age, strict mode
- [Command Reference](docs/commands.md) - All supported commands
- [Configuration](docs/configuration.md) - Package.json and CLI options
- [Migration Guide](docs/migration.md) - Moving from npm to unpm
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## Requirements

- Node.js >= 18.0.0
- pnpm installed (`npm install -g pnpm`)
- Optional for proxy mode: DepGate build with `run --prepare` support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Apache-2.0](LICENSE.md)

## Related Projects

- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [LavaMoat](https://github.com/LavaMoat/LavaMoat) - Tools for sandboxing JavaScript dependency risk
