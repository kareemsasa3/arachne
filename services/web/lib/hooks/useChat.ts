import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';

type Role = 'user' | 'assistant';

export type ChatMessage = {
  role: Role;
  content: string;
  timestamp: number;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type ChatResponse = {
  response: string;
  jobId?: string | null;
  usedCache?: boolean;
  cacheAge?: number | null;
  timestamp?: number;
  error?: string;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  quotaExceeded?: boolean;
  dailyRequestsUsed?: number;
  dailyRequestsLimit?: number;
};

const LOCAL_STORAGE_KEY = 'arachne:chatHistory';

export function useChat(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState({
    prompt: 0,
    completion: 0,
    total: 0,
  });
  const [sessionTokens, setSessionTokens] = useState(0);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBrowser = typeof window !== 'undefined';

  // Persist / load chat history
  useEffect(() => {
    if (!isBrowser) return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [isBrowser]);

  useEffect(() => {
    if (!isBrowser) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, isBrowser]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return null;
      if (isSending) return null;

      const userMessage: ChatMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      const historyPayload = [...messages, userMessage]
        .slice(-20)
        .map(({ role, content, timestamp }) => ({ role, content, timestamp }));

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
          }),
          signal: controller.signal,
        });

        const data: ChatResponse = await resp.json();
        if (!resp.ok) {
          if (resp.status === 429 && data.quotaExceeded) {
            setQuotaExceeded(true);
            setQuotaInfo({
              used: data.dailyRequestsUsed || 0,
              limit: data.dailyRequestsLimit || 0,
            });
            setError(data.error || 'Daily quota exceeded');
            return null;
          }
          throw new Error(data?.error || 'Chat request failed');
        }

        if (data.quotaExceeded) {
          setQuotaExceeded(true);
          setQuotaInfo({
            used: data.dailyRequestsUsed || 0,
            limit: data.dailyRequestsLimit || 0,
          });
        } else {
          setQuotaExceeded(false);
        }

        if (data.tokensUsed) {
          setTokensUsed({
            prompt: data.tokensUsed.promptTokens || 0,
            completion: data.tokensUsed.completionTokens || 0,
            total: data.tokensUsed.totalTokens || 0,
          });
          setSessionTokens((prev) => prev + (data.tokensUsed?.totalTokens || 0));
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response || 'No response.',
          timestamp: data.timestamp || Date.now(),
          tokensUsed: data.tokensUsed
            ? {
                promptTokens: data.tokensUsed.promptTokens || 0,
                completionTokens: data.tokensUsed.completionTokens || 0,
                totalTokens: data.tokensUsed.totalTokens || 0,
              }
            : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return { ...data, message: assistantMessage };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Chat request failed';
        setError(message);
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    if (isBrowser) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [isBrowser]);

  const state = useMemo(
    () => ({
      messages,
      isSending,
      error,
      tokensUsed,
      sessionTokens,
      quotaExceeded,
      quotaInfo,
    }),
    [messages, isSending, error, tokensUsed, sessionTokens, quotaExceeded, quotaInfo],
  );

  return {
    ...state,
    sendMessage,
    clear,
  };
}


