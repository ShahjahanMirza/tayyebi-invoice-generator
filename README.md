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

## Build standalone Windows .exe installer

```bash
npm run build
```

Output is in `dist-app/`.  
The installer is: `dist-app/Tayyebi Invoicing Setup 1.0.0.exe`

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
