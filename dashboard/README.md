# RevOps Command Center — Dashboard

A live, read-only **Next.js** dashboard over the Supabase state layer:

- **Pipeline overview** — every deal with a health rollup (critical / watch / healthy),
  risk-flag badges, and a featured champion-engagement trend.
- **Deal detail** (`/deals/[id]`) — MEDDPICC bars for the latest call, champion score
  across calls, and the risk flags with their reasons.

Reads Supabase **server-side** (the service key stays on the server, never shipped to the browser).

## Deploy to Vercel
1. **New Project** in Vercel → import `hrobinette/revops-command-center`.
2. Set **Root Directory** to `dashboard`.
3. Add **Environment Variables** (same values as the project's `.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. **Deploy.** You'll get a live URL.

## Local dev
Create `dashboard/.env.local` with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, then:
```bash
npm install
npm run dev      # http://localhost:3000
```
