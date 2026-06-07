import type { Visit } from './visitData';
import type { CallCycleEntry } from './types';
import { getScheduledStores } from './callCycleData';

export interface RepDaySummary {
  repEmail: string;
  repName: string;
  date: string; // YYYY-MM-DD
  firstCheckIn: string;
  lastCheckOut: string;
  hoursWorked: number;
  storesVisited: number;
  storesScheduled: number;
  stores: StoreVisitDetail[];
}

export interface StoreVisitDetail {
  date: string;
  storeName: string;
  storeCode: string;
  checkIn: string;
  checkOut: string;
  durationMinutes: number;
  scheduled: boolean;
}

export interface RepMTDSummary {
  repEmail: string;
  repName: string;
  daysWorked: number;
  avgHoursPerDay: number;
  totalStoresVisited: number;
  totalStoresScheduled: number;
  adherencePercent: number;
}

function parseTimeToMinutes(time: string): number {
  if (!time) return -1;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

function parseDuration(duration: string): number {
  if (!duration) return 0;
  let mins = 0;
  const hMatch = duration.match(/(\d+)\s*h/i);
  const mMatch = duration.match(/(\d+)\s*m/i);
  if (hMatch) mins += parseInt(hMatch[1]) * 60;
  if (mMatch) mins += parseInt(mMatch[1]);
  if (mins === 0) {
    const num = parseFloat(duration);
    if (!isNaN(num)) mins = Math.round(num);
  }
  return mins;
}

/**
 * Build per-rep-per-day summaries from visit data + call cycle.
 */
export function buildRepDaySummaries(
  visits: Visit[],
  callCycle: CallCycleEntry[],
  from: string,
  to: string
): RepDaySummary[] {
  // Group visits by repEmail + date
  const grouped = new Map<string, Visit[]>();
  for (const v of visits) {
    if (!v.checkInDate) continue;
    if (v.checkInDate < from || v.checkInDate > to) continue;
    const key = `${(v.email || '').toLowerCase()}|${v.checkInDate}`;
    const arr = grouped.get(key) || [];
    arr.push(v);
    grouped.set(key, arr);
  }

  const summaries: RepDaySummary[] = [];

  for (const [, dayVisits] of grouped) {
    if (dayVisits.length === 0) continue;

    const repEmail = dayVisits[0].email;
    const repName = dayVisits[0].repName;
    const date = dayVisits[0].checkInDate;

    // Get scheduled stores for this rep on this date
    const dateObj = new Date(date + 'T00:00:00');
    const scheduled = getScheduledStores(callCycle, repEmail, dateObj);
    const scheduledCodes = new Set(scheduled.map(s => (s.storeCode || s.storeName).toLowerCase()));

    let firstCheckIn = '99:99';
    let lastCheckOut = '00:00';
    const storeDetails: StoreVisitDetail[] = [];
    const visitedStores = new Set<string>();

    for (const v of dayVisits) {
      if (v.checkInTime && v.checkInTime < firstCheckIn) firstCheckIn = v.checkInTime;
      if (v.checkOutTime && v.checkOutTime > lastCheckOut) lastCheckOut = v.checkOutTime;

      const storeKey = (v.storeCode || v.storeName).toLowerCase();
      visitedStores.add(storeKey);

      let durationMinutes = parseDuration(v.visitDuration);
      if (durationMinutes === 0) {
        const inMins = parseTimeToMinutes(v.checkInTime);
        const outMins = parseTimeToMinutes(v.checkOutTime);
        if (inMins >= 0 && outMins >= 0 && outMins > inMins) {
          durationMinutes = outMins - inMins;
        }
      }

      storeDetails.push({
        date,
        storeName: v.storeName,
        storeCode: v.storeCode,
        checkIn: v.checkInTime,
        checkOut: v.checkOutTime,
        durationMinutes,
        scheduled: scheduledCodes.has(storeKey),
      });
    }

    if (firstCheckIn === '99:99') firstCheckIn = '';
    if (lastCheckOut === '00:00') lastCheckOut = '';

    let hoursWorked = 0;
    const inMins = parseTimeToMinutes(firstCheckIn);
    const outMins = parseTimeToMinutes(lastCheckOut);
    if (inMins >= 0 && outMins >= 0 && outMins > inMins) {
      hoursWorked = (outMins - inMins) / 60;
    }

    summaries.push({
      repEmail,
      repName,
      date,
      firstCheckIn,
      lastCheckOut,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      storesVisited: visitedStores.size,
      storesScheduled: scheduled.length,
      stores: storeDetails,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date) || a.repName.localeCompare(b.repName));
}

/**
 * Aggregate day summaries into MTD per-rep summary.
 */
export function buildMTDSummary(daySummaries: RepDaySummary[]): RepMTDSummary[] {
  const byRep = new Map<string, RepDaySummary[]>();
  for (const ds of daySummaries) {
    const arr = byRep.get(ds.repEmail) || [];
    arr.push(ds);
    byRep.set(ds.repEmail, arr);
  }

  const results: RepMTDSummary[] = [];
  for (const [repEmail, days] of byRep) {
    const totalHours = days.reduce((sum, d) => sum + d.hoursWorked, 0);
    const totalVisited = days.reduce((sum, d) => sum + d.storesVisited, 0);
    const totalScheduled = days.reduce((sum, d) => sum + d.storesScheduled, 0);

    results.push({
      repEmail,
      repName: days[0].repName,
      daysWorked: days.length,
      avgHoursPerDay: days.length > 0 ? Math.round((totalHours / days.length) * 100) / 100 : 0,
      totalStoresVisited: totalVisited,
      totalStoresScheduled: totalScheduled,
      adherencePercent: totalScheduled > 0
        ? Math.round((totalVisited / totalScheduled) * 100)
        : 0,
    });
  }

  return results.sort((a, b) => a.repName.localeCompare(b.repName));
}
