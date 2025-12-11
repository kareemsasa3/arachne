import { NextRequest, NextResponse } from 'next/server';

const AI_URL = process.env.AI_URL || 'http://localhost:3001';

interface ScrapedData {
  url: string;
  title: string;
  status: number;
  size: number;
  error?: string;
  scraped: string;
  content?: string;
}

interface SummarizeRequest {
  jobId: string;
  results: ScrapedData[];
  stream?: boolean;
}

// Helper to extract and combine content from results
function extractContent(results: ScrapedData[]) {
  const contentPieces = results
    .filter(result => result.content && result.content.trim().length > 0)
    .map(result => (result.content || '').trim());

  const combinedContent = contentPieces.join('\n\n---\n\n');
  const primaryResult = results.find(r => r.content && r.content.trim().length > 0);
  
  return {
    content: combinedContent,
    url: primaryResult?.url || '',
    title: primaryResult?.title || '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SummarizeRequest = await request.json();
    const { jobId, results, stream = false } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Results array is required and must not be empty' },
        { status: 400 }
      );
    }

    const { content, url, title } = extractContent(results);

    if (!content) {
      return NextResponse.json(
        { error: 'No content found in results to summarize' },
        { status: 400 }
      );
    }

    // If streaming requested, proxy the SSE stream from AI backend
    if (stream) {
      console.log(`Starting streaming summarization for job ${jobId}...`);
      
      const aiResponse = await fetch(`${AI_URL}/summarize/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          url,
          title,
          jobId,
        }),
      });

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        console.error('AI backend streaming error:', errorData);
        return NextResponse.json(
          { error: errorData.error || 'Failed to start streaming summary' },
          { status: aiResponse.status }
        );
      }

      // Create a TransformStream to proxy the SSE response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Pipe the AI backend response to the client
      (async () => {
        const reader = aiResponse.body?.getReader();
        if (!reader) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'No response body', done: true })}\n\n`));
          await writer.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } catch (e) {
          console.error('Stream proxy error:', e);
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error', done: true })}\n\n`));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming: call regular /summarize endpoint
    console.log(`Sending summarization request for job ${jobId} to AI backend /summarize endpoint...`);
    const aiResponse = await fetch(`${AI_URL}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        url,
        title,
        jobId,
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      console.error('AI backend error:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate summary' },
        { status: aiResponse.status }
      );
    }

    const aiData = await aiResponse.json();
    console.log(`Summary generated successfully for job ${jobId}`);

    return NextResponse.json({
      summary: aiData.summary,
      timestamp: aiData.timestamp || Date.now(),
    });
  } catch (error) {
    console.error('Summarize API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

