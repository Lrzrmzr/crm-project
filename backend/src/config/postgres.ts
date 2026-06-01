import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import logger from './logger';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

prisma.$connect()
  .then(() => logger.info('PostgreSQL connected'))
  .catch((err: unknown) => {
    logger.error({ err }, 'PostgreSQL connection failed');
    process.exit(1);
  });

export default prisma;