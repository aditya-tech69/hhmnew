const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
}

const addAutoInc = (schema, name) => {
  schema.add({ id: { type: Number, unique: true } });
  schema.pre('save', async function () {
    if (this.isNew && this.id === undefined) {
      this.id = await getNextSequence(name);
    }
  });
};

const productSchema = new mongoose.Schema({
  name: String, 
  collection_name: String, 
  category: String, 
  material: String,
  description: String, 
  price: Number, 
  currency: { type: String, default: 'USD' },
  image_url: String, 
  stock: { type: Number, default: 0 },
  featured: { type: Number, default: 0 }, 
  badge: String, 
  specs: String,
  origin: { type: String, default: 'Artisan Workshop' }, 
  capacity: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
addAutoInc(productSchema, 'products');

// Add translation layer to ensure product JSON matches expected format.
productSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.collection = ret.collection_name; // mapping internally
    delete ret.collection_name;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
  customer_name: String, customer_email: String, customer_phone: String,
  shipping_address: String, status: { type: String, default: 'Processing' },
  total: Number,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
addAutoInc(orderSchema, 'orders');
orderSchema.set('toJSON', { transform: (doc, ret) => { delete ret._id; delete ret.__v; return ret; } });
const Order = mongoose.model('Order', orderSchema);

const orderItemSchema = new mongoose.Schema({
  order_id: Number, product_id: Number, quantity: Number, price: Number
});
addAutoInc(orderItemSchema, 'order_items');
orderItemSchema.set('toJSON', { transform: (doc, ret) => { delete ret._id; delete ret.__v; return ret; } });
const OrderItem = mongoose.model('OrderItem', orderItemSchema);

const subscriberSchema = new mongoose.Schema({
  email: { type: String, unique: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
addAutoInc(subscriberSchema, 'subscribers');
subscriberSchema.set('toJSON', { transform: (doc, ret) => { delete ret._id; delete ret.__v; return ret; } });
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

const adminUserSchema = new mongoose.Schema({
  username: { type: String, unique: true }, password_hash: String,
  display_name: String, role: { type: String, default: 'Principal Curator' },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
addAutoInc(adminUserSchema, 'admin_users');
adminUserSchema.set('toJSON', { transform: (doc, ret) => { delete ret._id; delete ret.__v; return ret; } });
const AdminUser = mongoose.model('AdminUser', adminUserSchema);

const cartItemSchema = new mongoose.Schema({
  session_id: String, product_id: Number, quantity: { type: Number, default: 1 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
addAutoInc(cartItemSchema, 'cart_items');
cartItemSchema.set('toJSON', { transform: (doc, ret) => { delete ret._id; delete ret.__v; return ret; } });
const CartItem = mongoose.model('CartItem', cartItemSchema);

async function initializeDatabase(uri) {
  try {
    const MONGO_URI = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/hhm-innovation';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const adminCheck = await AdminUser.findOne({ username: 'adityasir' });
    if (!adminCheck) {
      const passwordHash = bcrypt.hashSync('samsung1', 10);
      await AdminUser.create({ username: 'adityasir', password_hash: passwordHash, display_name: 'Aditya Sir', role: 'Principal Curator' });
      console.log('Updated admin credentials to adityasir');
    }

    const count = await Product.countDocuments();
    if (count > 0) {
      console.log('Database already seeded.');
      return;
    }

    console.log('Seeding database...');
    const products = [
      {
        name: 'Ethereal Flute Set', collection_name: 'Refraction Collection', category: 'Glassware',
        material: 'Lead-free Crystal Glass', description: 'A set of six hand-blown crystal champagne flutes.',
        price: 35700, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZV30KFeHUebMPgTVnsK8AHvpDzWBzZw2QRdCh9aPl-2nQqGa6jgMnnYKLmjZC9KmXuNX5z7FfWdFdLbB6Y4L3ccR6AjLpOEV2s_iL5QtKXqnP8HoniuMbgMArLdHNBxUBCU5TyfQFCdWDkcPPMkJoqWHDXOxz0-x8sxXqBtacj2L0Aus1m4ZdClk8RtsxaD-43FBt0Ib7IOwx2doqpiv4ru5010qKmc6QCgQdOeIO37dYvAfUueaCswgpZYbj-peYGoU9b_bJl_JV',
        stock: 24, featured: 1, badge: null, specs: JSON.stringify({ 'Light Refraction': 'Prismatic geometry bowl' }),
        origin: 'Venetian Atelier', capacity: '180ml per flute'
      },
      {
        name: 'Obsidian Dinner Plate', collection_name: 'Earth & Fire', category: 'Ceramics',
        material: 'Satin Matte Ceramic', description: 'A statement dinner plate with an organic, hand-finished edge.',
        price: 15725, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcH1vsBhQNtZYErQyoOSxy0v-fQukDv5rAOr6onhP_9oWpWjxrRyXtNyVREDzP1gQwTU8vMkAHxarYOx3W11poc-WH9HuIStgcQzh5AJ_uz0LtndjOB2CN_vQDtyuV_7g4eeS96XI8RZEiD9pwPplsRWoY_C5Q-YiE3q-ur2PuzRXoKQQRoPLotyDRYoBFZZmqlVo3gFqXqGEkOYiZMFBv1HDLFJIdFQHxiiTG-xyAhKfbQMczl6wM8DMn-OhU8rzj-atRDNkl5UGx',
        stock: 48, featured: 1, badge: 'Bestseller', specs: JSON.stringify({ 'Kiln Temperature': 'Three-stage firing at 1200°C' }),
        origin: 'Kyoto Ceramics Studio', capacity: '28cm diameter'
      },
      {
        name: 'Geometric Decanter', collection_name: 'The Prism Series', category: 'Glassware',
        material: 'Borosilicate Glass', description: 'Designed with mathematical precision, the Geometric Decanter features an asymmetric prismatic base that refracts light across your table, turning the act of pouring into a sensory performance.',
        price: 24650, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhUF_cEXXMq5m6Dd9joEPFA-OCD9Pkr5M-SiBMGphv6oRKRzgjosbmMG4kJGHGddBoVqSbga7CYayRrEopK_dI093yi-A3bgl3hyWKnMN9j0GJkj1zGr6v97q7dnVF4MFBFnb3k6XAWDSimQbgGFh_DL4ivew77GUVzx1axB2JqiS_dQjocEbTJ4iNprzYCm1hMqQP8pbx8gFQNSas_xsCW6f4KCe0RKqTrbZ7CMo5Ow2LF3sYyCG4ALHbIQ2MZAhJW_-y2VMKLi91',
        stock: 15, featured: 1, badge: null, specs: JSON.stringify({ 'Light Refraction': 'Asymmetric prismatic base design' }),
        origin: 'Venetian Atelier', capacity: '750ml'
      },
      {
        name: 'Nimbus Bowl Stack', collection_name: 'Zenith Porcelain', category: 'Ceramics',
        material: 'Tonal White Glaze', description: 'A nesting set of three porcelain bowls in graduated sizes.',
        price: 28900, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBifxeiZPqwhRDKekByL30Ju9ThPGa5qHFvqrPDljruFwlEU6AucmANie294a0rD0OBLjaIreVsGT7afqMlJ95PsjPaZrhxKyetwiI_P1fs26NS-KjA6IkAMo0JnMNFQP1pAoy0y4Up7I4o_Br0FHiGqUV1AculVhDA3IJt7-Y_It6funfPv12j9LpFYpVsufSYHDw5gvu_XTz3AuJcY8oQTvlZAy5Ljde2I6tUJYwigrG9Z-MCcjk2wP53BEywNu3F-wn0dKT5LnZ9',
        stock: 32, featured: 0, badge: null, specs: JSON.stringify({ 'Composition': 'Porcelain with volcanic ash' }),
        origin: 'Kyoto Ceramics Studio', capacity: '300ml / 600ml / 1000ml'
      },
      {
        name: 'Aurelian Coupe Pair', collection_name: 'Vintage Reimagined', category: 'Glassware',
        material: '24k Gold Rimmed Glass', description: 'A pair of vintage-inspired champagne coupes with a delicate 24k gold rim applied by hand.',
        price: 47600, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmEfKuQ2n-7cpvocE6O2TdYBumF1OlBkHpEJXg9Qo5QRqLj2_KW185CliJ7Aa4YpFpADaOehsUdbCq8R2_RrPk3ihh1pVLv401syrGB-tmtd4z2mjTxywABh0Es6yOYqPbEIJKotK0dqspF3qWXzGmZ4TqoZxPQFGHOp4-HrNAzawO3tsEwjxwO_WL8YEUoljIZrrGsZfnBvlNXxYmEmOyuK6T7SZyrrvgnsMOyoOHks-xmxTcs1C5GyGD1OPgZ9QNGBIAFhLLzDgb',
        stock: 18, featured: 1, badge: null, specs: JSON.stringify({ 'Rim Detail': '24k gold hand-applied rim' }),
        origin: 'Venetian Atelier', capacity: '250ml per coupe'
      },
      {
        name: 'Cobalt Specimen Vase', collection_name: 'Pigment Series', category: 'Glassware',
        material: 'Hand-blown Pigmented Glass', description: 'A sculptural vase crafted from deep cobalt blue pigmented glass.',
        price: 61625, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkPJjkGh-E0o7CuZEn2_6CGSHqN2k3-RovA_6qq8UeC9HhQjFcp1sAGDOm6vxvzos7Mmoe437VNXwSbwkDjkUkuF3XlfJ57Ou23Au8pYvUWtJfuAfIW7wqDMmG4cysh_0pUoFr7YuunBapUzlKJu3xlJ3T511NyHxzUe3ynFFbAggY3uCBLmxwiLFhptpHQqe4z6UjKuWr2EWAZp8bo_JXmvxiHJDOf0sK64UCq3vINGZ7d9PaLFDUBWq7gePbQEHGkNIUu8SiB7oi',
        stock: 8, featured: 0, badge: null, specs: JSON.stringify({ 'Color': 'Deep cobalt blue' }),
        origin: 'Murano Glass Workshop', capacity: '1500ml'
      },
      {
        name: 'The Aurelius Decanter', collection_name: 'Refractions Series', category: 'Glassware',
        material: 'Borosilicate Crystal', description: 'Designed with mathematical precision, the Aurelius features an asymmetric prismatic base.',
        price: 40800, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzC7TsuYNTrVk3_Mfr3UHgYEXDbfs9wBgglalm1SSYu1C1YxidhqE-FhoUDwlWU8hAdEhEfl9-i53p3aM-4Qg9YGEuYaDvRpOwJubeAxpheLMfGcHZOvKk6iFtaJo8VGdoNDcGqXJ3j25kGQezAMfcF9D6pyJWcowdUsKyX_uG3ZNfT4qyhidNen0LnAXBVN448GUQtnGcJNk9O_Mngkpxe_5ExmpWk_Dl2hApAEFTBztzaJO-a-5tp6mBACbbrd8zxCp_hHxFf_mw',
        stock: 12, featured: 1, badge: 'New Arrival', specs: JSON.stringify({ 'Light Refraction': 'Prismatic base maximizes brilliance' }),
        origin: 'Venetian Atelier', capacity: '750ml'
      },
      {
        name: 'Aurelius Tumblers', collection_name: 'Refractions Series', category: 'Glassware',
        material: 'Borosilicate Crystal', description: 'A matching pair of heavy-base crystal tumblers.',
        price: 15300, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbNqiNIGIIuk8dAAdUslxhC--kIZyWiu5eyT4g3rmX3FlxIuzYQNLJuWNmZAmsSMvCqKuc0GpcGlnk4mJYE16oz6E32s6fSgRKYzDYRj3Y4FxXflMPixuIIYWU88_RlWr1Le_dlgRlq5cV8R7gZNhKQ7Bv7V1Y_if5kxcfxCMMJQ7e9_n6ta-iGmflkw3-TWcd-nImJJfKdcUjkZJBWKJCV12axT2GCPuXp8SHJKsnfX6eopXqh_d7igrcWccGR8403p_nefwlMkMC',
        stock: 20, featured: 0, badge: null, specs: JSON.stringify({ 'Base': 'Heavy weighted base' }),
        origin: 'Venetian Atelier', capacity: '300ml per tumbler'
      },
      {
        name: 'Travertine Plinth Tray', collection_name: 'Terra Collection', category: 'Accessories',
        material: 'Natural Travertine Stone', description: 'An elegant circular serving tray carved from a single block of premium travertine stone.',
        price: 27200, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkCkmpU72Tfqd7EmCE_q0inKDtfOdpBI_AG4mzXFPvkU2QSCEubUg_5eHPMrvNJ_qzpLrTt5CwctXTvawWILPXX_OT4WMCHjkgUtB8KeltQNn8Bu8B2MJReViuBrI_GBfiucoRO8xv7bGeMFAb0_c7TTcSSc77CewLfBaYOUvryPnkPWINOTiFkUyKcG-o9a7llGEm_mqqpM5yUTCO8fBjOWP8ydK3Q2exNoSi-4tdDlPrvPyRquzwUpcJEPYpX5BbAE5IsK-gNMws',
        stock: 14, featured: 0, badge: null, specs: JSON.stringify({ 'Material': 'Single-block premium travertine' }),
        origin: 'Italian Quarry', capacity: '35cm diameter'
      },
      {
        name: 'Helix Aerator', collection_name: 'Refractions Series', category: 'Accessories',
        material: 'Sculpted Glass', description: 'A modern sculptural glass wine aerator with organic flowing curves.',
        price: 9350, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPIAjfSvvzSEDkuhC4XSIzkuZ6vp3UqmEaBsgQK1AcQ-dobHVble_0jL0yYv9CbPg0KTpeMB28FxPT3q2-X0ihU35DCovU5CaSn_nkvTnQ8VKjbQmxaLMXgxx56Ien3XBY5UwImde_JYtcP-TMRAAcqeA9bp9AjGxlk__hVuFRM4S0Cvpj30bfohFTMGsP9AhTi6HFIkwCqE4CKsJOR7Dp1YGNwKv5InJgzBQk73Vzq51LsGHCDEellY7jj8t5ouG6HXy4qrEafG-9',
        stock: 30, featured: 0, badge: null, specs: JSON.stringify({ 'Design': 'Helix flow pattern' }),
        origin: 'Venetian Atelier', capacity: 'Single-pour aerator'
      },
      {
        name: 'Prism Decanter Set', collection_name: 'The Prism Series', category: 'Glassware',
        material: 'Hand-blown Crystal', description: 'The complete Prism experience: a matching decanter and four tumblers.',
        price: 204000, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB88zqEKZwFEbg99IRJLymj6cHhAsq7pn0weEq2JxRvIv724hsFZbzIUIBHoeeqRbOmIGSwdplK7mRC9NCjyQiWhJK6NVtADL_k6U1rfE5e7Nntoz0y07OPEq4yL6nX776YCvJJupVK91RGLgt2rKE1bK0N6TGN-IAvcUY4YFpPeRQsa8OLTK8R360NyxLy6ZXXrlM6gjX93b7NsSsfAfzHdPEQQe5lLPSs5-hZVgEgru5eFGiw_hP2RX0Ci5wubt7XmuvttKKaJfGQ',
        stock: 6, featured: 1, badge: 'Premium Tier', specs: JSON.stringify({ 'Set Contents': '1 decanter + 4 tumblers' }),
        origin: 'Venetian Atelier', capacity: '750ml decanter + 250ml tumblers'
      },
      {
        name: 'Basalt Ceramic Suite', collection_name: 'Earth & Fire', category: 'Ceramics',
        material: 'Volcanic Basalt Ceramic', description: 'A complete 12-piece dining set featuring plates, bowls, and side dishes.',
        price: 157250, currency: 'INR', image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-LGv4OvdtR4kwheaG3dXKCfHBpFskjs7P0f0Y5i3ylEp1IuhM07G0DEGo2NyGZtH91nbifRtGKLfWR6SASHzhWvmQR1vHpVq6FIkJze25RUASGF2M5xtVQMO8FHN6-j_VtEseXuuGWk6UXRdmCRhWyFssjcfRIuKlW-MED5f-4hgGpcS8ReruxaAIqOMQCa7Z2vaK0bwHADmOruZ-rK_nIZ2hAo0y8u_Es8RR54JDOHfQMaD-cZ97mrsnPhEKybgjX29nuWgLiBWN',
        stock: 10, featured: 0, badge: null, specs: JSON.stringify({ 'Set': '12 pieces' }),
        origin: 'Kyoto Ceramics Studio', capacity: '12-piece set'
      }
    ];

    for (const p of products) {
      await Product.create(p);
    }
    
    // Seed an order
    const sampleProduct = await Product.findOne();
    const order = await Order.create({
      customer_name: 'A. Sterling',
      customer_email: 'a.sterling@example.com',
      status: 'Fulfilled',
      total: sampleProduct.price
    });
    await OrderItem.create({
      order_id: order.id,
      product_id: sampleProduct.id,
      quantity: 1,
      price: sampleProduct.price
    });

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Mongo Initialization Error:', err);
  }
}

module.exports = { 
  initializeDatabase,
  Product,
  Order,
  OrderItem,
  Subscriber,
  AdminUser,
  CartItem
};
