import { NextRequest, NextResponse } from 'next/server';
import { requireRole, noCacheHeaders } from '@/lib/auth';
import { loadCallCycleIndex, saveCallCycleIndex, saveCallCycleData, deleteCallCycleUpload, getMergedCallCycle } from '@/lib/callCycleData';
import type { CallCycleEntry, CallCycleUploadMeta } from '@/lib/types';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/** Normalize day strings to 3-letter abbreviations */
function normalizeDayAbbr(raw: string): string | null {
  const d = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    mon: 'Mon', monday: 'Mon',
    tue: 'Tue', tuesday: 'Tue', tues: 'Tue',
    wed: 'Wed', wednesday: 'Wed',
    thu: 'Thu', thursday: 'Thu', thur: 'Thu', thurs: 'Thu',
    fri: 'Fri', friday: 'Fri',
    sat: 'Sat', saturday: 'Sat',
    sun: 'Sun', sunday: 'Sun',
  };
  return map[d] ?? null;
}

/**
 * Parse a date value that could be:
 * - DD/MM/YYYY string
 * - MM/DD/YYYY string (unlikely but handle)
 * - Excel serial number
 * - ISO string
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
function parseDateToISO(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;

  // Excel serial number
  if (typeof val === 'number') {
    // Excel epoch: 1900-01-01 is serial 1 (with the 1900 leap year bug)
    const epoch = new Date(1899, 11, 30); // Dec 30, 1899
    const d = new Date(epoch.getTime() + val * 86400000);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const s = String(val).trim();

  // DD/MM/YYYY or D/M/YYYY
  const slashMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const year = parseInt(slashMatch[3]);
    // Assume DD/MM/YYYY (South African format)
    let day = a, month = b;
    // If day > 12, it must be DD/MM/YYYY. If month > 12, swap.
    if (month > 12 && day <= 12) { day = b; month = a; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const user = await requireRole(req, ['super_admin', 'admin', 'viewer']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const index = await loadCallCycleIndex();
  const merged = await getMergedCallCycle();
  return NextResponse.json({ index, merged }, { headers: noCacheHeaders() });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(req, ['super_admin', 'admin']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Find "Schedule" sheet (case-insensitive), fallback to first sheet
    let sheetName = wb.SheetNames[0];
    for (const name of wb.SheetNames) {
      if (name.toLowerCase().includes('schedule')) {
        sheetName = name;
        break;
      }
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
    }

    // Map columns case-insensitively
    const headers = Object.keys(rows[0]);
    const find = (patterns: string[]): string | null => {
      for (const h of headers) {
        const lower = h.toLowerCase().trim();
        if (patterns.some(p => lower === p || lower.includes(p))) return h;
      }
      return null;
    };

    const emailCol = find(['user email', 'rep email', 'email', 'username']);
    const firstNameCol = find(['first name', 'firstname']);
    const surnameCol = find(['surname', 'last name', 'lastname']);
    const nameCol = find(['rep name', 'rep_name', 'representative', 'name']);
    const storeIdCol = find(['store id', 'store_id', 'storeid', 'store code', 'store_code', 'site code']);
    const storeNameCol = find(['store name', 'store_name', 'storename']);
    const channelCol = find(['channel']);
    const cycleCol = find(['cycle']);
    const cycleStartCol = find(['cycle start date', 'cycle_start_date', 'start date']);

    // Find WEEK columns (WEEK1, WEEK2, WEEK3, WEEK4, etc.)
    const weekCols: { weekNum: number; col: string }[] = [];
    for (const h of headers) {
      const m = h.match(/^week\s*(\d+)$/i);
      if (m) weekCols.push({ weekNum: parseInt(m[1]), col: h });
    }
    weekCols.sort((a, b) => a.weekNum - b.weekNum);

    if (!storeIdCol && !storeNameCol) {
      return NextResponse.json(
        { error: `Required columns not found. Need Store ID or Store Name. Found: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    if (!emailCol && !nameCol && !firstNameCol) {
      return NextResponse.json(
        { error: `Need User Email or Name column. Found: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    if (weekCols.length === 0) {
      return NextResponse.json(
        { error: `No WEEK columns found (e.g. WEEK1, WEEK2). Found: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    const entries: CallCycleEntry[] = [];
    for (const row of rows) {
      const repEmail = emailCol ? String(row[emailCol] || '').trim() : '';
      let repName = '';
      if (firstNameCol && surnameCol) {
        repName = `${String(row[firstNameCol] || '').trim()} ${String(row[surnameCol] || '').trim()}`.trim();
      } else if (nameCol) {
        repName = String(row[nameCol] || '').trim();
      }
      if (!repName) repName = repEmail;

      const storeCode = storeIdCol ? String(row[storeIdCol] || '').trim() : '';
      const storeName = storeNameCol ? String(row[storeNameCol] || '').trim() : '';
      const channel = channelCol ? String(row[channelCol] || '').trim() : '';

      const rawCycle = cycleCol ? Number(row[cycleCol]) : weekCols.length;
      const cycleLength = (!rawCycle || isNaN(rawCycle) || rawCycle <= 0) ? weekCols.length : rawCycle;

      const cycleStartDate = cycleStartCol ? parseDateToISO(row[cycleStartCol]) : null;

      if (!storeCode && !storeName) continue;
      if (!repEmail && !repName) continue;
      if (!cycleStartDate) continue; // Skip rows without a valid start date

      // Build weeks record from WEEK columns
      const weeks: Record<number, string> = {};
      for (const wc of weekCols) {
        const raw = String(row[wc.col] || '').trim();
        if (!raw) continue;
        const dayAbbr = normalizeDayAbbr(raw);
        if (dayAbbr) weeks[wc.weekNum] = dayAbbr;
      }

      // Skip if no weeks have any assigned day
      if (Object.keys(weeks).length === 0) continue;

      entries.push({
        repEmail: repEmail || repName,
        repName,
        storeCode,
        storeName,
        channel,
        cycleLength,
        cycleStartDate,
        weeks,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No valid entries found. Check that WEEK columns contain day names and CYCLE START DATE is populated.' }, { status: 400 });
    }

    const uploadId = crypto.randomUUID();
    await saveCallCycleData(uploadId, entries);

    const meta: CallCycleUploadMeta = {
      id: uploadId,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: `${user.name} ${user.surname}`,
      rowCount: entries.length,
    };

    const index = await loadCallCycleIndex();
    index.unshift(meta);
    await saveCallCycleIndex(index);

    return NextResponse.json({ ok: true, uploadId, rowCount: entries.length }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Call cycle upload error:', err);
    return NextResponse.json({ error: 'Upload failed: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireRole(req, ['super_admin', 'admin']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });

    await deleteCallCycleUpload(id);
    return NextResponse.json({ ok: true }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Call cycle delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
