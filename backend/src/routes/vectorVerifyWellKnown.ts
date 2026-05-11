import type { Application, Request, Response } from "express";

/**
 * [Vector](https://zauthx402.com/docs/vector) domain verification for hosted platforms:
 * serve `GET /.well-known/vector-verify` as `{"token":"<value>"}` when `VECTOR_VERIFY_TOKEN` is set.
 */
export function registerVectorVerifyWellKnownRoute(app: Application): void {
  app.get("/.well-known/vector-verify", (_req: Request, res: Response) => {
    const token = process.env.VECTOR_VERIFY_TOKEN?.trim();
    if (!token) {
      res.status(404).setHeader("Cache-Control", "no-store").json({ error: "vector_verify_not_configured" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ token });
  });
}
