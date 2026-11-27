# Cookin

Private meal-planning web app for Cory's family: kitchen inventory, NYT Cooking Recipe Box sync,
weekly dinners and lunches, and a grocery list for Google Keep.

```bash
npm install
npm run dev        # UI only, local mode (data in localStorage), http://localhost:5173
npm run dev:full   # UI + API + local D1 via wrangler (copy .dev.vars.example to .dev.vars, run db:migrate:local first)
npm test
```

Add `?demo=1` to load demo data. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
