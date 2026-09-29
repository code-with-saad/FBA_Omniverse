# MarketLink

Farmers-market pre-order app (MERN). Customers pre-order, farmers confirm, everyone pays cash at pickup. English + Urdu.

## Structure
```
MarketLink/
├── client/     React 19 + Vite front end
├── server/     Express 5 + Mongoose API (also serves the built client)
├── database/   Schema script + sample-data/ (JSON) for importing
├── package.json  root scripts
└── .gitignore
```

## Installation
Needs Node 20+ and MongoDB (local or Atlas).
```bash
npm run install:all                 # installs root, server and client
cp server/.env.example server/.env  # set MONGO_URI and JWT_SECRET
npm run seed                        # loads demo data (see database/sample-data)
npm run dev                         # client :5173, API :5000
```
Production: `npm run build && npm start` (one server, port 5000).

## Features
- **Customer:** browse markets/farmers on a map, pre-order for a pickup slot, order history, favourites, restock alerts
- **Farmer:** stall profile, inventory, accept/ready/complete orders, reports
- **Admin:** approve farmers, manage markets, categories and users, moderation, reports
- English/Urdu (RTL), AI assistant, JWT httpOnly-cookie login, e-mail notifications
