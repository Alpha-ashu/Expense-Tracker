import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import { apiRoutes } from './routes/index';

const app = express();

app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1
app.use('/api/v1', apiRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use(errorHandler);

export { app };
export default app;