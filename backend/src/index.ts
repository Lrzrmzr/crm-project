import 'dotenv/config';
import './config/env';
import app from './app';
import { connectMongoDB } from './config/mongodb';
import logger from './config/logger';

const PORT = process.env.PORT ?? 4000;

async function main() {
  await connectMongoDB();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});