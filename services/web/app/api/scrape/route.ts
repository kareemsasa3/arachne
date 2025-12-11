import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:8080';

// Allow long-running scrape submissions (up to 5 minutes)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${SCRAPER_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit scrape job' },
      { status: 500 }
    );
  }
}
