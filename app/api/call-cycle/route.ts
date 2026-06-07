import { NextRequest, NextResponse } from 'next/server';
import { requireRole, noCacheHeaders } from '@/lib/auth';
import { loadCallCycleIndex, saveCallCycleIndex, saveCallCycleData, deleteCallCycleUpload, getMergedCallCycle } from '@/lib/callCycleData';
import type { CallCycleEntry, CallCycleUploadMeta, FrequencyType } from '@/lib/types';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

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
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
    }

    // Find headers case-insensitively
    const headers = Object.keys(rows[0]);
    const find = (patterns: string[]): string | null => {
      for (const h of headers) {
        const lower = h.toLowerCase().trim();
        if (patterns.some(p => lower.includes(p))) return h;
      }
      return null;
    };

    const emailCol = find(['rep email', 'email', 'rep_email', 'user email', 'username']);
    const nameCol = find(['rep name', 'rep_name', 'representative', 'name']);
    const storeCol = find(['store name', 'store_name', 'storename', 'store']);
    const codeCol = find(['store code', 'store_code', 'storecode', 'code', 'site code']);
    const dayCol = find(['day', 'day of week', 'dayofweek', 'weekday']);
    const freqCol = find(['frequency', 'freq', 'call frequency']);
    const weekCol = find(['week', 'week number', 'weeknumber', 'wk']);

    if (!storeCol || !dayCol) {
      return NextResponse.json(
        { error: `Required columns not found. Need at least: Store Name, Day. Found: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    if (!emailCol && !nameCol) {
      return NextResponse.json(
        { error: `Need either Rep Email or Rep Name column. Found: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    const entries: CallCycleEntry[] = [];
    for (const row of rows) {
      const repEmail = emailCol ? String(row[emailCol] || '').trim() : '';
      const repName = nameCol ? String(row[nameCol] || '').trim() : repEmail;
      const storeName = storeCol ? String(row[storeCol] || '').trim() : '';
      const storeCode = codeCol ? String(row[codeCol] || '').trim() : '';
      const day = dayCol ? String(row[dayCol] || '').trim() : '';
      const rawFreq = freqCol ? String(row[freqCol] || '').toLowerCase().trim() : 'weekly';
      const rawWeek = weekCol ? String(row[weekCol] || '').trim() : '';

      if (!storeName && !storeCode) continue;
      if (!day) continue;
      if (!repEmail && !repName) continue;

      let frequency: FrequencyType = 'weekly';
      if (rawFreq.includes('fortnight') || rawFreq.includes('bi-week') || rawFreq.includes('biweek') || rawFreq === '2x monthly' || rawFreq === '2x_monthly') {
        frequency = 'fortnightly';
      } else if (rawFreq.includes('month') && !rawFreq.includes('fortnight')) {
        frequency = 'monthly';
      }

      const week = rawWeek ? parseInt(rawWeek) || undefined : undefined;

      entries.push({ repEmail: repEmail || repName, repName: repName || repEmail, storeName, storeCode, day, frequency, week });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No valid entries found in file' }, { status: 400 });
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
