// Server-side: use internal Docker URL, not the browser-facing proxy URL
const SCRAPER_URL = process.env.SCRAPER_API_URL || 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`${SCRAPER_URL}/health`, { cache: 'no-store' });
    const isOk = response.ok;
    return Response.json({ ok: isOk }, { status: isOk ? 200 : response.status || 503 });
  } catch (error) {
    console.error('[API] Arachne health check error:', error);
    return Response.json({ ok: false }, { status: 503 });
  }
}

