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

type CopyStatus = {
  index: number;
  state: 'success' | 'error';
} | null;

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
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(variant !== 'widget');
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const isEmbedded = variant === 'home';
  const isWidget = variant === 'widget';
  const isFull = variant === 'full';
  const canInteract = !isEmbedded;
  const styles = getVariantStyles(variant);
  const surfaceFrameClass = isFull
    ? 'rounded-none border-0 bg-transparent shadow-none md:rounded-xl md:border md:border-gray-200/60 md:shadow-md md:shadow-black/10'
    : `${styles.surfaceTone} rounded-xl shadow-md shadow-black/10`;
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

  const clearCopiedTimeout = () => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
  };

  const setCopyFeedback = (index: number, state: 'success' | 'error') => {
    setCopyStatus({ index, state });
    clearCopiedTimeout();
    copiedTimeoutRef.current = setTimeout(() => setCopyStatus(null), 2000);
  };

  const copyWithExecCommand = (text: string) => {
    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      textarea.blur();
      document.body.removeChild(textarea);
    }

    return copied;
  };

  const resizeComposer = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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

  const handleCopy = async (text: string, idx: number) => {
    const plainText = text.trim();
    if (!plainText) {
      setCopyFeedback(idx, 'error');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
        setCopyFeedback(idx, 'success');
        return;
      }
    } catch {
      // fall through to execCommand fallback
    }

    if (copyWithExecCommand(plainText)) {
      setCopyFeedback(idx, 'success');
      return;
    }

    setCopyFeedback(idx, 'error');
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
    resizeComposer();
  }, [input]);

  useEffect(() => {
    return () => {
      clearNoticeTimeout();
      clearCopiedTimeout();
    };
  }, []);

  const markdownClassName = (isUser: boolean) =>
    `prose prose-sm max-w-none leading-relaxed break-words [overflow-wrap:anywhere] ${
      isUser ? 'prose-invert' : ''
    } prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:text-inherit prose-pre:my-2 prose-pre:max-w-full prose-table:block prose-table:w-full`;

  const chatSurface = (
    <section
      className={`${surfaceFrameClass} min-h-0 flex flex-1 flex-col overflow-hidden backdrop-blur-sm backdrop-saturate-125 supports-[backdrop-filter]:backdrop-blur-sm ${
        styles.chatSurfaceHeight
      }`}
    >
      <div
        ref={listRef}
        className={`${styles.messageAreaClass} min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 ${styles.listBgTone}`}
      >
        {messages.length === 0 && (
          <div className={`flex min-h-full items-center justify-center ${isFull ? 'py-8' : ''}`}>
            <div
              className={`max-w-md text-sm ${styles.emptyTextTone} ${isFull ? 'space-y-4 text-center' : 'rounded-2xl border border-white/10 p-4'}`}
            >
              <p>Start by asking me to scrape a URL or summarize a job posting.</p>
              {isFull && (
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.slice(0, 2).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSuggestion(s)}
                      disabled={!canInteract || isSending || quotaExceeded}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-left text-xs text-white/90 transition-colors hover:border-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-4">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm border overflow-hidden ${
                      isUser
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-100 text-gray-900 border-gray-200'
                    }`}
                  >
                    <div className="mb-1 text-[11px] uppercase tracking-wide opacity-80">
                      {isUser ? 'You' : 'Assistant'}
                    </div>
                    <div className={markdownClassName(isUser)}>
                      <ReactMarkdown
                        components={{
                          pre: ({ children }) => (
                            <pre className="max-w-full overflow-x-auto rounded-xl bg-black/70 p-3 text-xs leading-relaxed text-inherit">
                              {children}
                            </pre>
                          ),
                          code: ({ children, className, ...props }) => {
                            const isInline = !className;
                            if (isInline) {
                              return (
                                <code
                                  {...props}
                                  className="break-words rounded bg-black/15 px-1 py-0.5 text-[0.95em] text-inherit"
                                >
                                  {children}
                                </code>
                              );
                            }

                            return (
                              <code {...props} className={className}>
                                {children}
                              </code>
                            );
                          },
                          table: ({ children }) => (
                            <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-black/10">
                              <table className="w-full min-w-max border-collapse text-left text-xs">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => <th className="border-b border-black/10 px-2 py-1.5 font-medium">{children}</th>,
                          td: ({ children }) => <td className="border-b border-black/5 px-2 py-1.5 align-top">{children}</td>,
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all underline underline-offset-2"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                    {!isUser && (
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopy(m.content, idx)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            copyStatus?.index === idx && copyStatus.state === 'error'
                              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {copyStatus?.index === idx
                            ? copyStatus.state === 'success'
                              ? 'Copied'
                              : 'Copy failed'
                            : 'Copy response'}
                        </button>
                      </div>
                    )}
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

      <form
        onSubmit={handleSend}
        className={`border-t border-gray-200/40 bg-transparent px-4 md:px-6 pt-3 md:pt-4 ${isFull ? 'pb-3 md:pb-4' : 'py-4'}`}
        style={isFull ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!canInteract || isSending || quotaExceeded}
            placeholder={inputPlaceholder}
            className={`flex-1 border border-gray-300 rounded-2xl px-3 py-3 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-sm bg-white/90 text-gray-900 placeholder:text-gray-500 min-h-[48px] max-h-40 overflow-y-auto resize-none leading-5 ${
              !canInteract || quotaExceeded ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            rows={1}
          />
          <div className="hidden items-center gap-2 md:flex">
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
          <button
            type="submit"
            disabled={!canInteract || isSending || quotaExceeded}
            className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-medium text-white transition-colors shadow-sm md:hidden ${
              !canInteract || isSending || quotaExceeded
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSending ? 'Thinking…' : 'Send'}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          {!canInteract && (
            <p className="text-xs text-gray-600">
              Chat controls are disabled in embedded mode. Open the full chat to interact.
            </p>
          )}
          {isFull && canInteract && (
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-white/70 transition-colors hover:text-white md:hidden"
            >
              Clear conversation
            </button>
          )}
        </div>
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
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:px-6 md:py-6">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden md:mx-auto md:max-w-5xl">
        <header
          className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:hidden"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div>
            <h1 className={`text-lg font-semibold ${styles.headingTone}`}>Ask Arachne</h1>
            <p className={`text-xs ${styles.subheadingTone}`}>Mobile chat</p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
          >
            Home
          </Link>
        </header>
        <header className="hidden items-center justify-between gap-3 px-4 py-3 md:flex md:px-6 md:py-4">
          <h1 className={`text-2xl font-semibold ${styles.headingTone}`}>Ask Arachne</h1>
          <p className={`text-sm ${styles.subheadingTone}`}>Kick off scrapes, summarize, or extract structured data.</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:grid md:grid-cols-1 md:gap-4 md:px-4 md:pb-16 md:overflow-hidden lg:grid-cols-3 md:px-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-span-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {chatSurface}
            </div>
          </div>

          <aside className="hidden min-h-0 overflow-auto pr-1 lg:block lg:space-y-4">
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
