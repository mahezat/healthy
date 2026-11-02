# Setup on Vercel

About 10 minutes. You need your Vercel account (linked to GitHub) and your Gemini API key.

## 1. Import the repo
1. Go to vercel.com, click **Add New**, then **Project**.
2. Pick **mahezat/healthy** and click **Import**. Vercel detects Next.js; leave the build settings as they are.

## 2. Add the environment variables
On the same screen, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini API key |
| `APP_PASSCODE` | any passcode you choose. It stops strangers from using your Gemini credits through your app's URL. |

Optional (defaults are fine):

| Name | Default | What it does |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model for labels and ingredients (fastest current model) |
| `GEMINI_RESEARCH_MODEL` | same as above | Model for the company check. `gemini-3.8-flash` is slower but more thorough. |
| `COMPANY_RECHECK_DAYS` | `90` | How long a company check stays cached |
| `ALT_COUNTRY` | `en:united-states` | Market for alternatives |

Click **Deploy**.

## 3. Add the database
1. In the project, open the **Storage** tab, click **Create Database**, and choose **Neon** (Postgres). The free plan is enough.
2. Connect it to this project for all environments. Vercel adds `DATABASE_URL` automatically.
3. Go to **Deployments**, open the latest one, and click **Redeploy** so it picks up the new variable.

The tables create themselves on first use.

## 4. Check it
Open `https://<your-project>.vercel.app/api/status`. You should see:

```json
{ "database": "connected", "gemini": "key is set (unlock to test it)", "openFoodFacts": "connected", "passcodeLock": "on" }
```

If `gemini` says the key is rejected or the model is not found, fix the variable in **Settings → Environment Variables** and redeploy.

## Changing a variable later
Settings → Environment Variables → edit → then Deployments → Redeploy. Variables only apply to new deployments.

## Running it on a computer
```
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY (DATABASE_URL optional; without it data is kept in memory)
npm run dev
npm test                     # unit tests
LIVE=1 npx vitest run tests/live.test.ts   # checks against Open Food Facts
```
