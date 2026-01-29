# UNPM

A secure npm wrapper that delegates to pnpm behind the scenes, providing improved security defaults while maintaining full npm CLI compatibility.

## Introduction

We love npm. npm and npmjs.com are at the heart of the explosive popularity of JavaScript packages.

It really isn't very secure, however.

npm's default behavior allows packages to execute arbitrary scripts during installation, which has been exploited in numerous supply chain attacks. Newer package managers like pnpm and Bun have improved upon npm's security model, but there's a lot of legacy code out there along with existing CI/CD pipelines. Transitioning these to newer tools is non-trivial.

Enter **unpm**. UNPM creates a wrapper around the familiar npm commands, handing the work off to pnpm behind the scenes while adding security improvements:

- **Blocks dependency scripts by default** - Install scripts from dependencies are blocked unless explicitly allowed
- **Minimum release age protection** - Blocks recently published packages (default: 2 days) to protect against supply chain attacks
- **Uses pnpm under the hood** - Leverages pnpm's improved dependency resolution and security features
- **Drop-in npm replacement** - Same commands, same flags, no migration required
- **LavaMoat integration** - Fine-grained control over which packages can run scripts

## Installation

### Global Install (Recommended)

```bash
# Using npm
npm install -g @depgate/unpm

# Using pnpm
pnpm add -g @depgate/unpm

# Using yarn
yarn global add @depgate/unpm
```

### Using npx

```bash
npx @depgate/unpm install
npx @depgate/unpm add lodash
```

### From Source

```bash
git clone https://github.com/depgate/unpm.git
cd unpm
pnpm install
pnpm build
pnpm link --global
```

## Requirements

- **Node.js** >= 18.0.0
- **pnpm** installed and available in PATH

To install pnpm:
```bash
npm install -g pnpm
# or
corepack enable && corepack prepare pnpm@latest --activate
```

## Usage

UNPM is designed as a drop-in replacement for npm. Simply replace `npm` with `unpm`:

```bash
# Instead of: npm install
unpm install

# Instead of: npm install lodash
unpm install lodash

# Instead of: npm run build
unpm run build

# Instead of: npm test
unpm test
```

### Aliasing to npm (Optional)

If you want to transparently replace npm with unpm, add an alias to your shell configuration:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
alias npm='unpm'
```

After reloading your shell, all `npm` commands will automatically use unpm.

### Basic Commands

```bash
# Install all dependencies from package.json
unpm install

# Install specific packages
unpm install lodash axios

# Install as dev dependency
unpm install -D typescript vitest

# Install globally
unpm install -g serve

# Remove packages
unpm remove lodash

# Update packages
unpm update

# Run scripts
unpm run build
unpm test
unpm start

# View package info
unpm view lodash

# Search for packages
unpm search http client

# Check for outdated packages
unpm outdated

# Run security audit
unpm audit
```

### CI/CD Usage

For continuous integration, use `unpm ci` which ensures reproducible builds:

```bash
unpm ci
```

This is equivalent to `npm ci` and uses `pnpm install --frozen-lockfile` under the hood.

## Security Features

### Script Blocking

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

### LavaMoat Integration

UNPM integrates with [@lavamoat/allow-scripts](https://github.com/LavaMoat/LavaMoat/tree/main/packages/allow-scripts) for managing script permissions. If you already use LavaMoat, UNPM will respect your existing configuration.

Initialize LavaMoat configuration:

```bash
unpm setup-lavamoat
```

### Minimum Release Age

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

Duration formats supported:
- `m` or `min` - minutes (e.g., `30m`)
- `h`, `hr`, or `hours` - hours (e.g., `4h`)
- `d` or `days` - days (e.g., `2d`)
- `w` or `weeks` - weeks (e.g., `1w`)

### Strict Mode

For CI/CD environments and high-security use cases, UNPM provides strict mode which enables additional protections:

```bash
# Enable via CLI flag
unpm --strict install

# Enable via environment variable
UNPM_STRICT=true unpm install
```

Strict mode enforces:
- **7-day minimum release age** (instead of 2 days)
- **dlx is completely blocked** (even with `--allow-dlx`)
- **explore command is blocked** (even with `--allow-explore`)
- **--force-scripts is blocked**
- **Frozen lockfile for ci command**

You can also configure strict mode in `package.json`:

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

### dlx Security

The `dlx` command (download and execute) is blocked by default because it can execute arbitrary code from packages:

```bash
# This will be blocked
unpm dlx cowsay hello

# To allow dlx, use --allow-dlx
unpm dlx --allow-dlx cowsay hello
```

In strict mode, `dlx` is completely blocked even with `--allow-dlx`.

### Explore Command Security

The `explore` command opens a subshell in a package's directory, which is a security risk:

```bash
# This will be blocked
unpm explore lodash

# To allow explore, use --allow-explore
unpm explore --allow-explore lodash
```

In strict mode, `explore` is completely blocked even with `--allow-explore`.

## Migrating from npm

UNPM provides a migration command to convert existing npm projects:

```bash
unpm migrate
```

This will:
1. Convert `package-lock.json` to `pnpm-lock.yaml`
2. Initialize LavaMoat configuration
3. Add UNPM configuration to `package.json`
4. Install dependencies securely

Options:
```bash
# Preview changes without applying them
unpm migrate --dry-run

# Skip LavaMoat configuration
unpm migrate --skip-lavamoat
```

## Command Reference

### Install Commands

| Command | Description |
|---------|-------------|
| `unpm install` | Install all dependencies |
| `unpm install <pkg>` | Install a package |
| `unpm install -D <pkg>` | Install as dev dependency |
| `unpm install -g <pkg>` | Install globally |
| `unpm ci` | Clean install (frozen lockfile) |
| `unpm add <pkg>` | Add a package |
| `unpm remove <pkg>` | Remove a package |
| `unpm update` | Update packages |

### Install Security Flags

| Flag | Description |
|------|-------------|
| `--min-release-age=<duration>` | Override minimum release age (e.g., `2d`, `4h`, `30m`) |
| `--allow-recent=<pkg>` | Allow a specific package regardless of age |
| `--no-min-release-age` | Disable minimum release age check (not recommended) |
| `--force-scripts` | Allow all dependency scripts to run (not recommended) |
| `--strict` | Enable strict security mode (7-day release age, block dlx/explore) |

### Run Commands

| Command | Description |
|---------|-------------|
| `unpm run <script>` | Run a package script |
| `unpm test` | Run tests |
| `unpm start` | Start the application |
| `unpm stop` | Stop the application |
| `unpm restart` | Restart the application |
| `unpm exec <cmd>` | Execute a command |
| `unpm dlx --allow-dlx <pkg>` | Download and execute a package (requires --allow-dlx) |

### Compound Commands

| Command | Description |
|---------|-------------|
| `unpm install-test` / `unpm it` | Install packages and run tests |
| `unpm install-ci-test` / `unpm cit` | CI install and run tests |

### Package Commands

| Command | Description |
|---------|-------------|
| `unpm init` | Initialize a new package |
| `unpm publish` | Publish to registry |
| `unpm unpublish` | Unpublish a package |
| `unpm deprecate` | Deprecate a package |
| `unpm undeprecate` | Remove deprecation warning |
| `unpm pack` | Create a tarball |
| `unpm link` | Link a package |
| `unpm unlink` | Unlink a package |
| `unpm pkg` | Manage package.json fields |
| `unpm sbom` | Generate software bill of materials |

### Info Commands

| Command | Description |
|---------|-------------|
| `unpm ls` | List installed packages |
| `unpm outdated` | Check for outdated packages |
| `unpm view <pkg>` | View package info |
| `unpm search <query>` | Search for packages |
| `unpm why <pkg>` | Explain why a package is installed |
| `unpm docs <pkg>` | Open package documentation |
| `unpm bugs <pkg>` | Open package issues |
| `unpm repo <pkg>` | Open package repository |
| `unpm query <selector>` | Query installed packages |
| `unpm find-dupes` | Find duplicate packages |

### Diagnostic Commands

| Command | Description |
|---------|-------------|
| `unpm ping` | Check registry connectivity |
| `unpm doctor` | Run environment diagnostics |
| `unpm help-search <term>` | Search help documentation |

### Security Commands

| Command | Description |
|---------|-------------|
| `unpm audit` | Run security audit |
| `unpm fund` | Show funding info |
| `unpm allow-scripts add <pkg>` | Allow package scripts |
| `unpm allow-scripts list` | List allowed packages |
| `unpm allow-scripts remove <pkg>` | Remove from allowlist |

### Organization Commands

| Command | Description |
|---------|-------------|
| `unpm org` | Manage organizations |
| `unpm team` | Manage organization teams |
| `unpm profile` | Manage user profile |
| `unpm hook` | Manage registry hooks |

### Registry Commands

| Command | Description |
|---------|-------------|
| `unpm login` | Login to registry |
| `unpm logout` | Logout from registry |
| `unpm whoami` | Show current user |
| `unpm token` | Manage auth tokens |
| `unpm access` | Manage package access |
| `unpm owner` | Manage package owners |
| `unpm dist-tag` | Manage dist-tags |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `unpm config` | Manage configuration |
| `unpm set <key> <value>` | Set a config value |
| `unpm get <key>` | Get a config value |

### UNPM-Specific Commands

| Command | Description |
|---------|-------------|
| `unpm migrate` | Migrate from npm to unpm |
| `unpm setup-lavamoat` | Initialize LavaMoat config |
| `unpm allow-scripts` | Manage script allowlist |

## Flag Mapping

UNPM automatically translates npm flags to their pnpm equivalents:

| npm flag | pnpm equivalent |
|----------|-----------------|
| `--save` | (default) |
| `--save-dev`, `-D` | `-D` |
| `--save-optional`, `-O` | `-O` |
| `--save-exact`, `-E` | `-E` |
| `--global`, `-g` | `-g` |
| `--production` | `--prod` |
| `--no-save` | `--save=false` |
| `--no-package-lock` | `--no-lockfile` |
| `--package-lock-only` | `--lockfile-only` |
| `--ignore-scripts` | `--ignore-scripts` |
| `--prefer-offline` | `--prefer-offline` |
| `--dry-run` | `--dry-run` |

Flags that accept values (like `--registry`, `--depth`, `--audit-level`) are automatically handled and passed through correctly.

## Configuration

UNPM configuration can be added to your `package.json`:

```json
{
  "unpm": {
    "allowLocalScripts": true,
    "allowDependencyScripts": false,
    "lavamoatEnabled": true,
    "minReleaseAge": "2d",
    "minReleaseAgeExclude": ["trusted-package"],
    "strict": {
      "enabled": false,
      "minReleaseAgeDays": 7
    }
  },
  "lavamoat": {
    "allowScripts": {
      "esbuild": true
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `allowLocalScripts` | `true` | Allow scripts in your project's package.json |
| `allowDependencyScripts` | `false` | Allow all dependency scripts (not recommended) |
| `lavamoatEnabled` | `true` | Use LavaMoat allowlist for script control |
| `minReleaseAge` | `"2d"` | Minimum age for packages (e.g., `"2d"`, `"4h"`, `"30m"`) |
| `minReleaseAgeExclude` | `[]` | Packages exempt from minimum release age |
| `strict.enabled` | `false` | Enable strict security mode |
| `strict.minReleaseAgeDays` | `7` | Minimum release age in strict mode (days) |

## Troubleshooting

### "pnpm: command not found"

Ensure pnpm is installed:
```bash
npm install -g pnpm
```

Or with corepack:
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Package fails to build

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

### Lockfile conflicts

If you have both `package-lock.json` and `pnpm-lock.yaml`, run:
```bash
unpm migrate
```

This will properly convert the npm lockfile to pnpm format.

### Command not working as expected

Use verbose mode to see what commands are being executed:
```bash
unpm --verbose install lodash
```

## Development

```bash
# Clone the repository
git clone https://github.com/depgate/unpm.git
cd unpm

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode for tests
pnpm test:watch

# Lint
pnpm lint

# Format code
pnpm format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Apache-2.0](LICENSE)

## Related Projects

- [DepGate](https://github.com/depgate) - Security tools for dependency management
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [LavaMoat](https://github.com/LavaMoat/LavaMoat) - Tools for sandboxing JavaScript dependency risk
- [@lavamoat/allow-scripts](https://github.com/LavaMoat/LavaMoat/tree/main/packages/allow-scripts) - Control which packages can run install scripts
