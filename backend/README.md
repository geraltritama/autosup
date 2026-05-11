# AUTOSUP Backend API

Backend system for AI-powered Supply Chain platform (Hackathon Colosseum Frontier).

## Tech Stack

- **Framework:** FastAPI
- **Database:** Supabase
- **AI:** Google Gemini AI via OpenRouter
- **Blockchain:** Solana (Devnet)
- **Deployment:** Railway

## Quick Start (Local)

1. Create `.env` file in the backend directory (copy from template)
2. (Optional, recommended) Create `backend/.env.xendit` from `backend/.env.xendit.example` and fill Xendit keys
3. Install dependencies: `pip install -r requirements.txt`
4. Run server: `python main.py` or `uvicorn main:app --reload`
5. API docs: http://127.0.0.1:8000/docs
6. Health check: http://127.0.0.1:8000/

## Xendit Env File

Use a dedicated file `backend/.env.xendit` for payment gateway secrets:

- `XENDIT_SECRET_KEY`
- `XENDIT_WEBHOOK_TOKEN`
- `XENDIT_API_BASE`
- `XENDIT_CALLBACK_BASE_URL`

`main.py` auto-loads this file if present.

## Deployment

Connect this repository to Railway. The `railway.json` handles configuration automatically:

- Start command: `python main.py`
- Health check: `GET /`
- Auto-restart on failure

Ensure environment variables (`.env`) are set in the Railway dashboard.

## Note for Frontend

- API base URL will be provided after deployment
- No folder merge needed — call API via the public URL
