const express = require('express');
const router = express.Router();
const { Product, CartItem, Subscriber, Order, OrderItem } = require('../database');

// ==================== PRODUCTS ====================

router.get('/products', async (req, res) => {
  try {
    const { category, material, search, minPrice, maxPrice, featured, sort, limit, offset } = req.query;
    
    let query = {};

    if (category) query.category = category;
    if (material) query.material = new RegExp(material, 'i');
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { collection_name: searchRegex },
        { material: searchRegex }
      ];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (featured === 'true') {
      query.featured = 1;
    }

    let sortObj = { featured: -1, created_at: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'name') sortObj = { name: 1 };
    else if (sort === 'newest') sortObj = { created_at: -1 };

    const lim = parseInt(limit) || 50;
    const off = parseInt(offset) || 0;

    const products = await Product.find(query).sort(sortObj).skip(off).limit(lim).lean();
    
    // Map collection_name to collection for the frontend
    const mappedProducts = products.map(p => ({
      ...p,
      collection: p.collection_name
    }));

    const total = await Product.countDocuments(query);
    res.json({ products: mappedProducts, total, limit: lim, offset: off });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id) }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    product.collection = product.collection_name;

    if (product.specs && typeof product.specs === 'string') {
      try { product.specs = JSON.parse(product.specs); } catch(e) {}
    }

    const related = await Product.aggregate([
      { $match: { category: product.category, id: { $ne: product.id } } },
      { $sample: { size: 3 } }
    ]);
    const mappedRelated = related.map(p => ({ ...p, collection: p.collection_name }));

    res.json({ product, related: mappedRelated });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ featured: 1 }).sort({ created_at: -1 }).limit(6).lean();
    const mappedProducts = products.map(p => ({ ...p, collection: p.collection_name }));
    res.json(mappedProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } }
    ]);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/materials', async (req, res) => {
  try {
    const materials = await Product.distinct('material');
    res.json(materials.sort());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// ==================== CART ====================

router.get('/cart', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const cartItems = await CartItem.aggregate([
      { $match: { session_id: sessionId } },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: 'id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);
    
    const items = cartItems.map(ci => ({
      id: ci.id,
      quantity: ci.quantity,
      product_id: ci.product_id,
      name: ci.product.name,
      price: ci.product.price,
      currency: ci.product.currency,
      image_url: ci.product.image_url,
      stock: ci.product.stock,
      collection: ci.product.collection_name
    }));

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/cart', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID required' });

    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const existing = await CartItem.findOne({ session_id: sessionId, product_id: productId });
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock) return res.status(400).json({ error: 'Insufficient stock' });
      existing.quantity = newQty;
      await existing.save();
    } else {
      await CartItem.create({ session_id: sessionId, product_id: productId, quantity });
    }

    // Return new cart
    const cartItems = await CartItem.aggregate([
      { $match: { session_id: sessionId } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: 'id', as: 'product' } },
      { $unwind: '$product' }
    ]);
    const items = cartItems.map(ci => ({
      id: ci.id, quantity: ci.quantity, product_id: ci.product_id,
      name: ci.product.name, price: ci.product.price, currency: ci.product.currency,
      image_url: ci.product.image_url, stock: ci.product.stock, collection: ci.product.collection_name
    }));
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0), message: 'Added to cart' });
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.put('/cart/:id', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { quantity } = req.body;
    if (quantity < 1) {
      await CartItem.deleteOne({ id: parseInt(req.params.id), session_id: sessionId });
    } else {
      await CartItem.updateOne({ id: parseInt(req.params.id), session_id: sessionId }, { quantity });
    }
    
    const cartItems = await CartItem.aggregate([
      { $match: { session_id: sessionId } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: 'id', as: 'product' } },
      { $unwind: '$product' }
    ]);
    const items = cartItems.map(ci => ({
      id: ci.id, quantity: ci.quantity, product_id: ci.product_id,
      name: ci.product.name, price: ci.product.price, currency: ci.product.currency,
      image_url: ci.product.image_url, stock: ci.product.stock, collection: ci.product.collection_name
    }));
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

router.delete('/cart/:id', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    await CartItem.deleteOne({ id: parseInt(req.params.id), session_id: sessionId });
    
    const cartItems = await CartItem.aggregate([
      { $match: { session_id: sessionId } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: 'id', as: 'product' } },
      { $unwind: '$product' }
    ]);
    const items = cartItems.map(ci => ({
      id: ci.id, quantity: ci.quantity, product_id: ci.product_id,
      name: ci.product.name, price: ci.product.price, currency: ci.product.currency,
      image_url: ci.product.image_url, stock: ci.product.stock, collection: ci.product.collection_name
    }));
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items, total, count: items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

// ==================== NEWSLETTER ====================

router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    
    const existing = await Subscriber.findOne({ email });
    if (existing) return res.json({ message: 'Already subscribed!' });

    await Subscriber.create({ email });
    res.json({ message: "Successfully subscribed to the Collector's Circle!" });
  } catch (err) {
    if (err.code === 11000) return res.json({ message: 'Already subscribed!' });
    console.error('Error subscribing:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ==================== CHECKOUT ====================

router.post('/checkout', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const { customerName, customerEmail, customerPhone, shippingAddress } = req.body;
    if (!customerName || !customerEmail || !customerPhone) return res.status(400).json({ error: 'Name, email and phone are required' });

    const cartItems = await CartItem.aggregate([
      { $match: { session_id: sessionId } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: 'id', as: 'product' } },
      { $unwind: '$product' }
    ]);

    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${item.product.name}` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const order = await Order.create({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || '',
      shipping_address: shippingAddress || '',
      status: 'Processing',
      total
    });

    for (const item of cartItems) {
      await OrderItem.create({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product.price
      });
      await Product.updateOne(
        { id: item.product_id },
        { $inc: { stock: -item.quantity } }
      );
    }

    await CartItem.deleteMany({ session_id: sessionId });

    res.json({ message: 'Order placed successfully!', orderId: order.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

module.exports = router;
