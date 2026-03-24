# MEXEL INSIGHTS
## Decision-Grade Intelligence Platform · Powered by Claude Opus

---

## What This Is

A full-stack web application that powers the Mexel Insights intelligence platform. The frontend is a professional dark-theme intelligence site. The backend is a Node.js/Express server that proxies all AI requests to Anthropic's Claude Opus model — keeping your API key secure on the server.

**AI Features powered by Claude Opus (`claude-opus-4-5`):**
- 💬 Live intelligence chat assistant (conversational analyst)
- ⚡ Rapid Response Memo (RRM) generator
- 🗺️ Scenario Briefing generator (3-scenario structure)
- 📊 Minerals & Metals Radar (MMR) signal analyser
- 🌡️ Policy Pressure Index (PPI) scorer

---

## Prerequisites

- Node.js 18+ ([nodejs.org](https://nodejs.org))
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys))

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Open .env and add your ANTHROPIC_API_KEY

# 3. Start the server
npm start

# 4. Open your browser
# http://localhost:3000
```

For development with auto-restart:
```bash
npm run dev
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Your Anthropic API key from console.anthropic.com |
| `PORT` | No | `3000` | Server port |
| `ALLOWED_ORIGIN` | No | `http://localhost:3000` | CORS allowed origin (set to your domain in production) |
| `NODE_ENV` | No | `development` | `development` or `production` |

---

## API Endpoints

All endpoints are POST requests to `/api/...` and return JSON.

### `POST /api/chat`
Conversational intelligence assistant.
```json
{
  "messages": [
    { "role": "user", "content": "What is CBAM and who does it affect?" }
  ]
}
```

### `POST /api/rrm`
Generate a Rapid Response Memo.
```json
{
  "event": "China has expanded graphite export controls...",
  "sector": "Automotive / EV",
  "region": "China / Global"
}
```

### `POST /api/scenario`
Generate a 3-scenario briefing.
```json
{
  "topic": "Iran nuclear escalation and Gulf energy supply",
  "sector": "Energy & Utilities",
  "timeframe": "12 months"
}
```

### `POST /api/mmr-signal`
Analyse a raw signal for the MMR tape.
```json
{
  "signal": "Chile introduces royalty reform for lithium extraction...",
  "material": "Lithium"
}
```

### `POST /api/ppi`
Score a sector/jurisdiction combination.
```json
{
  "sector": "Chemicals & Industrials",
  "jurisdiction": "European Union"
}
```

### `GET /api/health`
Health check. Returns model name and status.

---

## Deployment

### Option 1: Render (Recommended — Free Tier Available)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Add environment variables in the Render dashboard
6. Deploy — you get a live URL (e.g. `mexel-insights.onrender.com`)
7. Connect your custom domain in Render settings

### Option 2: Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables
4. Deploy — live in 2 minutes

### Option 3: Heroku

```bash
# Install Heroku CLI, then:
heroku create mexel-insights
heroku config:set ANTHROPIC_API_KEY=sk-ant-your-key
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGIN=https://yourdomain.com
git push heroku main
```

### Option 4: VPS / DigitalOcean

```bash
# On your server:
git clone your-repo
cd mexel-package
npm install --production
cp .env.example .env
# Edit .env with your values
# Use PM2 for process management:
npm install -g pm2
pm2 start server/index.js --name "mexel-insights"
pm2 save
pm2 startup
```

---

## Connecting Your Domain

After deploying to Render/Railway/Heroku:

1. In your hosting dashboard, find your deployment URL
2. Go to your domain registrar (GoDaddy, Namecheap, etc.)
3. Add a CNAME record: `www` → `your-deployment-url`
4. Or update nameservers to point to your hosting provider
5. Update `ALLOWED_ORIGIN` environment variable to your domain
6. SSL/HTTPS is handled automatically by all platforms above

---

## File Structure

```
mexel-package/
├── package.json          — Node dependencies and scripts
├── .env.example          — Environment variable template
├── .gitignore            — Git ignore rules
├── README.md             — This file
├── server/
│   └── index.js          — Express backend + Anthropic API proxy
└── public/
    └── index.html        — Frontend (HTML/CSS/JS — single file)
```

---

## Model

This application uses **`claude-opus-4-5`** (Claude Opus) for all AI-generated intelligence content. Opus is Anthropic's most capable model, appropriate for:

- Complex geopolitical analysis
- Multi-scenario structured reasoning
- Procurement and regulatory intelligence
- Nuanced risk assessment with confidence grading

API pricing: see [anthropic.com/pricing](https://www.anthropic.com/pricing)

Typical usage per request:
- Chat response: ~500–1,000 tokens
- RRM generation: ~1,500–2,000 tokens
- Scenario briefing: ~2,000–2,500 tokens
- MMR signal analysis: ~500–800 tokens
- PPI score: ~600–900 tokens

---

## Security Notes

1. **Never expose your API key in the frontend** — all AI calls go through the backend
2. Rate limiting is enabled: 30 requests/minute per IP address
3. CORS is configured — only your `ALLOWED_ORIGIN` can call the API
4. All inputs are validated before being sent to the API
5. Add authentication (JWT, session, or API key) before exposing to the public

---

## Customisation

**To change the AI model:** Edit `server/index.js` and change `model: 'claude-opus-4-5'`

**To change the system prompt:** Edit the `MEXEL_SYSTEM_PROMPT` constant in `server/index.js`

**To add new endpoints:** Follow the pattern in `server/index.js` — add a new `app.post('/api/your-endpoint', ...)` route

**To update the frontend:** Edit `public/index.html` — it's a self-contained single-page application

---

## Disclaimer

All AI-generated intelligence content is for informational purposes only. It does not constitute legal, financial, or investment advice. Mexel Insights Ltd.

---

*Built with Node.js · Express · Anthropic Claude Opus · HTML/CSS/JS*
