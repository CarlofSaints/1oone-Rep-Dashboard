import { readJson, writeJson, deleteBlob } from './blob';
import type { CallCycleEntry, CallCycleUploadMeta } from './types';

const INDEX_KEY = 'call-cycle/index.json';

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
 * Merge all uploads — latest upload wins per rep+store combination.
 */
export async function getMergedCallCycle(): Promise<CallCycleEntry[]> {
  const index = await loadCallCycleIndex();
  const map = new Map<string, CallCycleEntry>();

  // Process oldest to newest so latest wins
  const sorted = [...index].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  for (const meta of sorted) {
    const entries = await loadCallCycleData(meta.id);
    for (const entry of entries) {
      const key = `${entry.repEmail.toLowerCase()}|${entry.storeCode.toLowerCase()}`;
      map.set(key, entry);
    }
  }

  return Array.from(map.values());
}

/**
 * Get the 1-based cycle week number for a given date within a repeating cycle.
 * Returns null if the date is before the cycle start or cycleLength is invalid.
 */
export function getCycleWeek(
  cycleStartDate: string,
  cycleLength: number,
  targetDate: Date
): number | null {
  if (!cycleLength || cycleLength <= 0) return null;

  const start = new Date(cycleStartDate + 'T00:00:00');
  if (isNaN(start.getTime())) return null;

  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  const msPerDay = 86400000;
  const daysSinceStart = Math.floor((target.getTime() - startDay.getTime()) / msPerDay);
  if (daysSinceStart < 0) return null;

  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  const currentCycleWeek = (weeksSinceStart % cycleLength) + 1;
  return currentCycleWeek;
}

/**
 * Get stores scheduled for a given rep on a specific date.
 * Uses the cycle-based scheduling: checks if the cycle week for the date
 * has a day assigned, and if that day matches the target date's day of week.
 */
export function getScheduledStores(
  callCycle: CallCycleEntry[],
  repEmail: string,
  date: Date
): CallCycleEntry[] {
  const targetDayAbbr = DAY_ABBRS[date.getDay()];

  return callCycle.filter(entry => {
    if (entry.repEmail.toLowerCase() !== repEmail.toLowerCase()) return false;

    const cycleWeek = getCycleWeek(entry.cycleStartDate, entry.cycleLength, date);
    if (cycleWeek === null) return false;

    const assignedDay = entry.weeks[cycleWeek];
    if (!assignedDay) return false;

    return assignedDay === targetDayAbbr;
  });
}
