const AI_URL = process.env.AI_URL || 'http://localhost:3001';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`${AI_URL}/health`, { cache: 'no-store' });
    const isOk = response.ok;
    return Response.json(
      { ok: isOk },
      { status: isOk ? 200 : response.status || 503 }
    );
  } catch (error) {
    console.error('[API] AI health check error:', error);
    return Response.json({ ok: false }, { status: 503 });
  }
}

