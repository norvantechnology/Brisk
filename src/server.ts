import app from './app';
import { env } from './config/env';
import { connectDatabase, prisma } from './config/database';
import { logger } from './utils/logger';

const startServer = async () => {
  // 1. Establish database connection
  await connectDatabase();

  // 2. Start HTTP Server
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 BRISK backend monolith running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`);
  });

  // Graceful shutdown handling
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

    // Force close server after 10s if graceful shutdown fails
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
