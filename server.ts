import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { initDatabase } from './server/db.ts';
import { requestLogger } from './server/logger.ts';
import apiV1Router from './server/routes/apiV1.ts';
import { setupTerminalWebSocketServer } from './server/terminal.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Initialize SQLite database, tables, and seeding
initDatabase();

// Parsers & Middlewares
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging for API telemetry & audit
app.use(requestLogger);

// Mount versioned REST API
app.use('/api/v1', apiV1Router);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'BusterNodes', panel: 'DVM Panel' });
});

// Setup dev server Vite middleware or production static files
async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Consistent 404 handler for API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested API route does not exist'
      }
    });
  });

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server exception:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred',
        details: isProd ? undefined : err.message
      }
    });
  });

  const server = http.createServer(app);
  setupTerminalWebSocketServer(server);

  server.listen(port, '0.0.0.0', () => {
    console.log(`[BusterNodes DVM Panel] Server listening on http://0.0.0.0:${port}`);
    console.log(`[BusterNodes DVM Panel] REST API available at http://0.0.0.0:${port}/api/v1`);
    console.log(`[BusterNodes DVM Panel] Interactive Web Console attached at ws://0.0.0.0:${port}/ws/console/:vmId`);
    console.log(`[BusterNodes DVM Panel] Process Manager: Non-systemd (PM2 / Docker compatible)`);
  });
}

startServer().catch(err => {
  console.error('Failed to start BusterNodes DVM Panel server:', err);
  process.exit(1);
});
