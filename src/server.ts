import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, prisma } from './config/database';
import { logger } from './utils/logger';
import { ensureUploadRoot } from './modules/uploads/storage/local.storage';
import { initSocketServer } from './sockets/socket-server';

const startServer = async () => {
  await connectDatabase();

  await ensureUploadRoot();
  logger.info(`Upload storage: ${env.UPLOAD_STORAGE} at ${env.UPLOAD_DIR}`);

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  const server = httpServer.listen(env.PORT, () => {
    logger.info(
      `🚀 BRISK backend monolith running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`
    );
    logger.info('Realtime: Socket.IO available at /socket.io');
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await prisma.$disconnect();
        logger.info('Database connection closed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during database disconnection:', err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error('Critical failure starting server:', error);
  process.exit(1);
});
