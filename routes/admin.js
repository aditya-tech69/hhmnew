const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll, saveDb } = require('../database');
const { requireAdmin } = require('../middleware/auth');

// ==================== AUTH ====================

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const admin = dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.adminId = admin.id;
    req.session.adminName = admin.display_name;
    req.session.adminRole = admin.role;

    res.json({ message: 'Login successful', admin: { id: admin.id, name: admin.display_name, role: admin.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { id: req.session.adminId, name: req.session.adminName, role: req.session.adminRole } });
});

// ==================== DASHBOARD ====================

router.get('/dashboard', requireAdmin, (req, res) => {
  try {
    const totalRevenue = dbGet('SELECT COALESCE(SUM(total), 0) as revenue FROM orders')?.revenue || 0;
    const totalOrders = dbGet('SELECT COUNT(*) as count FROM orders')?.count || 0;
    const activeOrders = dbGet("SELECT COUNT(*) as count FROM orders WHERE status IN ('Processing', 'In Transit')")?.count || 0;
    const processingOrders = dbGet("SELECT COUNT(*) as count FROM orders WHERE status = 'Processing'")?.count || 0;
    const totalInventory = dbGet('SELECT COALESCE(SUM(stock), 0) as total FROM products')?.total || 0;
    const totalProducts = dbGet('SELECT COUNT(*) as count FROM products')?.count || 0;
    const totalSubscribers = dbGet('SELECT COUNT(*) as count FROM subscribers')?.count || 0;

    const inventoryByCategory = dbAll('SELECT category, SUM(stock) as stock, COUNT(*) as products FROM products GROUP BY category');

    const lowStockCount = dbGet('SELECT COUNT(*) as count FROM products WHERE stock < 5')?.count || 0;
    const stockIntegrity = totalProducts > 0 ? Math.round(((totalProducts - lowStockCount) / totalProducts) * 100) : 100;

    const recentOrders = dbAll(`
      SELECT o.id, o.customer_name, o.customer_email, o.customer_phone, o.status, o.total, o.created_at,
      GROUP_CONCAT(p.name, ', ') as product_names
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      GROUP BY o.id
      ORDER BY o.created_at DESC LIMIT 10
    `);

    res.json({
      metrics: { totalRevenue, totalOrders, activeOrders, processingOrders, totalInventory, totalProducts, totalSubscribers, stockIntegrity },
      inventoryByCategory,
      recentOrders
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ==================== PRODUCT MANAGEMENT ====================

router.post('/products', requireAdmin, (req, res) => {
  try {
    const { name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity } = req.body;
    if (!name || !collection || !category || !material || !description || !price || !image_url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = dbRun(
      'INSERT INTO products (name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, collection, category, material, description, price, currency || 'USD', image_url, stock || 0, featured ? 1 : 0, badge || null, specs ? JSON.stringify(specs) : null, origin || 'Artisan Workshop', capacity || null]
    );
    saveDb();
    const product = dbGet('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(product);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', requireAdmin, (req, res) => {
  try {
    const { name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity } = req.body;
    const existing = dbGet('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    dbRun(
      'UPDATE products SET name=?, collection=?, category=?, material=?, description=?, price=?, currency=?, image_url=?, stock=?, featured=?, badge=?, specs=?, origin=?, capacity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [
        name || existing.name, collection || existing.collection, category || existing.category,
        material || existing.material, description || existing.description,
        price !== undefined ? price : existing.price, currency || existing.currency,
        image_url || existing.image_url, stock !== undefined ? stock : existing.stock,
        featured !== undefined ? (featured ? 1 : 0) : existing.featured,
        badge !== undefined ? badge : existing.badge,
        specs ? JSON.stringify(specs) : existing.specs,
        origin || existing.origin, capacity !== undefined ? capacity : existing.capacity,
        parseInt(req.params.id)
      ]
    );
    saveDb();
    const product = dbGet('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    res.json(product);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', requireAdmin, (req, res) => {
  try {
    const product = dbGet('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    dbRun('DELETE FROM products WHERE id = ?', [parseInt(req.params.id)]);
    saveDb();
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==================== ORDER MANAGEMENT ====================

router.get('/orders', requireAdmin, (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.id, o.customer_name, o.customer_email, o.customer_phone, o.shipping_address, o.status, o.total, o.created_at,
      GROUP_CONCAT(p.name, ', ') as product_names
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
    `;
    const params = [];
    if (status) { query += ' WHERE o.status = ?'; params.push(status); }
    query += ' GROUP BY o.id ORDER BY o.created_at DESC';
    const orders = dbAll(query, params);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id', requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    if (!['Processing', 'In Transit', 'Fulfilled', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    dbRun('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, parseInt(req.params.id)]);
    saveDb();
    const order = dbGet('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ==================== SUBSCRIBERS ====================

router.get('/subscribers', requireAdmin, (req, res) => {
  try {
    const subscribers = dbAll('SELECT * FROM subscribers ORDER BY created_at DESC');
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

module.exports = router;
