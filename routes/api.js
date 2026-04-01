const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll, saveDb } = require('../database');

// ==================== PRODUCTS ====================

router.get('/products', (req, res) => {
  try {
    const { category, material, search, minPrice, maxPrice, featured, sort, limit, offset } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (material) { query += ' AND material LIKE ?'; params.push(`%${material}%`); }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR collection LIKE ? OR material LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (minPrice) { query += ' AND price >= ?'; params.push(parseFloat(minPrice)); }
    if (maxPrice) { query += ' AND price <= ?'; params.push(parseFloat(maxPrice)); }
    if (featured === 'true') { query += ' AND featured = 1'; }

    if (sort === 'price_asc') query += ' ORDER BY price ASC';
    else if (sort === 'price_desc') query += ' ORDER BY price DESC';
    else if (sort === 'name') query += ' ORDER BY name ASC';
    else if (sort === 'newest') query += ' ORDER BY created_at DESC';
    else query += ' ORDER BY featured DESC, created_at DESC';

    const lim = parseInt(limit) || 50;
    const off = parseInt(offset) || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(lim, off);

    const products = dbAll(query, params);

    // Count
    let countQuery = 'SELECT COUNT(*) as total FROM products WHERE 1=1';
    const countParams = [];
    if (category) { countQuery += ' AND category = ?'; countParams.push(category); }
    if (material) { countQuery += ' AND material LIKE ?'; countParams.push(`%${material}%`); }
    if (search) { countQuery += ' AND (name LIKE ? OR description LIKE ? OR collection LIKE ? OR material LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (minPrice) { countQuery += ' AND price >= ?'; countParams.push(parseFloat(minPrice)); }
    if (maxPrice) { countQuery += ' AND price <= ?'; countParams.push(parseFloat(maxPrice)); }
    if (featured === 'true') { countQuery += ' AND featured = 1'; }

    const total = dbGet(countQuery, countParams)?.total || 0;
    res.json({ products, total, limit: lim, offset: off });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/products/:id', (req, res) => {
  try {
    const product = dbGet('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    if (product.specs) {
      try { product.specs = JSON.parse(product.specs); } catch(e) {}
    }

    const related = dbAll(
      'SELECT * FROM products WHERE category = ? AND id != ? ORDER BY RANDOM() LIMIT 3',
      [product.category, product.id]
    );

    res.json({ product, related });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.get('/featured', (req, res) => {
  try {
    const products = dbAll('SELECT * FROM products WHERE featured = 1 ORDER BY created_at DESC LIMIT 6');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = dbAll('SELECT category, COUNT(*) as count FROM products GROUP BY category');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/materials', (req, res) => {
  try {
    const materials = dbAll('SELECT DISTINCT material FROM products ORDER BY material');
    res.json(materials.map(m => m.material));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// ==================== CART ====================

router.get('/cart', (req, res) => {
  try {
    const sessionId = req.sessionID;
    const items = dbAll(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.currency, p.image_url, p.stock, p.collection
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]);
    
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/cart', (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID required' });

    const product = dbGet('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const existing = dbGet('SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock) return res.status(400).json({ error: 'Insufficient stock' });
      dbRun('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing.id]);
    } else {
      dbRun('INSERT INTO cart_items (session_id, product_id, quantity) VALUES (?, ?, ?)', [sessionId, productId, quantity]);
    }
    saveDb();

    const items = dbAll(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.currency, p.image_url, p.stock, p.collection
      FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.session_id = ?
    `, [sessionId]);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0), message: 'Added to cart' });
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.put('/cart/:id', (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { quantity } = req.body;
    if (quantity < 1) {
      dbRun('DELETE FROM cart_items WHERE id = ? AND session_id = ?', [parseInt(req.params.id), sessionId]);
    } else {
      dbRun('UPDATE cart_items SET quantity = ? WHERE id = ? AND session_id = ?', [quantity, parseInt(req.params.id), sessionId]);
    }
    saveDb();
    const items = dbAll(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.currency, p.image_url, p.stock, p.collection
      FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.session_id = ?
    `, [sessionId]);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

router.delete('/cart/:id', (req, res) => {
  try {
    const sessionId = req.sessionID;
    dbRun('DELETE FROM cart_items WHERE id = ? AND session_id = ?', [parseInt(req.params.id), sessionId]);
    saveDb();
    const items = dbAll(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.currency, p.image_url, p.stock, p.collection
      FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.session_id = ?
    `, [sessionId]);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

// ==================== NEWSLETTER ====================

router.post('/subscribe', (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    
    const existing = dbGet('SELECT * FROM subscribers WHERE email = ?', [email]);
    if (existing) return res.json({ message: 'Already subscribed!' });

    dbRun('INSERT INTO subscribers (email) VALUES (?)', [email]);
    saveDb();
    res.json({ message: "Successfully subscribed to the Collector's Circle!" });
  } catch (err) {
    console.error('Error subscribing:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ==================== CHECKOUT ====================

router.post('/checkout', (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { customerName, customerEmail, customerPhone, shippingAddress } = req.body;
    if (!customerName || !customerEmail || !customerPhone) return res.status(400).json({ error: 'Name, email and phone are required' });

    const cartItems = dbAll(`
      SELECT ci.*, p.price, p.stock, p.name as product_name
      FROM cart_items ci JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]);

    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${item.product_name}` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderResult = dbRun(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, status, total) VALUES (?, ?, ?, ?, ?, ?)',
      [customerName, customerEmail, customerPhone || '', shippingAddress || '', 'Processing', total]
    );
    const orderId = orderResult.lastInsertRowid;

    for (const item of cartItems) {
      dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]);
      dbRun('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    dbRun('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);
    saveDb();

    res.json({ message: 'Order placed successfully!', orderId });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

module.exports = router;
