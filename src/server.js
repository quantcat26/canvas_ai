import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import aiRoutes from './routes/aiRoutes.js';
import canvasRoutes from './routes/canvasRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5176;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientRoot = path.join(rootDir, 'client');

const isDev = process.env.NODE_ENV !== 'production';

app.use(cors());
app.use(bodyParser.json());

app.get('/api', (req, res) => {
  res.send('CanvasAI API Server is running.');
});

app.use('/api/ai', aiRoutes);
app.use('/api/canvas', canvasRoutes);

const startServer = async () => {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: clientRoot,
      configFile: path.join(rootDir, 'vite.config.js'),
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        next();
        return;
      }

      try {
        const template = await fs.readFile(path.join(clientRoot, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  } else {
    const distPath = path.join(clientRoot, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        next();
        return;
      }

      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server runs on http://localhost:${PORT}`);
  });
};

startServer();
