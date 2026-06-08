import { NextRequest, NextResponse } from 'next/server';
import { requireAnyUser, noCacheHeaders } from '@/lib/auth';
import { loadVisitIndex, loadVisitData } from '@/lib/visitData';
import { getMergedCallCycle } from '@/lib/callCycleData';
import { buildRepDaySummaries, buildMTDSummary } from '@/lib/dashboardCalc';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requireAnyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const from = req.nextUrl.searchParams.get('from') || '';
  const to = req.nextUrl.searchParams.get('to') || '';

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to date params required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Load all visits
  const index = await loadVisitIndex();
  const allVisits = [];
  for (const meta of index) {
    const visits = await loadVisitData(meta.id);
    allVisits.push(...visits);
  }

  // Load merged call cycle
  const callCycle = await getMergedCallCycle();

  // Build summaries
  const daySummaries = buildRepDaySummaries(allVisits, callCycle, from, to);
  const mtdSummary = buildMTDSummary(daySummaries);

  const totalVisits = daySummaries.reduce((sum, d) => sum + d.totalVisits, 0);
  const totalScheduledVisits = daySummaries.reduce((sum, d) => sum + d.scheduledVisits, 0);
  const totalUnscheduledVisits = daySummaries.reduce((sum, d) => sum + d.unscheduledVisits, 0);
  const totalExpectedVisits = daySummaries.reduce((sum, d) => sum + d.expectedVisits, 0);

  return NextResponse.json({
    daySummaries,
    mtdSummary,
    totalVisits,
    totalScheduledVisits,
    totalUnscheduledVisits,
    totalExpectedVisits,
    totalReps: mtdSummary.length,
  }, { headers: noCacheHeaders() });
}
