# Troubleshooting Auto-Updates

If auto-updates are not working, follow these steps to diagnose and fix the issue.

## 1. Check the Logs
We have added `electron-log` to the application. This will create a log file on your computer that details exactly what is happening during the update process.

### Log File Location
- **Windows**: `%USERPROFILE%\AppData\Roaming\PlanShake\logs\main.log`
  - (Usually `C:\Users\YourName\AppData\Roaming\PlanShake\logs\main.log`)

### How to Check
1. Open File Explorer.
2. Paste `%USERPROFILE%\AppData\Roaming\PlanShake\logs` into the address bar and press Enter.
3. Open `main.log` with Notepad.
4. Look for lines starting with `[info]` or `[error]`.

## 2. Common Errors & Solutions

### "Update not available" when it should be
- **Cause**: The version in `package.json` of the installed app is the same as the latest release on GitHub.
- **Solution**: Ensure you bumped the version in `package.json` (e.g., to `0.1.2`) BEFORE building and releasing.

### "GitHub Token not found" or 404 Errors
- **Cause**: The app cannot access the private repository releases, or the token is missing.
- **Solution**: 
  - If your repo is **Private**, you MUST set `GH_TOKEN` in your environment variables.
  - If your repo is **Public**, it should work without a token, but ensure "Read and write permissions" are enabled in GitHub Actions settings.

### "Error: net::ERR_CONNECTION_REFUSED"
- **Cause**: Firewall or internet connection blocking GitHub.
- **Solution**: Check your internet connection.

### "The application is not signed" (Windows)
- **Cause**: Windows requires code signing for smooth updates, though it can work without it.
- **Solution**: This usually results in a SmartScreen warning, not a silent failure. If it fails silently, check the logs.

## 3. Verify Release Files
Go to your GitHub Repository -> Releases.
Ensure the latest release (e.g., `v0.1.2`) has **ALL** of these files:
1. `PlanShake Setup 0.1.2.exe`
2. `PlanShake Setup 0.1.2.exe.blockmap`
3. `latest.yml` (CRITICAL: This file tells the app what the latest version is)

## 4. Test Locally (Production Mode)
You cannot test auto-updates in `npm start` (dev mode). You must install the app.
1. Build the app: `npm run dist`
2. Install the generated `.exe`.
3. Run the installed app.
4. Wait 3 seconds for the auto-update check to trigger.

## 5. Force a Manual Check
We added a developer shortcut to force a check.
1. Open the installed app.
2. Press `Ctrl + Shift + I` to open DevTools.
3. Go to the "Console" tab.
4. Type `window.checkForUpdates()` and press Enter.
5. Watch the console for messages.
