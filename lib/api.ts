import { connection } from "next/server";
import { HttpError } from "./config";

/** Wraps a route handler: JSON errors with a plain message, never a stack trace. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<Response> => {
    // Always run at request time (never prerendered at build).
    await connection();
    try {
      const data = await fn(...args);
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Send a JSON body.");
  }
}
