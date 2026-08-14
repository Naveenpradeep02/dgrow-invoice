require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/config/database');

const authController = require('./src/controllers/authController');
const serviceController = require('./src/controllers/serviceController');
const invoiceController = require('./src/controllers/invoiceController');

const authRoutes = require('./src/routes/authRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for frontend & relative paths
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.use('/frontend', express.static(frontendPath));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/js', express.static(path.join(frontendPath, 'js')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    agency: 'D-GROW Marketing Agency',
    db_driver: db.getDriver(),
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA routing if needed
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errorCode: 'SERVER_ERROR'
  });
});

// Initialize DB and launch server
async function startServer() {
  await db.initDatabase();

  // Seed default data if empty
  await authController.seedDefaultUsersIfEmpty();
  await serviceController.seedDefaultServicesIfEmpty();
  await invoiceController.seedSampleInvoiceIfEmpty();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` D-GROW INVOICE SYSTEM SERVER IS RUNNING ON PORT ${PORT}`);
    console.log(` Dashboard URL: http://localhost:${PORT}`);
    console.log(` Active DB Driver: ${db.getDriver().toUpperCase()}`);
    console.log(`=======================================================`);
  });
}

startServer();
