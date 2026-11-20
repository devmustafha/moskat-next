/** Lightweight health check for uptime monitoring: GET /api/health */
export function GET() {
  return Response.json({ status: "ok" });
}
