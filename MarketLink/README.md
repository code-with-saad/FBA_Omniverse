# MarketLink

A farmers-market **pre-order** web app built with the MERN stack. Customers find nearby markets, pre-order fresh produce for a pickup slot, and pay the farmer **in cash at pickup**. Farmers manage their stall and orders; an admin approves farmers and runs the platform. Available in **English and Urdu (RTL)**.

Built by **Team Omniverse** (Aptech, F.B. Area, Karachi) for TechWiz 7.

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), React Router 7, Bootstrap 5 + SCSS, Recharts, DataTables, Leaflet |
| Backend | Node.js 20+, Express 5, Mongoose 9, JWT in httpOnly cookie, Multer, Nodemailer |
| Database | MongoDB (local or Atlas) |
| Optional | Redis cache (falls back to in-memory), SMTP e-mail, Anthropic API key for AI product descriptions |
| Maps | OpenStreetMap + Leaflet, OSRM routes, Google Maps links (no API key) |

## Project structure
```
MarketLink/
├── client/                 React front end
│   └── src/  pages (public, auth, customer, farmer, admin), components, context, api, i18n, styles
├── server/                 Express API (also serves the built client in production)
│   ├── .env.example        Copy to .env and edit
│   └── src/  routes, controllers, models, middleware, services, seed, scripts
├── database/
│   ├── marketlink-schema.mongodb.js   Collections, validators and indexes (run in mongosh)
│   └── sample-data/*.json             Demo data (users, farmers, markets, products, orders ...)
├── package.json            Root scripts (install, dev, build, start, seed)
└── .gitignore
```

## Installation
**Requirements:** Node.js 20+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. Install everything (root + server + client)
npm run install:all

# 2. Create the environment file
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
#    then set MONGO_URI and JWT_SECRET (see table below)

# 3. Load the demo data
npm run seed

# 4. Start in development
npm run dev                             # web http://localhost:5173, API http://localhost:5000
```

**Production (single server):**
```bash
npm run build && npm start              # everything on http://localhost:5000
```

### Scripts
| Command | What it does |
|---|---|
| `npm run install:all` | Installs dependencies for root, server and client |
| `npm run dev` | Runs API and Vite dev server together |
| `npm run build` | Builds the React app into `client/dist` |
| `npm start` | Starts the API, which also serves `client/dist` |
| `npm run seed` | Clears and fills the database with demo data |
| `npm run export-data` | Re-creates `database/sample-data` from the current database |
| `npm run mail:test -- you@example.com` | Sends a test e-mail to check SMTP |
| `npm run lint` | Lints server and client |

### Environment variables (`server/.env`)
| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | Yes | e.g. `mongodb://127.0.0.1:27017/marketlink` or an Atlas `mongodb+srv://` string |
| `JWT_SECRET` | Yes | Long random string. Change it in production |
| `PORT` | No | Default `5000` |
| `NODE_ENV` | No | `production` when hosted |
| `TZ` | No | `Asia/Karachi`. Pickup slots and cut-offs use it |
| `CLIENT_URL` | Dev only | `http://localhost:5173` |
| `APP_URL` | No | Public site address, used for buttons in e-mails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | No | Real e-mails. If empty, e-mails are printed in the server console |
| `REDIS_URL` | No | Optional cache. If empty, memory cache is used |
| `ANTHROPIC_API_KEY` | No | Only for AI-written product descriptions. A built-in writer works without it |

### Import the database
- **Easiest:** `npm run seed` (uses the JSON in `database/sample-data`, and works with Atlas).
- **Schema only:** `mongosh "<MONGO_URI>" database/marketlink-schema.mongodb.js` creates collections with validators and indexes.

## Features
**Customer**
- Register/log in, profile photo, family sharing, password reset by e-mail
- Browse markets by city, "near me", category and day; map view with in-app driving route
- Farmer directory and profiles with stock, pickup windows and reviews
- Cart and pre-order for a pickup slot (cut-off times and slot capacity enforced)
- Order tracking: placed, accepted, ready, completed (or declined / cancelled), order history and "Order again"
- Confirm receipt, report a pickup problem, leave reviews
- Favourites, saved markets, "Remind me" alerts for sold-out products, in-app notifications
- Guest checkout with a quick account

**Farmer**
- Stall profile, markets, operating days and pickup windows
- Product and inventory management, recurring weekly stock template, stock movement history
- Accept, decline, mark ready and complete orders; handle pickup problems
- Sales dashboard and reports

**Admin**
- Approve, suspend or reject farmers; manage users (activate/deactivate)
- Manage markets, cities, categories, banners, FAQs and announcements
- Moderate reviews and flagged content, read contact messages
- Dashboard with charts and downloadable reports

**Platform**
- English and Urdu on every public, customer and farmer page, with right-to-left layout
- Built-in rule-based AI assistant (markets, farmers, products, pickup, order status). No external AI key needed; understands Urdu
- Branded HTML e-mails (order confirmation, ready for pickup, approvals, password reset)
- Responsive from 320 px to 1920 px

## Business rules
- Cash on pickup only. No payment gateway and no delivery.
- Stock is reserved atomically, so two customers cannot buy the last item.
- A customer cannot hold overlapping pickups (60-minute clash rule across markets).
- Farmers must be approved by an admin before they can list products.

## Security
bcrypt password hashing, JWT in an httpOnly SameSite cookie, role checks on API and UI, rate limits on login and forms, Helmet headers, NoSQL-operator sanitising, image-only uploads (2 MB, random file names).

## Deployment (free)
MongoDB Atlas (free M0) + Render (free web service). Root directory `MarketLink`, build `npm run install:all && npm run build`, start `npm start`, health check `/api/health`. Set `MONGO_URI`, `JWT_SECRET`, `TZ`, `NODE_ENV=production`. Run `npm run seed` once against Atlas. A blueprint is provided in `render.yaml` at the repo root. Free instances sleep when idle, so the first request can take about a minute.

## Demo logins
See the root `README.md` for the full table. Quick start: `admin@marketlink.com` / `Admin@123`, `farmer@marketlink.com` / `Farmer@123`, `customer@marketlink.com` / `Customer@123`.
