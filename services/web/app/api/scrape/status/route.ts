import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:8080';

// GET /api/scrape/status?id=JOB_ID
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('id');
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 },
      );
    }

    const url = `${SCRAPER_API_URL}/scrape/status?id=${jobId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: text || 'Job not found',
          debug: { url, status: response.status, jobId },
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API] Scrape status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch job status',
        details: error instanceof Error ? error.message : 'Unknown error',
        backendUrl: SCRAPER_API_URL,
      },
      { status: 500 },
    );
  }
}


