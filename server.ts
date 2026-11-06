import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createMysoftRouter } from './src/server/mysoftRoutes.ts';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/mysoft', createMysoftRouter());

if (isProduction) {
  const dist = path.resolve(process.cwd(), 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
  app.listen(port, '0.0.0.0', () => {
    console.log(`faturansit http://localhost:${port}`);
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  app.listen(port, '0.0.0.0', () => {
    console.log(`faturansit http://localhost:${port}`);
  });
}
