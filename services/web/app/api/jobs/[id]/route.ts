import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const url = `${SCRAPER_API_URL}/scrape/status?id=${jobId}`;
    
    console.log(`[API] Fetching job status from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for real-time updates
    });

    console.log(`[API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Error response: ${errorText}`);
      return NextResponse.json(
        { 
          error: errorText || 'Job not found',
          debug: {
            url,
            status: response.status,
            jobId,
          }
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API] Job data retrieved successfully for job ${jobId}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Job status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch job status',
        details: error instanceof Error ? error.message : 'Unknown error',
        backendUrl: SCRAPER_API_URL,
      },
      { status: 500 }
    );
  }
}


