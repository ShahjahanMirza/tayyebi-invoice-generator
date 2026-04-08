# Tayyebi Invoicing System — Electron

## Prerequisites
- Node.js 18+ (https://nodejs.org)
- Git (optional)

---

## First-time setup

```bash
cd tayyebi-electron
npm install
```

---

## Migrate existing JSON data

Copy your existing data files into the app's data folder:

**Windows path:**
```
C:\Users\<YourName>\AppData\Roaming\tayyebi-invoicing\tayyebi_data\
```

Copy these files there:
- `products.json`
- `customers.json`
- `settings.json`
- `history.json`

(The folder is created automatically when you first run the app.
You can also click **Settings → Open Data Folder** from inside the app.)

---

## Run in development

```bash
npm run dev
```

This starts Vite (React) and Electron simultaneously.

---

## Build standalone Windows .exe installer (local only)

```bash
npm run build
```

Output is in `dist-app/`.  
The installer is: `dist-app/Tayyebi Invoicing Setup X.X.X.exe`

---

## Publishing Updates

Users get auto-updates via GitHub Releases. Follow these steps:

### One-time setup: Set GitHub Token

1. Go to https://github.com/settings/tokens?type=beta
2. Create a **fine-grained token** scoped to `ShahjahanMirza/tayyebi-invoice-generator`
3. Permission: **Contents → Read and write**
4. Copy the token and run this in PowerShell (replace `YOUR_TOKEN_HERE`):

```powershell
[System.Environment]::SetEnvironmentVariable("GH_TOKEN", "YOUR_TOKEN_HERE", "User")
```

Close and reopen your terminal after this. Only needed once (or when you rotate the token).

### Every time you release an update

1. Make your code changes
2. Bump `version` in `package.json` (e.g. `1.1.0` → `1.2.0`)
3. Run:

```bash
npm run dist
```

That's it. The installer gets built and uploaded to GitHub Releases automatically.  
Users will see an "Update Ready" prompt next time they open the app.

> **Note:** Version must increase or the updater won't trigger. Use `X.Y.0` for features, `X.Y.Z` for bug fixes.

Hand this installer to the client. They run it once, it installs to Program Files,
creates a desktop shortcut, and that's it. No Python, no Node, no terminal needed.

---

## Optional: Add logo

Place `logo.png` in the `assets/` folder before building.
It will appear on the printed PDF invoices.

For the app window icon, place `icon.ico` in `assets/`.

---

## Data storage

All data lives in:
```
C:\Users\<Name>\AppData\Roaming\tayyebi-invoicing\tayyebi_data\
```

- Never deleted on uninstall (client's data is safe)
- Can be backed up by simply copying this folder
- Can be transferred to a new machine by copying to the same path

---

## Bug fixes included vs original

| Bug | Status |
|-----|--------|
| Save button didn't actually save | ✅ Fixed |
| Invoice number never incremented | ✅ Fixed |
| PDF missing trade price, PO#, challan# | ✅ Fixed |
| JSON files written to wrong folder in .exe | ✅ Fixed |
| Company address hardcoded in PDF | ✅ Fixed |
| Lag from full UI rebuild on every keystroke | ✅ Fixed (React reconciliation) |
