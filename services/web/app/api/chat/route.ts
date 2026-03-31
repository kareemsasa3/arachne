import { NextRequest, NextResponse } from 'next/server';
import { isJsonContentType, toBodyPreview } from '@/lib/api';

const AI_URL = process.env.AI_URL || 'http://localhost:3001';

// Allow long-running chat generations
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error, status }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${AI_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      const rawBody = await response.text();
      const preview = toBodyPreview(rawBody);

      if (isJsonContentType(contentType) && rawBody) {
        try {
          const data = JSON.parse(rawBody) as Record<string, unknown>;
          const error =
            typeof data.error === 'string' && data.error.trim().length > 0
              ? data.error
              : `Chat upstream request failed (${response.status})`;
          return NextResponse.json(
            { ...data, error, status: response.status },
            { status: response.status },
          );
        } catch {
          console.warn('[API] Chat upstream returned invalid JSON error payload', {
            status: response.status,
            preview,
          });
        }
      }

      const fallbackError =
        response.status === 504
          ? 'Upstream chat request timed out'
          : `Chat upstream request failed (${response.status})`;

      console.warn('[API] Chat upstream returned non-OK response', {
        status: response.status,
        contentType,
        preview,
      });

      return jsonError(preview ? `${fallbackError}: ${preview}` : fallbackError, response.status);
    }

    if (!isJsonContentType(contentType)) {
      const rawBody = await response.text();
      const preview = toBodyPreview(rawBody);
      console.warn('[API] Chat upstream returned non-JSON success payload', {
        status: response.status,
        contentType,
        preview,
      });
      return jsonError(
        preview
          ? `Chat upstream returned non-JSON response: ${preview}`
          : 'Chat upstream returned non-JSON response',
        502,
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API] Chat proxy error:', error);
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? 'Upstream chat request timed out'
        : 'Failed to process chat request';
    const status = message === 'Upstream chat request timed out' ? 504 : 500;
    return jsonError(message, status);
  }
}

