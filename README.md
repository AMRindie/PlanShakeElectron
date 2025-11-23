# PlanShake - Electron App with Auto-Update

A beautiful project management application built with Electron and GitHub auto-update functionality.

## Features

- ✨ Modern, intuitive interface
- 🔄 Automatic updates via GitHub releases
- 📦 Cross-platform support (Windows, macOS, Linux)
- 🎨 Beautiful update notifications

## Development Setup

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AMRindie/PlanShakeElectron.git
cd PlanShakeElectron
```

2. Install dependencies:
```bash
npm install
```

3. Run the app in development mode:
```bash
npm start
```

## Building & Distribution

### Build for Current Platform

To create a distributable package for your current platform:

```bash
npm run dist
```

This will create installers in the `dist/` folder.

### Publishing a Release

The auto-update system works through GitHub Releases. Here's how to publish a new version:

1. **Update version in package.json**:
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   ```

3. **Create and push a version tag**:
   ```bash
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

4. **GitHub Actions will automatically**:
   - Build the app for Windows, macOS, and Linux
   - Create a GitHub Release
   - Upload the installers as release assets

5. **Users will automatically receive the update** when they launch the app!

## Auto-Update System

### How It Works

1. **On App Launch**: The app checks for updates 3 seconds after startup
2. **Periodic Checks**: Every hour, the app checks for new versions
3. **User Notification**: When an update is available, a beautiful notification appears
4. **Download**: User can choose to download the update immediately or later
5. **Installation**: After download, user can restart to install or defer until next launch

### Update Notification UI

The app includes a beautiful, non-intrusive update notification system:
- Gradient purple notification card
- Download progress bar
- One-click update installation
- "Later" option for deferred updates

### Manual Update Check

You can also trigger a manual update check from the developer console:
```javascript
window.checkForUpdates()
```

## Configuration

### GitHub Repository Settings

Make sure your repository settings are correct in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/AMRindie/PlanShakeElectron.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "AMRindie",
      "repo": "PlanShakeElectron"
    }
  }
}
```

### GitHub Token

For publishing releases, you need a GitHub token with `repo` permissions:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a new token with `repo` scope
3. Set it as `GH_TOKEN` environment variable when building:
   ```bash
   set GH_TOKEN=your_token_here
   npm run publish
   ```

Or use GitHub Actions (recommended) which automatically uses `GITHUB_TOKEN`.

## Project Structure

```
PlanShakeElectron/
├── main.js              # Electron main process
├── preload.js           # Preload script for secure IPC
├── app.updater.js       # Auto-updater UI handler
├── index.html           # Main app page
├── project.html         # Project view page
├── app.js               # Main application logic
├── app.*.js             # Feature modules
├── style.css            # Application styles
├── package.json         # Dependencies & build config
└── .github/
    └── workflows/
        └── release.yml  # GitHub Actions workflow
```

## Scripts

- `npm start` - Run the app in development mode
- `npm run pack` - Build the app without creating installers
- `npm run dist` - Build and create installers for current platform
- `npm run publish` - Build and publish to GitHub releases

## Troubleshooting

### Updates Not Working

1. **Check GitHub Release**: Make sure a release exists with the version tag
2. **Check Release Assets**: Ensure the release has the installer files attached
3. **Check Console**: Open DevTools (Ctrl+Shift+I) and check for error messages
4. **Check Repository URL**: Verify the repository URL in package.json is correct

### Build Errors

1. **Clear node_modules**: `rm -rf node_modules && npm install`
2. **Clear dist folder**: `rm -rf dist`
3. **Update electron-builder**: `npm install electron-builder@latest`

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
