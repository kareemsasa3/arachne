'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@/lib/hooks/useChat';

const SUGGESTIONS = [
  'Scrape https://example.com and summarize it',
  'Show me my recent scrapes',
  'Extract JSON with title, price, and availability from https://example.com/product/123',
  'Summarize this job: https://example.com/jobs/backend',
];

type ChatVariant = 'full' | 'home' | 'widget';

type VariantStyles = {
  labelTone: string;
  headingTone: string;
  subheadingTone: string;
  emptyTextTone: string;
  surfaceTone: string;
  listBgTone: string;
  chatSurfaceHeight: string;
  messageAreaClass: string;
};

const getVariantStyles = (variant: ChatVariant): VariantStyles => {
  switch (variant) {
    case 'home':
      return {
        labelTone: 'text-gray-200 drop-shadow',
        headingTone: 'text-white drop-shadow-sm',
        subheadingTone: 'text-gray-100/90 drop-shadow',
        emptyTextTone: 'text-white/80',
        surfaceTone: 'bg-transparent border border-gray-200/60',
        listBgTone: 'bg-transparent',
        chatSurfaceHeight: 'h-[520px]',
        messageAreaClass: 'h-[360px] sm:h-[400px]',
      };
    case 'widget':
      return {
        labelTone: 'text-gray-900',
        headingTone: 'text-gray-900',
        subheadingTone: 'text-gray-700',
        emptyTextTone: 'text-gray-500',
        surfaceTone: 'bg-white border border-gray-200 text-gray-900',
        listBgTone: 'bg-white',
        chatSurfaceHeight: 'flex-1',
        messageAreaClass: 'flex-1',
      };
    default:
      return {
        labelTone: 'text-gray-500',
        headingTone: 'text-white',
        subheadingTone: 'text-white/80',
        emptyTextTone: 'text-white/80',
        surfaceTone: 'bg-transparent border border-gray-200/60',
        listBgTone: 'bg-transparent',
        chatSurfaceHeight: 'flex-1',
        messageAreaClass: 'flex-1',
      };
  }
};

interface ChatExperienceProps {
  variant?: ChatVariant;
}

export default function ChatExperience({ variant = 'full' }: ChatExperienceProps) {
  const {
    messages,
    isSending,
    error,
    sendMessage,
    clear,
    quotaExceeded,
  } = useChat();

  const [input, setInput] = useState('');
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(variant !== 'widget');
  const listRef = useRef<HTMLDivElement | null>(null);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const isEmbedded = variant === 'home';
  const isWidget = variant === 'widget';
  const canInteract = !isEmbedded;
  const styles = getVariantStyles(variant);
  const inputPlaceholder = isWidget
    ? 'Send Message'
    : 'Ask me to scrape a URL or summarize recent scrapes';

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const clearNoticeTimeout = () => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!canInteract || !input.trim() || quotaExceeded) return;
    const text = input.trim();
    setInput('');
    const result = await sendMessage(text);
    if (result?.jobId) {
      setLastJobId(result.jobId);
      setNotice(`Started scrape job ${result.jobId}`);
      clearNoticeTimeout();
      noticeTimeoutRef.current = setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleSuggestion = async (text: string) => {
    if (!canInteract) return;
    setInput('');
    const result = await sendMessage(text);
    if (result?.jobId) {
      setLastJobId(result.jobId);
      setNotice(`Started scrape job ${result.jobId}`);
      clearNoticeTimeout();
      noticeTimeoutRef.current = setTimeout(() => setNotice(null), 4000);
    }
  };

  useEffect(() => {
    return () => {
      clearNoticeTimeout();
    };
  }, []);

  const chatSurface = (
    <section
      className={`${styles.surfaceTone} min-h-0 rounded-xl shadow-md shadow-black/10 backdrop-blur-sm backdrop-saturate-125 supports-[backdrop-filter]:backdrop-blur-sm flex flex-col overflow-hidden ${
        styles.chatSurfaceHeight
      }`}
    >
      <div
        ref={listRef}
        className={`${styles.messageAreaClass} min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 ${styles.listBgTone}`}
      >
        {messages.length === 0 && (
          <div className={`text-sm ${styles.emptyTextTone} rounded-lg p-4`}>
            Start by asking me to scrape a URL or summarize a job posting. I can also show your recent scrapes.
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm border ${
                  isUser
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 text-gray-900 border-gray-200'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide mb-1 opacity-80">
                  {isUser ? 'You' : 'Assistant'}
                </div>
                <div
                  className={`prose prose-sm max-w-none leading-relaxed ${
                    isUser ? 'prose-invert' : ''
                  } prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:text-inherit`}
                >
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
        {quotaExceeded && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm border bg-gray-100 text-gray-900 border-gray-200">
              <div className="text-[11px] uppercase tracking-wide mb-1 opacity-80">Assistant</div>
              <div className="leading-relaxed">
                Limit reached. Please try again later—your limit resets daily.
              </div>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="px-4 py-2 text-sm bg-amber-50 border-t border-amber-200 text-amber-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-sm bg-red-50 border-t border-red-200 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-gray-200/40 bg-transparent px-4 md:px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!canInteract || isSending || quotaExceeded}
            placeholder={inputPlaceholder}
            className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-sm bg-white/90 text-gray-900 placeholder:text-gray-500 min-h-[44px] max-h-32 overflow-y-auto resize-none leading-5 ${
              !canInteract || quotaExceeded ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            rows={1}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={canInteract ? clear : undefined}
              disabled={!canInteract}
              className="px-3 py-2 text-sm border border-gray-300/60 rounded-lg bg-white/70 hover:bg-white transition-colors text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={!canInteract || isSending || quotaExceeded}
              className={`px-4 py-2 text-sm rounded-lg text-white transition-colors shadow-sm ${
                !canInteract || isSending || quotaExceeded
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSending ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </div>
        {!canInteract && (
          <p className="mt-2 text-xs text-gray-600">
            Chat controls are disabled in embedded mode. Open the full chat to interact.
          </p>
        )}
      </form>

      {isEmbedded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100/40 bg-transparent">
          <p className="text-xs font-medium text-white/80 mb-2">Try one</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestion(s)}
                disabled={!canInteract || isSending || quotaExceeded}
                className="text-xs px-3 py-2 rounded-full border border-gray-200/70 bg-white/60 text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  if (isWidget) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {isWidgetOpen && (
          <div className="w-[360px] max-w-[92vw] rounded-xl shadow-2xl border border-gray-200 bg-gray-800 backdrop-blur-sm backdrop-saturate-125 supports-[backdrop-filter]:backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
              <div>
                <p className="text-[11px] uppercase tracking-wide opacity-80">Assistant</p>
                <p className="text-sm font-semibold">Ask Arachne</p>
              </div>
              <button
                type="button"
                onClick={() => setIsWidgetOpen(false)}
                className="text-xs rounded-md border border-white/30 px-2 py-1 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-3 flex-1 min-h-0 flex flex-col">{chatSurface}</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsWidgetOpen((v) => !v)}
          className="rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors border border-blue-500"
        >
          {isWidgetOpen ? 'Hide chat' : 'Chat with Arachne'}
        </button>
      </div>
    );
  }

  if (isEmbedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.2em] ${styles.labelTone}`}>AI assistant</p>
            <h2 className={`text-2xl font-semibold ${styles.headingTone}`}>Ask Arachne</h2>
            <p className={`text-sm ${styles.subheadingTone}`}>Kick off scrapes, summarize, or extract structured data.</p>
          </div>
          <Link
            href="/chat"
            className="hidden sm:inline-flex px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
          >
            Open full chat →
          </Link>
        </div>
        {chatSurface}
      </div>
    );
  }

  return (
    <main className="flex flex-col h-screen px-3 md:px-6 py-6">
      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
        <header className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-3">
          <h1 className={`text-2xl font-semibold ${styles.headingTone}`}>Ask Arachne</h1>
          <p className={`text-sm ${styles.subheadingTone}`}>Kick off scrapes, summarize, or extract structured data.</p>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 md:px-6 pb-16 min-h-0 overflow-hidden">
          <div className="lg:col-span-2 min-h-0 flex flex-col overflow-hidden">{chatSurface}</div>

          <aside className="space-y-4 overflow-auto pr-1 min-h-0">
            <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Try these</h3>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white hover:border-blue-300 hover:bg-blue-500/20 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm p-4">
              <h3 className="text-sm font-semibold text-white mb-2">What I can do</h3>
              <ul className="text-sm text-white/90 space-y-1 list-disc list-inside">
                <li>Kick off scrapes from a URL (returns job ID)</li>
                <li>Summarize existing scrapes or pasted content</li>
                <li>Extract JSON fields from a page</li>
                <li>Show recent scrapes (via Arachne memory)</li>
              </ul>
            </div>
            {lastJobId && (
              <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm p-4 text-sm text-white/90">
                Latest job started: <code className="bg-white/10 px-1 rounded text-white">{lastJobId}</code>{' '}
                <Link href={`/jobs/${lastJobId}`} className="text-blue-200 hover:underline">
                  view status
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

