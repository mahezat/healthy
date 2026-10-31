// All settings come from environment variables (set them in Vercel, see SETUP.md).

export const config = {
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  /** Fastest current model per Google's model list (Oct 2026). Change in Vercel without a code change. */
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  /** Used for the company deep check (Google Search grounding). */
  geminiResearchModel: process.env.GEMINI_RESEARCH_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  /** If set, every API call needs this passcode (cookie from /api/unlock or x-app-key header). */
  passcode: process.env.APP_PASSCODE ?? "",
  userAgent: process.env.OFF_USER_AGENT ?? "Healthy/0.1 (+https://github.com/mahezat/healthy)",
  /** Re-run the AI company check after this many days. */
  companyRecheckDays: Number(process.env.COMPANY_RECHECK_DAYS ?? 90),
  /** Market for alternatives (Open Food Facts country tag). */
  altCountry: process.env.ALT_COUNTRY ?? "en:united-states",
};

export function requireGemini() {
  if (!config.geminiKey) throw new HttpError(503, "GEMINI_API_KEY is not set in Vercel.");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
