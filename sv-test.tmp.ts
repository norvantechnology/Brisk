import { prisma } from './src/config/database';
import { listJobSiteVisits, listTraderSiteVisits } from './src/modules/site-visits/site-visits.service';
(async () => {
  const raw = await prisma.traderSiteVisitRequest.findMany({ select: { id: true, status: true, traderId: true, jobId: true, job: { select: { status: true, traderId: true } } } });
  console.log('RAW rows', raw.length, JSON.stringify(raw.map(r => [r.status, r.job.status, r.job.traderId === null ? 'unassigned' : r.job.traderId === r.traderId ? 'mine' : 'other'])));
  const traderIds = [...new Set(raw.map(r => r.traderId))];
  for (const t of traderIds) {
    const all = await listTraderSiteVisits(t, {}, 'ADMIN');
    const req = await listTraderSiteVisits(t, { group: 'REQUESTED' }, 'TRADER');
    const vis = await listTraderSiteVisits(t, { group: 'VISITED' }, 'TRADER');
    const clo = await listTraderSiteVisits(t, { group: 'CLOSED' }, 'ADMIN');
    const okGroups = req.items.every(i => i.group === 'REQUESTED') && vis.items.every(i => i.group === 'VISITED') && clo.items.every(i => i.group === 'CLOSED');
    const okCounts = req.meta.total === all.summary.requestedCount && vis.meta.total === all.summary.visitedCount && clo.meta.total === all.summary.closedCount && all.meta.total === all.summary.total;
    console.log('TRADER', t.slice(0,8), JSON.stringify(all.summary), 'groupsMatchDbFilter', okGroups, 'countsMatch', okCounts, 'traderHidesAdminFields', !('trader' in (req.items[0] ?? {})) && !('email' in (req.items[0]?.customer ?? {})));
  }
  const jobId = raw[0]?.jobId;
  if (jobId) {
    const j = await listJobSiteVisits(jobId);
    console.log('JOB', JSON.stringify(j.summary));
    console.log('SAMPLE', JSON.stringify(j.items[0], null, 1));
  }
  const s = await listTraderSiteVisits(traderIds[0], { search: 'zzzz-none', sortBy: 'visitDate', sortOrder: 'asc', page: 2, limit: 1 }, 'ADMIN');
  console.log('EMPTY SEARCH', JSON.stringify(s.summary), JSON.stringify(s.meta));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
