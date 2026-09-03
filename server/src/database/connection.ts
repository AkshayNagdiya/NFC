import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let memoryServerInstance: { stop: () => Promise<boolean> } | null = null;

export async function connectDb(uri?: string): Promise<void> {
  mongoose.set('strictQuery', true);

  // If a specific URI is provided (e.g. in test suites), connect directly to it
  if (uri) {
    await mongoose.connect(uri);
    logger.info({ uri: uri.replace(/\/\/.*@/, '//***@') }, 'MongoDB connected');
    return;
  }

  // If USE_MEMORY_DB is explicitly set in development
  if (env.USE_MEMORY_DB && env.NODE_ENV !== 'production') {
    logger.info('USE_MEMORY_DB enabled: Starting in-memory MongoDB...');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    memoryServerInstance = mem;
    const memUri = mem.getUri('nfc_band_management');
    await mongoose.connect(memUri);
    logger.info({ uri: memUri }, 'Connected to In-Memory MongoDB');
    return;
  }

  const targetUri = env.MONGODB_URI;
  try {
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: env.NODE_ENV === 'development' ? 4000 : 30000,
    });
    logger.info({ uri: targetUri.replace(/\/\/.*@/, '//***@') }, 'MongoDB connected');
  } catch (err: unknown) {
    if (env.NODE_ENV === 'development') {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { originalError: errMsg },
        'Could not connect to configured MONGODB_URI. Falling back to local in-memory MongoDB for seamless development...',
      );
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mem = await MongoMemoryServer.create();
        memoryServerInstance = mem;
        const memUri = mem.getUri('nfc_band_management');
        await mongoose.connect(memUri);
        logger.info({ uri: memUri }, 'Connected to In-Memory MongoDB (dev fallback)');
        return;
      } catch (memErr) {
        logger.error({ memErr }, 'Failed to start in-memory MongoDB fallback');
      }
    }
    throw err;
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
}

