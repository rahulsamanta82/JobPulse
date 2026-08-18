import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db/db';
import { ingestionEngine } from './server/services/ingestion/ingestionEngine';
import apiRouter from './server/routes/api';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // Basic security and parsing middleware
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS middleware (Supports same-origin production and optional FRONTEND_URL for dev)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowedOrigin = process.env.FRONTEND_URL || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Request logger for API calls
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      });
    }
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Fallback 404 for unhandled API routes (ensures API callers never get index.html)
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API route ${req.method} ${req.path} not found.`,
      },
    });
  });

  // Initialize Database and Ingestion Engine
  try {
    await db.initialize();
    await ingestionEngine.initialize();
  } catch (err: any) {
    console.error('[Startup] Initialization warning:', err.message);
  }

  // Centralized Error Handling Middleware for API
  app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected server error occurred.',
      },
    });
  });

  // Vite middleware for development vs static production serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`  JobPulse Server Running on http://0.0.0.0:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Database: ${db.getState().type}`);
    console.log(`=================================================`);
  });

  // Graceful Shutdown Handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Closing gracefully...`);
    ingestionEngine.stopScheduler();
    server.close(() => {
      console.log('[Shutdown] HTTP server closed.');
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      console.error('[Shutdown] Forced exit after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start JobPulse server:', err);
  process.exit(1);
});
