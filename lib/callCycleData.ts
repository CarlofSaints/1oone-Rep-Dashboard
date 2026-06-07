import { readJson, writeJson, deleteBlob } from './blob';
import type { CallCycleEntry, CallCycleUploadMeta } from './types';

const INDEX_KEY = 'call-cycle/index.json';

export async function loadCallCycleIndex(): Promise<CallCycleUploadMeta[]> {
  return readJson<CallCycleUploadMeta[]>(INDEX_KEY, []);
}

export async function saveCallCycleIndex(index: CallCycleUploadMeta[]): Promise<void> {
  await writeJson(INDEX_KEY, index);
}

export async function loadCallCycleData(uploadId: string): Promise<CallCycleEntry[]> {
  return readJson<CallCycleEntry[]>(`call-cycle/${uploadId}.json`, []);
}

export async function saveCallCycleData(uploadId: string, entries: CallCycleEntry[]): Promise<void> {
  await writeJson(`call-cycle/${uploadId}.json`, entries);
}

export async function deleteCallCycleUpload(uploadId: string): Promise<void> {
  await deleteBlob(`call-cycle/${uploadId}.json`);
  const index = await loadCallCycleIndex();
  const updated = index.filter(u => u.id !== uploadId);
  await saveCallCycleIndex(updated);
}

/**
 * Merge all uploads — latest upload wins per rep+store+day combination.
 */
export async function getMergedCallCycle(): Promise<CallCycleEntry[]> {
  const index = await loadCallCycleIndex();
  const map = new Map<string, CallCycleEntry>();

  // Process oldest to newest so latest wins
  const sorted = [...index].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  for (const meta of sorted) {
    const entries = await loadCallCycleData(meta.id);
    for (const entry of entries) {
      const key = `${entry.repEmail.toLowerCase()}|${(entry.storeCode || entry.storeName).toLowerCase()}|${entry.day.toLowerCase()}`;
      map.set(key, entry);
    }
  }

  return Array.from(map.values());
}

/**
 * Get stores scheduled for a given rep on a specific date.
 */
export function getScheduledStores(
  callCycle: CallCycleEntry[],
  repEmail: string,
  date: Date
): CallCycleEntry[] {
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  const weekOfMonth = Math.ceil(date.getDate() / 7); // 1-5

  return callCycle.filter(entry => {
    if (entry.repEmail.toLowerCase() !== repEmail.toLowerCase()) return false;
    if (entry.day.toLowerCase() !== dayName.toLowerCase()) return false;

    if (entry.frequency === 'weekly') return true;
    if (entry.frequency === 'fortnightly') {
      // Week 1,3 or 2,4
      if (entry.week) {
        return weekOfMonth % 2 === entry.week % 2;
      }
      return weekOfMonth % 2 === 1; // default: odd weeks
    }
    if (entry.frequency === 'monthly') {
      if (entry.week) return weekOfMonth === entry.week;
      return weekOfMonth === 1; // default: first week
    }
    return true;
  });
}
