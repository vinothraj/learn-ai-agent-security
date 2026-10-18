import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { cloud } from '@/sync/auth';

/** Shape returned by GET /v1/news. Source facts and interpretation are deliberately separate. */
export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  retrievedAt: string;
  category: string;
  categoryLabel: string;
  sourceExcerpt: string;
  interpretation: { summary: string; origin: 'template' | 'ai' | 'editor'; defense: string };
  vulnIds: string[];
  verification: 'source_verified' | 'unverified';
  highImpact: boolean;
  links: { lessonId: string | null; labId: string | null; interviewId: string | null };
}

interface NewsCtx {
  available: boolean;
  articles: NewsArticle[];
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CACHE_KEY = 'news_cache';
const STALE_MS = 30 * 60_000;
const Ctx = createContext<NewsCtx | null>(null);

/** News needs no account: the endpoint is public. The last result is cached for offline reading. */
export function NewsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const available = !!cloud.apiUrl;
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${cloud.apiUrl}/v1/news?limit=30`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { articles: NewsArticle[] };
      const now = Date.now();
      setArticles(json.articles);
      setFetchedAt(now);
      await db.runAsync(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        CACHE_KEY,
        JSON.stringify({ fetchedAt: now, articles: json.articles }),
      );
    } catch {
      setError('Could not load the latest news. Showing saved items.');
    } finally {
      setLoading(false);
    }
  }, [available, db]);

  useEffect(() => {
    if (!available) return;
    db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', CACHE_KEY).then((row) => {
      let cachedAt = 0;
      if (row) {
        try {
          const c = JSON.parse(row.value) as { fetchedAt: number; articles: NewsArticle[] };
          setArticles(c.articles);
          setFetchedAt(c.fetchedAt);
          cachedAt = c.fetchedAt;
        } catch {
          // ignore a corrupt cache
        }
      }
      if (Date.now() - cachedAt > STALE_MS) fetchNews();
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchNews();
    });
    return () => sub.remove();
  }, [available, db, fetchNews]);

  return <Ctx.Provider value={{ available, articles, fetchedAt, loading, error, refresh: fetchNews }}>{children}</Ctx.Provider>;
}

export function useNews() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNews must be used inside NewsProvider');
  return ctx;
}

export function relativeDate(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? `${days} days ago` : new Date(iso).toLocaleDateString();
}
