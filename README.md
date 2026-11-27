# Pacman Packagings — Bookkeeping App

**Pacman Packagings — An undertaking of Neena Greentailers**

A lightweight bookkeeping web app for a small paper bag manufacturing business.

## Features
- **Dashboard** — sales, payments received, expenses, net, receivables, today's production, low stock.
- **Customers & Suppliers** — contact records, balances, history.
- **Inventory / Items** — products/raw materials, stock, reorder levels, cost/price.
- **Invoices & Payments** — create invoices, record payments, track outstanding/overdue.
- **Expenses & Purchases** — log spent/received entries with category and payment method.
- **Daily Production** — machine output, target, produced, waste.
- **Export/Import** — backup or move your data as a JSON file.

## Run locally (right now)
1. Open the folder `pacman-packagings-app`.
2. Double-click `index.html` to open it in your browser.

> **Note:** Data is saved in your browser's local storage on that device/browser. Export regularly as backup.

## Access from anywhere (free hosting)
To make it accessible from anywhere on the internet, deploy it as a static site:

### Option A — Netlify (easiest, free)
1. Create a free account at [netlify.com](https://www.netlify.com/).
2. Zip the `pacman-packagings-app` folder (or drag the folder) into Netlify "Add new site" → "Deploy manually".
3. Netlify gives you a public URL you can open from anywhere.

### Option B — Vercel (free)
1. Create a free account at [vercel.com](https://vercel.com/).
2. Install Vercel CLI or use the web dashboard to import/deploy the folder.
3. Deploy as a static site; you'll get a public URL.

### Option C — GitHub Pages (free)
1. Create a GitHub account and a new repository.
2. Upload the files in `pacman-packagings-app`.
3. Enable GitHub Pages in repository settings.

## Important: cross-device data
This MVP stores data in **browser local storage**. That means data is per-browser/per-device. For true anywhere-access with shared data across devices, the next step is to connect a cloud database (e.g., Supabase free tier) and add login. If you want, ask me to wire Supabase into this app.

## Branding
The logo included is an original logo created for Pacman Packagings (inspired by a bold yellow/dark palette, not using official Pac-Man game assets). Replace `logo.svg` / the inline SVG in `index.html` if you have your own official logo.