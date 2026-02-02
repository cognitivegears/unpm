# Configuration

UNPM can be configured via `package.json` or command-line flags.

## Package.json Configuration

Add configuration to your `package.json`:

```json
{
  "unpm": {
    "allowLocalScripts": true,
    "allowDependencyScripts": false,
    "lavamoatEnabled": true,
    "minReleaseAge": "2d",
    "minReleaseAgeExclude": ["trusted-package"],
    "trustPolicy": "no-downgrade",
    "trustPolicyIgnoreAfter": "1y",
    "trustPolicyExclude": ["internal-pkg"],
    "blockExoticSubdeps": false,
    "auditAfterInstall": false,
    "auditLevel": "high",
    "strict": {
      "enabled": false,
      "minReleaseAgeDays": 7,
      "strictDepBuilds": true,
      "blockAuditFailures": true,
      "auditLevel": "high"
    }
  },
  "lavamoat": {
    "allowScripts": {
      "esbuild": true
    }
  }
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `allowLocalScripts` | `true` | Allow scripts in your project's package.json |
| `allowDependencyScripts` | `false` | Allow all dependency scripts (not recommended) |
| `lavamoatEnabled` | `true` | Use LavaMoat allowlist for script control |
| `minReleaseAge` | `"2d"` | Minimum age for packages (e.g., `"2d"`, `"4h"`, `"30m"`) |
| `minReleaseAgeExclude` | `[]` | Packages exempt from minimum release age |
| `trustPolicy` | `"no-downgrade"` | Trust policy: `"no-downgrade"` or `"none"` |
| `trustPolicyIgnoreAfter` | `"1y"` | Ignore packages unchanged for longer than this |
| `trustPolicyExclude` | `[]` | Packages exempt from trust policy |
| `blockExoticSubdeps` | `false` | Block git/tarball subdependencies |
| `auditAfterInstall` | `false` | Run security audit after install |
| `auditLevel` | `"high"` | Audit level: `"low"`, `"moderate"`, `"high"`, `"critical"` |
| `strict.enabled` | `false` | Enable strict security mode |
| `strict.minReleaseAgeDays` | `7` | Minimum release age in strict mode (days) |
| `strict.strictDepBuilds` | `true` | Fail if unreviewed build scripts in strict mode |
| `strict.blockAuditFailures` | `true` | Fail install on audit failures in strict mode |
| `strict.auditLevel` | `"high"` | Audit level for strict mode |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `UNPM_STRICT` | Set to `true` to enable strict mode |

## LavaMoat Allowlist

The script allowlist uses the LavaMoat format:

```json
{
  "lavamoat": {
    "allowScripts": {
      "esbuild": true,
      "sharp": true,
      "node-sass": true
    }
  }
}
```

Manage the allowlist with:

```bash
unpm allow-scripts add <package>
unpm allow-scripts remove <package>
unpm allow-scripts list
```

## Duration Formats

For `minReleaseAge`, `trustPolicyIgnoreAfter`, and related flags:

| Format | Example | Description |
|--------|---------|-------------|
| `m`, `min` | `30m` | Minutes |
| `h`, `hr`, `hours` | `4h` | Hours |
| `d`, `days` | `2d` | Days |
| `w`, `weeks` | `1w` | Weeks |
| `y`, `years` | `1y` | Years |
