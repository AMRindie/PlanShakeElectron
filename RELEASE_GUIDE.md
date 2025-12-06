# PlanShake Release Guide

## Quick Release (Recommended)

```bash
# 1. Make sure all changes are committed
git add .
git commit -m "Your changes"
git push origin main

# 2. Create and push a version tag
git tag v0.3.0
git push origin v0.3.0
```

GitHub Actions will automatically build for **Windows**, **macOS**, and **Linux**.

---

## Step-by-Step Guide

### 1. Update Version Number

Edit `package.json`:
```json
{
  "version": "0.3.0"
}
```

### 2. Commit Your Changes

```bash
git add .
git commit -m "Release v0.3.0"
git push origin main
```

### 3. Create a Version Tag

```bash
git tag v0.3.0
git push origin v0.3.0
```

### 4. Monitor the Build

1. Go to: https://github.com/AMRindie/PlanShakeElectron/actions
2. Watch the "Build and Release" workflow
3. Wait ~5-10 minutes for all builds to complete

### 5. Edit Release Notes (Optional)

1. Go to: https://github.com/AMRindie/PlanShakeElectron/releases
2. Click the pencil icon next to your release
3. Add a description with what's new
4. Click "Update release"

---

## Build Outputs

| Platform | File Format | Architecture |
|----------|-------------|--------------|
| Windows  | `.exe` (NSIS installer) | x64 |
| macOS    | `.dmg` | Universal |
| Linux    | `.AppImage` | x64 |

---

## Manual Trigger (Without Tag)

You can manually trigger a build from the GitHub Actions tab:

1. Go to: https://github.com/AMRindie/PlanShakeElectron/actions
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

---

## Versioning Convention

Use [Semantic Versioning](https://semver.org/):

- **MAJOR** (v1.0.0 → v2.0.0): Breaking changes
- **MINOR** (v0.2.0 → v0.3.0): New features (backward compatible)
- **PATCH** (v0.2.0 → v0.2.1): Bug fixes

---

## Auto-Updates

Once released, users with older versions will:
1. See an update notification when they open the app
2. Download the update in the background
3. Install automatically when they restart

---

## Troubleshooting

### Build Failed?
- Check the Actions tab for error logs
- Ensure all dependencies are installed
- Verify the workflow has `permissions: contents: write`

### Tag Already Exists?
```bash
# Delete local tag
git tag -d v0.3.0

# Delete remote tag
git push origin --delete v0.3.0

# Recreate tag
git tag v0.3.0
git push origin v0.3.0
```

### Release Not Appearing?
- Ensure the tag follows the `v*.*.*` format
- Check that the workflow completed successfully
