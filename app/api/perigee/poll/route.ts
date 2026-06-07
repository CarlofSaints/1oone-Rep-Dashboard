import { NextRequest, NextResponse } from 'next/server';
import { requireRole, noCacheHeaders } from '@/lib/auth';
import { readJson, writeJson } from '@/lib/blob';
import { Visit, loadVisitIndex, saveVisitIndex, saveVisitData, loadVisitData, visitDedupeKey } from '@/lib/visitData';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PerigeeConfig {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  lastPolledAt: string | null;
  requestBody: string;
}

const CONFIG_KEY = 'config/perigee-api.json';

function calcDuration(checkInTime: string, checkOutTime: string, startDateFull: string, endDateFull: string): string {
  if (!checkInTime || !checkOutTime) return '';
  const inParts = checkInTime.split(':').map(Number);
  const outParts = checkOutTime.split(':').map(Number);
  if (inParts.length >= 2 && outParts.length >= 2) {
    let diffMin: number;
    if (startDateFull && endDateFull && startDateFull.includes(' ') && endDateFull.includes(' ')) {
      const startMs = new Date(startDateFull.replace(' ', 'T')).getTime();
      const endMs = new Date(endDateFull.replace(' ', 'T')).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
        diffMin = Math.round((endMs - startMs) / 60000);
      } else {
        return '';
      }
    } else {
      diffMin = (outParts[0] * 60 + outParts[1]) - (inParts[0] * 60 + inParts[1]);
    }
    if (diffMin > 0) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }
  return '';
}

function mapPerigeeVisit(row: Record<string, unknown>): Visit {
  const str = (key: string) => String(row[key] ?? '').trim();
  const num = (key: string) => parseInt(String(row[key] ?? '0')) || 0;

  const rawStore = str('store') || str('Store Full Name') || str('storeName') || str('place') || '';
  let storeName = rawStore;
  let storeCode = str('storeCode') || str('placeId') || '';
  if (!storeCode && rawStore.includes(' - ')) {
    const lastDash = rawStore.lastIndexOf(' - ');
    storeName = rawStore.substring(0, lastDash).trim();
    storeCode = rawStore.substring(lastDash + 3).trim();
  }

  let checkInDate = str('checkInDate') || '';
  const startDateFull = str('startDateFull');
  if (!checkInDate) {
    if (startDateFull && startDateFull.includes(' ')) {
      checkInDate = startDateFull.split(' ')[0];
    } else {
      checkInDate = str('date') || '';
    }
  }

  let checkOutDate = str('checkOutDate') || '';
  const endDateFull = str('endDateFull');
  if (!checkOutDate) {
    if (endDateFull && endDateFull.includes(' ')) {
      checkOutDate = endDateFull.split(' ')[0];
    }
  }

  const checkInTime = str('checkInTime') || str('startTime') || '';
  const checkOutTime = str('checkOutTime') || str('endTime') || '';
  const email = str('email') || str('username') || str('Username') || str('representativeId') || '';
  const repName = str('repName') || str('displayName') || str('representativeName') || '';
  const channel = str('channel') || str('Channel') || '';
  const status = str('status') || str('callStatus') || '';
  const visitId = str('visitGuid') || str('guid') || str('visitId') || '';
  const rawDuration = str('visitDuration') || str('timeAtPlace') || '';
  const visitDuration = rawDuration || calcDuration(checkInTime, checkOutTime, startDateFull, endDateFull);

  return {
    email, repName, channel, storeName, storeCode,
    checkInDate, checkInTime, checkOutDate, checkOutTime,
    checkInDistance: str('checkInDistance') || '',
    checkOutDistance: str('checkOutDistance') || '',
    visitDuration,
    formsCompleted: num('formsCompleted'),
    picsUploaded: num('picsUploaded'),
    status,
    networkOnCheckIn: str('networkOnCheckIn') || '',
    visitId: visitId || undefined,
  };
}

export async function POST(req: NextRequest) {
  const user = await requireRole(req, ['super_admin']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await readJson<PerigeeConfig>(CONFIG_KEY, { apiKey: '', endpoint: '', enabled: false, lastPolledAt: null, requestBody: '' });

  if (!config.endpoint || !config.apiKey) {
    return NextResponse.json(
      { error: 'Perigee API not configured. Set endpoint and token in Settings.' },
      { status: 400, headers: noCacheHeaders() }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = (body as Record<string, string>).mode || 'test';
    const perigeeBody = { ...(body as Record<string, unknown>) };
    delete perigeeBody.mode;

    if (!perigeeBody.startDate) {
      return NextResponse.json(
        { error: 'startDate is required in the request body' },
        { status: 400, headers: noCacheHeaders() }
      );
    }

    const perigeeRes = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(perigeeBody),
    });

    if (!perigeeRes.ok) {
      const errText = await perigeeRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Perigee API returned ${perigeeRes.status}`, detail: errText.slice(0, 500) },
        { status: 502, headers: noCacheHeaders() }
      );
    }

    const perigeeData = await perigeeRes.json();
    await writeJson(CONFIG_KEY, { ...config, lastPolledAt: new Date().toISOString() });

    let rawVisits: Record<string, unknown>[] = [];
    if (Array.isArray(perigeeData)) {
      rawVisits = perigeeData;
    } else if (perigeeData.visits && Array.isArray(perigeeData.visits.data)) {
      rawVisits = perigeeData.visits.data;
    } else if (Array.isArray(perigeeData.visits)) {
      rawVisits = perigeeData.visits;
    } else if (Array.isArray(perigeeData.data)) {
      rawVisits = perigeeData.data;
    }

    if (mode === 'test') {
      const sample = rawVisits.slice(0, 3);
      const responseKeys = rawVisits.length > 0 ? Object.keys(rawVisits[0]) : [];
      const meta: Record<string, unknown> = {};
      for (const k of Object.keys(perigeeData)) {
        if (k === 'visits' && typeof perigeeData[k] === 'object' && !Array.isArray(perigeeData[k])) {
          const { data, ...visitsMeta } = perigeeData[k] as Record<string, unknown>;
          meta['visits'] = visitsMeta;
        } else if (k !== 'visits') {
          meta[k] = perigeeData[k];
        }
      }
      return NextResponse.json({
        ok: true, mode: 'test', totalRows: rawVisits.length, responseKeys, sample,
        rawTopLevelKeys: Object.keys(perigeeData), meta, sentBody: perigeeBody,
      }, { headers: noCacheHeaders() });
    }

    // Import mode
    if (rawVisits.length === 0) {
      return NextResponse.json(
        { ok: true, mode: 'import', message: 'No visits returned for this date range', totalRows: 0 },
        { headers: noCacheHeaders() }
      );
    }

    const mappedVisits: Visit[] = rawVisits.map(mapPerigeeVisit).filter(v => v.storeName || v.repName);

    const batchSeen = new Set<string>();
    const visits: Visit[] = [];
    for (const v of mappedVisits) {
      const key = visitDedupeKey(v);
      if (batchSeen.has(key)) continue;
      batchSeen.add(key);
      visits.push(v);
    }

    const index = await loadVisitIndex();
    const existingKeys = new Set<string>();
    for (const meta of index) {
      const existingVisits = await loadVisitData(meta.id);
      for (const ev of existingVisits) {
        existingKeys.add(visitDedupeKey(ev));
      }
    }

    const newVisits = visits.filter(v => !existingKeys.has(visitDedupeKey(v)));
    const skippedDuplicates = mappedVisits.length - newVisits.length;

    if (newVisits.length === 0) {
      return NextResponse.json({
        ok: true, mode: 'import', message: 'All visits already imported (duplicates skipped)',
        totalRows: rawVisits.length, importedRows: 0, skippedDuplicates,
      }, { headers: noCacheHeaders() });
    }

    const uploadId = crypto.randomUUID();
    await saveVisitData(uploadId, newVisits);
    index.unshift({
      id: uploadId,
      fileName: `perigee-api-${perigeeBody.startDate}.json`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: `${user.name} ${user.surname} (API)`,
      rowCount: newVisits.length,
    });
    await saveVisitIndex(index);

    return NextResponse.json({
      ok: true, mode: 'import', uploadId, totalRows: rawVisits.length,
      importedRows: newVisits.length, skippedDuplicates,
    }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Perigee poll error:', err);
    return NextResponse.json(
      { error: 'Failed to call Perigee API: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}
