/** GET /api/health – explicit serverless route so Vercel always deploys it. */
export default function handler(_req: unknown, res: { status(code: number): { json(body: unknown): void } }) {
  res.status(200).json({ ok: true });
}
