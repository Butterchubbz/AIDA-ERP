import express from 'express';
import path from 'path';

const app = express();
const port = process.env.PORT || 5174;
const dist = path.join(process.cwd(), 'dist');

// Serve static assets with a short cache TTL for dev/test use
app.use(express.static(dist, { maxAge: '1m' }));

// Health/readiness endpoint for Playwright (and CI) to probe
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok' });
});

// SPA fallback — serve index.html for any other route
app.use((req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

// Start server
const server = app.listen(port, () => console.log(`Serving dist at http://127.0.0.1:${port}`));

// Export for programmatic control if someone requires this file
export default server;
