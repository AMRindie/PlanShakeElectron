# 🚀 Complete Auto-Update Setup Guide

## ✅ Step 1: Your Installer is Ready!

Your installer has been built successfully:
- **Location**: `dist\PlanShake Setup 1.0.0.exe`
- **Version**: 1.0.0
- **Size**: ~137 MB (includes Electron runtime)

You can install this now to test your app!

---

## 📋 Step 2: How to Make Updates Work

Follow these steps **EXACTLY** to enable auto-updates:

### A. First-Time Setup (Do this once)

1. **Install the current version (1.0.0)**
   - Run `dist\PlanShake Setup 1.0.0.exe`
   - Install the app normally
   - Close it after testing

2. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial Electron app with auto-update"
   git push origin main
   ```

3. **Create your first GitHub Release (v1.0.0)**
   
   **Option A: Using GitHub Website (Easiest)**
   - Go to: https://github.com/AMRindie/PlanShakeElectron/releases
   - Click "Create a new release"
   - Tag version: `v1.0.0`
   - Release title: `v1.0.0`
   - Description: "Initial release"
   - **Upload these files** from your `dist` folder:
     - `PlanShake Setup 1.0.0.exe`
     - `PlanShake Setup 1.0.0.exe.blockmap`
     - `latest.yml` (if it exists)
   - Click "Publish release"

   **Option B: Using GitHub CLI (if you have it)**
   ```bash
   gh release create v1.0.0 --title "v1.0.0" --notes "Initial release" dist/*.exe dist/*.blockmap dist/latest.yml
   ```

---

### B. Making an Update (Do this every time you want to release an update)

Let's say you want to release version 1.0.1:

#### Step 1: Update the Version Number
Edit `package.json` and change:
```json
"version": "1.0.1"
```

#### Step 2: Make Your Code Changes
- Fix bugs, add features, etc.
- Test with `npm start`

#### Step 3: Build the New Installer
```bash
npm run dist
```

#### Step 4: Commit and Tag
```bash
git add .
git commit -m "Release v1.0.1 - [describe your changes]"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

#### Step 5: Create GitHub Release

**Option A: Automatic (Using GitHub Actions)**
- When you push the tag `v1.0.1`, GitHub Actions will automatically:
  - Build the app for Windows, macOS, Linux
  - Create a release
  - Upload the installers
- **Note**: This requires GitHub Actions to be enabled in your repo

**Option B: Manual (Upload yourself)**
- Go to: https://github.com/AMRindie/PlanShakeElectron/releases
- Click "Create a new release"
- Tag version: `v1.0.1`
- Release title: `v1.0.1`
- Description: Describe what changed
- **Upload these files** from `dist`:
  - `PlanShake Setup 1.0.1.exe`
  - `PlanShake Setup 1.0.1.exe.blockmap`
  - `latest.yml`
- Click "Publish release"

#### Step 6: Test the Auto-Update!
1. Open the installed app (version 1.0.0)
2. Wait 3 seconds
3. You should see a purple notification: "Update Available!"
4. Click "Download"
5. Watch the progress bar
6. Click "Restart Now" when done
7. App restarts with version 1.0.1! 🎉

---

## 🔄 Quick Reference: Update Workflow

Every time you want to release an update:

```bash
# 1. Update version in package.json (e.g., 1.0.1 → 1.0.2)

# 2. Build
npm run dist

# 3. Commit and tag
git add .
git commit -m "Release v1.0.2"
git tag v1.0.2
git push origin main
git push origin v1.0.2

# 4. Create GitHub Release and upload files from dist/:
#    - PlanShake Setup 1.0.2.exe
#    - PlanShake Setup 1.0.2.exe.blockmap
#    - latest.yml
```

---

## 🎯 Important Files for Auto-Update

When creating a GitHub Release, you MUST upload these files:

1. **`PlanShake Setup X.X.X.exe`** - The installer
2. **`PlanShake Setup X.X.X.exe.blockmap`** - For delta updates (faster downloads)
3. **`latest.yml`** - Tells the app about the latest version

All these files are in the `dist` folder after running `npm run dist`.

---

## 🐛 Troubleshooting

### "Update not showing up"
- Check that the GitHub Release is published (not draft)
- Verify the version number in the release matches package.json
- Make sure all 3 files are uploaded
- Check DevTools console (Ctrl+Shift+I) for errors

### "Can't download update"
- Ensure the `.exe` file is uploaded to the release
- Check your internet connection
- Verify the GitHub repo is public (or you have a token for private repos)

### "GitHub Actions not working"
- Go to your repo → Settings → Actions → Enable workflows
- Make sure you have the `.github/workflows/release.yml` file
- Push a tag to trigger it: `git tag v1.0.1 && git push origin v1.0.1`

---

## 📝 Version Numbering

Use semantic versioning:
- **1.0.0** → **1.0.1** - Bug fixes
- **1.0.0** → **1.1.0** - New features
- **1.0.0** → **2.0.0** - Breaking changes

---

## 🎨 Customizing the Update Notification

The update notification appears in the top-right corner with:
- Purple gradient background
- Update version info
- Download/Later buttons
- Progress bar during download

To customize it, edit `app.updater.js`.

---

## ✅ You're All Set!

Your app now has professional auto-update functionality just like Chrome, VS Code, and other modern apps!

**Next steps:**
1. Install `dist\PlanShake Setup 1.0.0.exe`
2. Create your first GitHub Release (v1.0.0)
3. Make a change and release v1.0.1 to test updates!
