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

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `allowLocalScripts` | `true` | Allow scripts in your project's package.json |
| `allowDependencyScripts` | `false` | Allow all dependency scripts (not recommended) |
| `lavamoatEnabled` | `true` | Use LavaMoat allowlist for script control |
| `minReleaseAge` | `"2d"` | Minimum age for packages (e.g., `"2d"`, `"4h"`, `"30m"`) |
| `minReleaseAgeExclude` | `[]` | Packages exempt from minimum release age |
| `strict.enabled` | `false` | Enable strict security mode |
| `strict.minReleaseAgeDays` | `7` | Minimum release age in strict mode (days) |

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

For `minReleaseAge` and `--min-release-age` flag:

| Format | Example | Description |
|--------|---------|-------------|
| `m`, `min` | `30m` | Minutes |
| `h`, `hr`, `hours` | `4h` | Hours |
| `d`, `days` | `2d` | Days |
| `w`, `weeks` | `1w` | Weeks |
