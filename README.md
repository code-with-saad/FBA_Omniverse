# FBA_Omniverse – MarketLink (TechWizz 7, Team Omniverse)

Farmers-market pre-order web app: MongoDB, Express, React, Node. Cash on pickup.

## Folders
| Folder | Contents |
|---|---|
| `MarketLink/` | The app: `client`, `server`, `database`, `package.json` (see its README) |
| `Video Demo/` | Demo video |
| `screenshots/` | Page screenshots |
| `documentation/` | Project Report (`.docx` and `.pdf`) |
| `render.yaml` | Render deployment blueprint |

## Login credentials (demo data, after `npm run seed`)
| Role | State | E-mail | Password |
|---|---|---|---|
| Admin | Active | admin@marketlink.com | Admin@123 |
| Customer | Active | customer@marketlink.com | Customer@123 |
| Customer | Deactivated | inactive.customer@marketlink.com | Customer@123 |
| Farmer | Approved | farmer@marketlink.com | Farmer@123 |
| Farmer | Waiting for approval | pending.farmer@marketlink.com | Farmer@123 |
| Farmer | Suspended | suspended.farmer@marketlink.com | Farmer@123 |

## Run locally
```bash
cd MarketLink
npm run install:all
cp server/.env.example server/.env   # set MONGO_URI, JWT_SECRET
npm run seed
npm run dev                          # http://localhost:5173
```

## Live site
URL: (add after deployment)
