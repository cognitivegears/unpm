# Command Reference

UNPM supports all npm commands. This is a complete reference.

## Install Commands

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

### Compound Commands

| Command | Description |
|---------|-------------|
| `unpm install-test` / `unpm it` | Install packages and run tests |
| `unpm install-ci-test` / `unpm cit` | CI install and run tests |

### Security Flags

| Flag | Description |
|------|-------------|
| `--min-release-age=<duration>` | Override minimum release age (e.g., `2d`, `4h`, `30m`) |
| `--allow-recent=<pkg>` | Allow a specific package regardless of age |
| `--no-min-release-age` | Disable minimum release age check |
| `--force-scripts` | Allow all dependency scripts to run |
| `--strict` | Enable strict security mode |
| `--trust-policy=<mode>` | Set trust policy (`no-downgrade` or `none`) |
| `--trust-policy-ignore-after=<duration>` | Ignore packages unchanged for longer (e.g., `1y`) |
| `--trust-policy-exclude=<pkg>` | Exclude package from trust policy |
| `--no-trust-policy` | Disable trust policy |
| `--block-exotic-subdeps` | Block git/tarball subdependencies |
| `--no-block-exotic-subdeps` | Allow git/tarball subdependencies |
| `--depgate` | Run install command through DepGate prepare proxy |
| `--depgate-bin=<path>` | Use a specific DepGate binary |
| `--depgate-config=<path>` | Pass policy file to DepGate (`--config`) |
| `--depgate-decision-mode=<mode>` | Pass decision mode to DepGate (`block`, `warn`, `audit`) |
| `--depgate-upstream=<arg>` | Pass raw upstream override args to DepGate |

### DepGate Proxy Mode

DepGate mode is available for install-family commands (`install`, `ci`, `add`, `update`) and uses a short-lived proxy process for the single command.

```bash
unpm --depgate install
unpm --depgate --depgate-config ./depgate-policy.yml --depgate-decision-mode warn add lodash
```

## Run Commands

| Command | Description |
|---------|-------------|
| `unpm run <script>` | Run a package script |
| `unpm test` | Run tests |
| `unpm start` | Start the application |
| `unpm stop` | Stop the application |
| `unpm restart` | Restart the application |
| `unpm exec <cmd>` | Execute a command |
| `unpm dlx --allow-dlx <pkg>` | Download and execute a package |

## Package Commands

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

## Info Commands

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

## Diagnostic Commands

| Command | Description |
|---------|-------------|
| `unpm ping` | Check registry connectivity |
| `unpm doctor` | Run environment diagnostics |
| `unpm doctor --security` | Run security-focused diagnostics |
| `unpm help-search <term>` | Search help documentation |

## Security Commands

| Command | Description |
|---------|-------------|
| `unpm audit` | Run security audit |
| `unpm fund` | Show funding info |
| `unpm allow-scripts add <pkg>` | Allow package scripts |
| `unpm allow-scripts list` | List allowed packages |
| `unpm allow-scripts remove <pkg>` | Remove from allowlist |
| `unpm allow-scripts review` | Review script allowlist status |
| `unpm provenance <pkg>` | Show package provenance/attestation info |
| `unpm prov <pkg>` | Alias for provenance |
| `unpm unused` | Check for unused dependencies |
| `unpm unused --fix` | Remove unused dependencies |
| `unpm unused --everything` | Full analysis (files, exports, types) |
| `unpm unused --everything --fix` | Full analysis with fixes |

## Organization Commands

| Command | Description |
|---------|-------------|
| `unpm org` | Manage organizations |
| `unpm team` | Manage organization teams |
| `unpm profile` | Manage user profile |
| `unpm hook` | Manage registry hooks |

## Registry Commands

| Command | Description |
|---------|-------------|
| `unpm login` | Login to registry |
| `unpm logout` | Logout from registry |
| `unpm whoami` | Show current user |
| `unpm token` | Manage auth tokens |
| `unpm access` | Manage package access |
| `unpm owner` | Manage package owners |
| `unpm dist-tag` | Manage dist-tags |

## Configuration Commands

| Command | Description |
|---------|-------------|
| `unpm config` | Manage configuration |
| `unpm set <key> <value>` | Set a config value |
| `unpm get <key>` | Get a config value |

## UNPM-Specific Commands

| Command | Description |
|---------|-------------|
| `unpm migrate` | Migrate from npm to unpm |
| `unpm migrate --block-exotic-subdeps` | Migrate with exotic subdeps blocking |
| `unpm setup-lavamoat` | Initialize LavaMoat config |
| `unpm allow-scripts` | Manage script allowlist |
| `unpm provenance <pkg>` | Show package provenance info |
| `unpm doctor --security` | Run security diagnostics |

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
