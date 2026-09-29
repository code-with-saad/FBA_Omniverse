# FBA_Omniverse – MarketLink (TechWizz 7, Team Omniverse)

Farmers-market pre-order web app: MongoDB, Express, React, Node. Cash on pickup.

## Folders
| Folder | Contents |
|---|---|
| `MarketLink/` | The app: `client`, `server`, `database`, `package.json` (see its README) |
| `Demo Video & Screenshots/` | Demo video & Screenshots |
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

## One-click start (for judges)
Needs Node.js 20+ and a running MongoDB (local, or a MongoDB Atlas string in `MarketLink/server/.env`).
- **Windows:** double-click `MarketLink/start.bat`
- **macOS / Linux:** `bash MarketLink/start.sh`

On the first run it creates `server/.env`, installs packages, builds the site, loads the demo data and opens http://localhost:5000. Later runs just start the server. Log in with the credentials above.

## Run locally
```bash
cd MarketLink
npm run install:all
cp server/.env.example server/.env   # set MONGO_URI, JWT_SECRET
npm run seed
npm run dev                          # http://localhost:5173
```

## Video Demo
URL: [Demo Video](https://github.com/code-with-saad/FBA_Omniverse/blob/main/Demo%20Video%20%26%20Screenshots/demo_video.mp4)

## Project Report
URL: [Report](https://github.com/code-with-saad/FBA_Omniverse/blob/main/documentation/MarketLink-Project-Report.pdf)
