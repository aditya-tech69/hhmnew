const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Product, CartItem, Subscriber, Order, OrderItem, AdminUser } = require('../database');
const { requireAdmin } = require('../middleware/auth');

// ==================== AUTH ====================

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const admin = await AdminUser.findOne({ username }).lean();
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

router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const revenueAgg = await Order.aggregate([{ $group: { _id: null, revenue: { $sum: "$total" } } }]);
    const totalRevenue = revenueAgg[0]?.revenue || 0;
    
    const totalOrders = await Order.countDocuments();
    const activeOrders = await Order.countDocuments({ status: { $in: ['Processing', 'In Transit'] } });
    const processingOrders = await Order.countDocuments({ status: 'Processing' });
    
    const totalInventoryAgg = await Product.aggregate([{ $group: { _id: null, total: { $sum: "$stock" } } }]);
    const totalInventory = totalInventoryAgg[0]?.total || 0;
    
    const totalProducts = await Product.countDocuments();
    const totalSubscribers = await Subscriber.countDocuments();

    const inventoryByCategory = await Product.aggregate([
      { $group: { _id: "$category", stock: { $sum: "$stock" }, products: { $sum: 1 } } },
      { $project: { category: "$_id", stock: 1, products: 1, _id: 0 } }
    ]);

    const lowStockCount = await Product.countDocuments({ stock: { $lt: 5 } });
    const stockIntegrity = totalProducts > 0 ? Math.round(((totalProducts - lowStockCount) / totalProducts) * 100) : 100;

    const recentOrdersRaw = await Order.aggregate([
      { $sort: { created_at: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'order_items', localField: 'id', foreignField: 'order_id', as: 'items' } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'products', localField: 'items.product_id', foreignField: 'id', as: 'product_details' } },
      { $unwind: { path: '$product_details', preserveNullAndEmptyArrays: true } },
      { 
        $group: { 
          _id: "$_id", 
          id: { $first: "$id" },
          customer_name: { $first: "$customer_name" }, 
          customer_email: { $first: "$customer_email" },
          customer_phone: { $first: "$customer_phone" },
          status: { $first: "$status" },
          total: { $first: "$total" },
          created_at: { $first: "$created_at" },
          product_names: { $push: "$product_details.name" }
        } 
      },
      { $sort: { created_at: -1 } }
    ]);

    const recentOrders = recentOrdersRaw.map(o => ({
      ...o,
      product_names: o.product_names.filter(Boolean).join(', ')
    }));

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

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity } = req.body;
    if (!name || !collection || !category || !material || !description || !price || !image_url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newProduct = await Product.create({
      name, collection_name: collection, category, material, description, price,
      currency: currency || 'USD', image_url, stock: stock || 0,
      featured: featured ? 1 : 0, badge: badge || null,
      specs: specs ? JSON.stringify(specs) : null,
      origin: origin || 'Artisan Workshop', capacity: capacity || null
    });
    
    // Convert to JSON and map collection_name to collection
    const json = newProduct.toJSON();
    res.status(201).json(json);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity } = req.body;
    const existing = await Product.findOne({ id: parseInt(req.params.id) });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    if (name) existing.name = name;
    if (collection) existing.collection_name = collection;
    if (category) existing.category = category;
    if (material) existing.material = material;
    if (description) existing.description = description;
    if (price !== undefined) existing.price = price;
    if (currency) existing.currency = currency;
    if (image_url) existing.image_url = image_url;
    if (stock !== undefined) existing.stock = stock;
    if (featured !== undefined) existing.featured = featured ? 1 : 0;
    if (badge !== undefined) existing.badge = badge;
    if (specs) existing.specs = typeof specs === 'object' ? JSON.stringify(specs) : specs;
    if (origin) existing.origin = origin;
    if (capacity !== undefined) existing.capacity = capacity;

    await existing.save();
    
    res.json(existing.toJSON());
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id) });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await Product.deleteOne({ id: parseInt(req.params.id) });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==================== ORDER MANAGEMENT ====================

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let matchStage = {};
    if (status) matchStage.status = status;

    const ordersRaw = await Order.aggregate([
      { $match: matchStage },
      { $sort: { created_at: -1 } },
      { $lookup: { from: 'order_items', localField: 'id', foreignField: 'order_id', as: 'items' } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'products', localField: 'items.product_id', foreignField: 'id', as: 'product_details' } },
      { $unwind: { path: '$product_details', preserveNullAndEmptyArrays: true } },
      { 
        $group: { 
          _id: "$_id", 
          id: { $first: "$id" },
          customer_name: { $first: "$customer_name" }, 
          customer_email: { $first: "$customer_email" },
          customer_phone: { $first: "$customer_phone" },
          shipping_address: { $first: "$shipping_address" },
          status: { $first: "$status" },
          total: { $first: "$total" },
          created_at: { $first: "$created_at" },
          product_names: { $push: "$product_details.name" }
        } 
      },
      { $sort: { created_at: -1 } }
    ]);

    const orders = ordersRaw.map(o => ({
      ...o,
      product_names: o.product_names.filter(Boolean).join(', ')
    }));

    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Processing', 'In Transit', 'Fulfilled', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const existing = await Order.findOne({ id: parseInt(req.params.id) });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    existing.status = status;
    await existing.save();
    res.json(existing.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ==================== SUBSCRIBERS ====================

router.get('/subscribers', requireAdmin, async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ created_at: -1 }).lean();
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

module.exports = router;
