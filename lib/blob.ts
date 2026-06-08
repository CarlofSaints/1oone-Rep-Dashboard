import { list, put, del } from '@vercel/blob';

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    const match = blobs.find(b => b.pathname === key);
    if (!match) return fallback;
    const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    const text = await res.text();
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, data: T): Promise<void> {
  await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function deleteBlob(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    // ignore - key may not exist
  }
}
