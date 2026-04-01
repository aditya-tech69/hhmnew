const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and start server
(async () => {
  try {
    await initializeDatabase();
    
    // Middleware
    app.use(compression());
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }));
    app.use(cors({
      origin: true,
      credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Session
    app.use(session({
      secret: process.env.SESSION_SECRET || 'hhm-innovation-luxury-secret-2024',
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: false, // Set to true if using HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Static files
    app.use(express.static(path.join(__dirname, 'public')));

    // API Routes
    app.use('/api', require('./routes/api'));
    app.use('/api/admin', require('./routes/admin'));

    // Page routes
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.get('/catalog', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'catalog.html'));
    });

    app.get('/product/:id', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'product.html'));
    });

    app.get('/admin', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    });

    app.get('/contact', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'contact.html'));
    });

    app.get('/login', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error('Server Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
      console.log(`
      ╔══════════════════════════════════════════╗
      ║     HHM Innovation - Refracted Luxury    ║
      ║──────────────────────────────────────────║
      ║  Server running on http://localhost:${PORT}  ║
      ║                                          ║
      ║  Pages:                                  ║
      ║  • Landing:  http://localhost:${PORT}/       ║
      ║  • Catalog:  http://localhost:${PORT}/catalog ║
      ║  • Admin:    http://localhost:${PORT}/admin   ║
      ║  • Login:    http://localhost:${PORT}/login   ║
      ║                                          ║
      ║  Admin Login: adityasir / samsung1       ║
      ╚══════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('Failed to initialize database or start server:', err);
    process.exit(1);
  }
})();
