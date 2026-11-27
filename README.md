# Pacman Packagings — Bookkeeping App

**Pacman Packagings — An undertaking of Neena Greentailers**

A lightweight bookkeeping web app for a small paper bag manufacturing business.

**Live app (cloud auto-save):** https://pacman-packagings-app.pages.dev

## Features
- **Dashboard** — sales, payments received, expenses, net, receivables, today's production, low stock.
- **Customers & Suppliers** — contact records, balances, history.
- **Inventory / Items** — products/raw materials, stock, reorder levels, cost/price.
- **Invoices & Payments** — create invoices, record payments, track outstanding/overdue.
- **Expenses & Purchases** — log spent/received entries with category and payment method.
- **Daily Production** — machine output, target, produced, waste.
- **Cloud auto-save** — every change is saved to Cloudflare D1 automatically.
- **Export/Import** — backup or move your data as a JSON file.

## Run locally
Open `index.html` in a browser. Without a backend it falls back to browser local
storage (shown as “Offline — saved in this browser only”).

## Deploy on Cloudflare (Pages + D1)
1. **Create a D1 database** in the Cloudflare dashboard: Workers & Pages → D1 →
   Create database, name it e.g. `pacman-packagings-db`.
2. **Run the schema**: open the database → Console → paste the contents of
   `schema.sql` → Execute.
3. **Create a Pages project** (Workers & Pages → Create → Pages). Either connect
   the Git repo or use Direct Upload with the app files (must include
   `_worker.js` at the root).
4. **Bind the database**: Pages project → Settings → Functions → D1 database
   bindings → Variable name `DB` → select your database → Save.
5. **Redeploy** so the binding takes effect.

The app then saves to `/api/state` (served by `_worker.js`) on every change and
loads the cloud copy on startup.

> Security note: the API has no login. Anyone with the site URL can read/write
> the data. For a private setup, put Cloudflare Access in front of the site.

## Branding
The logo is an original design for Pacman Packagings (yellow/dark palette
inspired, not using official Pac-Man game assets). Replace `logo.svg` or the
inline SVG in `index.html` if you have your own official logo.
