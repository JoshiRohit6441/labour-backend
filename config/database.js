import { PrismaClient } from '@prisma/client';

let prisma;

if (!prisma) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + "&pool_timeout=9",
      },
    },
  });

  // Graceful shutdown
  process.on('beforeExit', async () => {
    console.log('[Prisma] Disconnecting...');
    await prisma.$disconnect();
  });

  // Error handling
  prisma.$on('error', (e) => {
    console.error('[Prisma] Error:', e);
  });

  prisma.$on('warn', (e) => {
    console.warn('[Prisma] Warning:', e);
  });

  prisma.$on('info', (e) => {
    console.info('[Prisma] Info:', e);
  });
}

export default prisma;
