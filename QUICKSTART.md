# Quick Start Guide - PlanShake Electron with Auto-Update

## ✅ Setup Complete!

Your Electron app with GitHub auto-update is now ready! Here's what was added:

### 📁 New Files Created

1. **`package.json`** - Project configuration with Electron and auto-updater
2. **`main.js`** - Electron main process with auto-update logic
3. **`preload.js`** - Secure bridge between Electron and your web app
4. **`app.updater.js`** - Beautiful UI for update notifications
5. **`.gitignore`** - Excludes build files from Git
6. **`.github/workflows/release.yml`** - Automated build & release workflow

### 🚀 How to Use

#### 1. Test Locally

Run the app in development mode:
```bash
npm start
```

#### 2. Build for Distribution

Create an installer for Windows:
```bash
npm run dist
```

The installer will be in the `dist/` folder.

#### 3. Publish a New Version

**Step-by-step release process:**

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Commit and tag**:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

3. **GitHub Actions automatically**:
   - Builds for Windows, macOS, Linux
   - Creates a GitHub Release
   - Uploads installers

4. **Users get auto-updated!** 🎉

### 🔄 Auto-Update Features

- ✅ Checks for updates on app launch
- ✅ Checks every hour automatically
- ✅ Beautiful notification UI
- ✅ Download progress bar
- ✅ One-click installation
- ✅ "Install later" option

### 🎨 Update Notification

When an update is available, users see a beautiful purple gradient notification in the top-right corner with:
- Update version info
- Download button
- Progress bar during download
- Restart button when ready

### 📝 Important Notes

1. **First Release**: For the first release, you may need to manually create it on GitHub and upload the installers, or set up a GitHub token.

2. **GitHub Token** (for manual publishing):
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create token with `repo` scope
   - Use it when publishing:
     ```bash
     set GH_TOKEN=your_token_here
     npm run publish
     ```

3. **Testing Updates**: To test the auto-update:
   - Build and install version 1.0.0
   - Create a release for version 1.0.1 on GitHub
   - Launch the installed app
   - You should see the update notification!

### 🐛 Troubleshooting

**PowerShell Script Errors?**
Use `cmd /c` prefix:
```bash
cmd /c npm start
cmd /c npm run dist
```

**Updates not working?**
- Check DevTools console (Ctrl+Shift+I)
- Verify GitHub release exists
- Ensure repository URL in package.json is correct

### 📚 Next Steps

1. ✅ Test the app locally: `npm start`
2. ✅ Build an installer: `npm run dist`
3. ✅ Push to GitHub with a version tag
4. ✅ Watch GitHub Actions build automatically
5. ✅ Install and test auto-update!

---

**Need help?** Check the full README.md for detailed documentation.
