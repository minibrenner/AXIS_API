import { prisma } from './apps/api/src/prisma/client';
import { TenantContext } from './apps/api/src/tenancy/tenant.context';

const tenantId = 'cmi65819m00006m00nyehzavh';
const openingUsers = [
  { id: 'cmi658r9200016m0gqs7eil7j', register: 'Caixa 1' },
  { id: 'cmi658rbq00036m0gk366wjxg', register: 'Caixa 2' },
  { id: 'cmi658rec00056m0gl2g8roec', register: 'Caixa 3' },
];

async function openSession(userId: string, registerNumber: string) {
  return TenantContext.run(tenantId, async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('tenant not found');
    const openCount = await prisma.cashSession.count({ where: { tenantId, closedAt: null } });
    console.log('current open count', openCount);
    if (openCount >= (tenant.maxOpenCashSessions ?? 1)) {
      throw new Error('limit');
    }
    const session = await prisma.cashSession.create({
      data: {
        tenantId,
        userId,
        openingCents: 1000,
        registerNumber,
      },
    });
    return session;
  });
}

async function closeSession(sessionId: string) {
  return TenantContext.run(tenantId, async () =>
    prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        closingCents: 0,
        closedAt: new Date(),
        closingSupervisorId: openingUsers[0].id,
        closingSupervisorRole: 'ADMIN',
        closingApprovalVia: 'PASSWORD',
      },
    })
  );
}

(async () => {
  const opened: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const session = await openSession(openingUsers[i].id, openingUsers[i].register);
    console.log('opened', session.id);
    opened.push(session.id);
  }
  try {
    await openSession(openingUsers[2].id, openingUsers[2].register);
    console.log('third session opened unexpectedly');
  } catch (err) {
    console.log('expected error when opening third box:', err.message);
  }
  await closeSession(opened[0]);
  console.log('closed first session');
  const session = await openSession(openingUsers[2].id, openingUsers[2].register);
  console.log('opened third session after closing one', session.id);
  await prisma.$disconnect();
})();
