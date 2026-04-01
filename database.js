const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.VERCEL ? '/tmp/hhm.db' : path.join(__dirname, 'data', 'hhm.db');
let db = null;
let SQL = null;

async function getDb() {
  if (db) return db;
  
  if (!SQL) {
    SQL = await initSqlJs();
  }

  const dataDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dataDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save periodically
setInterval(saveDb, 30000);

// Wrapper helpers to mimic better-sqlite3 API
function dbRun(sql, params = []) {
  db.run(sql, params);
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0, changes: db.getRowsModified() };
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

async function initializeDatabase() {
  await getDb();
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      collection TEXT NOT NULL,
      category TEXT NOT NULL,
      material TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      image_url TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      badge TEXT,
      specs TEXT,
      origin TEXT DEFAULT 'Artisan Workshop',
      capacity TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address TEXT,
      status TEXT DEFAULT 'Processing',
      total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.run('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
  } catch (e) {
    // Column might already exist
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'Principal Curator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Ensure adityasir admin exists
  const adminCheck = dbGet('SELECT * FROM admin_users WHERE username = ?', ['adityasir']);
  if (!adminCheck) {
    const newPasswordHash = bcrypt.hashSync('samsung1', 10);
    dbRun('DELETE FROM admin_users WHERE username = "admin"');
    dbRun('INSERT INTO admin_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      ['adityasir', newPasswordHash, 'Aditya Sir', 'Principal Curator']);
    saveDb();
    console.log('Updated admin credentials to adityasir');
  }

  // Check if data already exists
  const count = dbGet('SELECT COUNT(*) as count FROM products');
  if (count && count.count > 0) {
    console.log('Database already seeded.');
    return;
  }

  console.log('Seeding database...');

  // Seed admin user
  const passwordHash = bcrypt.hashSync('samsung1', 10);
  dbRun('INSERT INTO admin_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    ['adityasir', passwordHash, 'Aditya Sir', 'Principal Curator']);

  // Seed products
  const products = [
    {
      name: 'Ethereal Flute Set',
      collection: 'Refraction Collection',
      category: 'Glassware',
      material: 'Lead-free Crystal Glass',
      description: 'A set of six hand-blown crystal champagne flutes designed to maximize the effervescence and aroma of the finest vintages. Each flute features a mathematically precise bowl geometry that creates cascading light refractions across your table.',
      price: 420.00,
      currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZV30KFeHUebMPgTVnsK8AHvpDzWBzZw2QRdCh9aPl-2nQqGa6jgMnnYKLmjZC9KmXuNX5z7FfWdFdLbB6Y4L3ccR6AjLpOEV2s_iL5QtKXqnP8HoniuMbgMArLdHNBxUBCU5TyfQFCdWDkcPPMkJoqWHDXOxz0-x8sxXqBtacj2L0Aus1m4ZdClk8RtsxaD-43FBt0Ib7IOwx2doqpiv4ru5010qKmc6QCgQdOeIO37dYvAfUueaCswgpZYbj-peYGoU9b_bJl_JV',
      stock: 24, featured: 1, badge: null,
      specs: JSON.stringify({ 'Light Refraction': 'Prismatic geometry bowl', 'Thermal Resistance': 'Dishwasher safe up to 65°C', 'Artisan Blown': 'Each piece individually mouth-blown' }),
      origin: 'Venetian Atelier', capacity: '180ml per flute'
    },
    {
      name: 'Obsidian Dinner Plate',
      collection: 'Earth & Fire',
      category: 'Ceramics',
      material: 'Satin Matte Ceramic',
      description: 'A statement dinner plate with an organic, hand-finished edge that celebrates the imperfections of artisanal craft. The deep charcoal matte glaze is achieved through a proprietary three-stage firing process at 1200°C.',
      price: 185.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcH1vsBhQNtZYErQyoOSxy0v-fQukDv5rAOr6onhP_9oWpWjxrRyXtNyVREDzP1gQwTU8vMkAHxarYOx3W11poc-WH9HuIStgcQzh5AJ_uz0LtndjOB2CN_vQDtyuV_7g4eeS96XI8RZEiD9pwPplsRWoY_C5Q-YiE3q-ur2PuzRXoKQQRoPLotyDRYoBFZZmqlVo3gFqXqGEkOYiZMFBv1HDLFJIdFQHxiiTG-xyAhKfbQMczl6wM8DMn-OhU8rzj-atRDNkl5UGx',
      stock: 48, featured: 1, badge: 'Bestseller',
      specs: JSON.stringify({ 'Kiln Temperature': 'Three-stage firing at 1200°C', 'Finish': 'Proprietary matte glaze', 'Care': 'Dishwasher and microwave safe' }),
      origin: 'Kyoto Ceramics Studio', capacity: '28cm diameter'
    },
    {
      name: 'Geometric Decanter',
      collection: 'The Prism Series',
      category: 'Glassware',
      material: 'Borosilicate Glass',
      description: 'Designed with mathematical precision, the Geometric Decanter features an asymmetric prismatic base that refracts light across your table, turning the act of pouring into a sensory performance.',
      price: 290.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhUF_cEXXMq5m6Dd9joEPFA-OCD9Pkr5M-SiBMGphv6oRKRzgjosbmMG4kJGHGddBoVqSbga7CYayRrEopK_dI093yi-A3bgl3hyWKnMN9j0GJkj1zGr6v97q7dnVF4MFBFnb3k6XAWDSimQbgGFh_DL4ivew77GUVzx1axB2JqiS_dQjocEbTJ4iNprzYCm1hMqQP8pbx8gFQNSas_xsCW6f4KCe0RKqTrbZ7CMo5Ow2LF3sYyCG4ALHbIQ2MZAhJW_-y2VMKLi91',
      stock: 15, featured: 1, badge: null,
      specs: JSON.stringify({ 'Light Refraction': 'Asymmetric prismatic base design', 'Thermal Resistance': 'Laboratory-grade crystal', 'Artisan Blown': 'Individually mouth-blown with walnut cork' }),
      origin: 'Venetian Atelier', capacity: '750ml'
    },
    {
      name: 'Nimbus Bowl Stack',
      collection: 'Zenith Porcelain',
      category: 'Ceramics',
      material: 'Tonal White Glaze',
      description: 'A nesting set of three porcelain bowls in graduated sizes. The tonal white glaze creates a spectrum of warmth from ivory to cream.',
      price: 340.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBifxeiZPqwhRDKekByL30Ju9ThPGa5qHFvqrPDljruFwlEU6AucmANie294a0rD0OBLjaIreVsGT7afqMlJ95PsjPaZrhxKyetwiI_P1fs26NS-KjA6IkAMo0JnMNFQP1pAoy0y4Up7I4o_Br0FHiGqUV1AculVhDA3IJt7-Y_It6funfPv12j9LpFYpVsufSYHDw5gvu_XTz3AuJcY8oQTvlZAy5Ljde2I6tUJYwigrG9Z-MCcjk2wP53BEywNu3F-wn0dKT5LnZ9',
      stock: 32, featured: 0, badge: null,
      specs: JSON.stringify({ 'Composition': 'Porcelain with volcanic ash', 'Sizes': '14cm, 18cm, 22cm', 'Care': 'Oven, microwave, and dishwasher safe' }),
      origin: 'Kyoto Ceramics Studio', capacity: '300ml / 600ml / 1000ml'
    },
    {
      name: 'Aurelian Coupe Pair',
      collection: 'Vintage Reimagined',
      category: 'Glassware',
      material: '24k Gold Rimmed Glass',
      description: 'A pair of vintage-inspired champagne coupes with a delicate 24k gold rim applied by hand.',
      price: 560.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmEfKuQ2n-7cpvocE6O2TdYBumF1OlBkHpEJXg9Qo5QRqLj2_KW185CliJ7Aa4YpFpADaOehsUdbCq8R2_RrPk3ihh1pVLv401syrGB-tmtd4z2mjTxywABh0Es6yOYqPbEIJKotK0dqspF3qWXzGmZ4TqoZxPQFGHOp4-HrNAzawO3tsEwjxwO_WL8YEUoljIZrrGsZfnBvlNXxYmEmOyuK6T7SZyrrvgnsMOyoOHks-xmxTcs1C5GyGD1OPgZ9QNGBIAFhLLzDgb',
      stock: 18, featured: 1, badge: null,
      specs: JSON.stringify({ 'Rim Detail': '24k gold hand-applied rim', 'Style': 'Art Deco inspired', 'Care': 'Hand wash only' }),
      origin: 'Venetian Atelier', capacity: '250ml per coupe'
    },
    {
      name: 'Cobalt Specimen Vase',
      collection: 'Pigment Series',
      category: 'Glassware',
      material: 'Hand-blown Pigmented Glass',
      description: 'A sculptural vase crafted from deep cobalt blue pigmented glass with internal bubble details.',
      price: 725.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkPJjkGh-E0o7CuZEn2_6CGSHqN2k3-RovA_6qq8UeC9HhQjFcp1sAGDOm6vxvzos7Mmoe437VNXwSbwkDjkUkuF3XlfJ57Ou23Au8pYvUWtJfuAfIW7wqDMmG4cysh_0pUoFr7YuunBapUzlKJu3xlJ3T511NyHxzUe3ynFFbAggY3uCBLmxwiLFhptpHQqe4z6UjKuWr2EWAZp8bo_JXmvxiHJDOf0sK64UCq3vINGZ7d9PaLFDUBWq7gePbQEHGkNIUu8SiB7oi',
      stock: 8, featured: 0, badge: null,
      specs: JSON.stringify({ 'Color': 'Deep cobalt blue', 'Details': 'Internal bubble inclusions', 'Uniqueness': 'Each piece is one-of-a-kind' }),
      origin: 'Murano Glass Workshop', capacity: '1500ml'
    },
    {
      name: 'The Aurelius Decanter',
      collection: 'Refractions Series',
      category: 'Glassware',
      material: 'Borosilicate Crystal',
      description: 'Designed with mathematical precision, the Aurelius features an asymmetric prismatic base that refracts light across your table.',
      price: 480.00, currency: 'EUR',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzC7TsuYNTrVk3_Mfr3UHgYEXDbfs9wBgglalm1SSYu1C1YxidhqE-FhoUDwlWU8hAdEhEfl9-i53p3aM-4Qg9YGEuYaDvRpOwJubeAxpheLMfGcHZOvKk6iFtaJo8VGdoNDcGqXJ3j25kGQezAMfcF9D6pyJWcowdUsKyX_uG3ZNfT4qyhidNen0LnAXBVN448GUQtnGcJNk9O_Mngkpxe_5ExmpWk_Dl2hApAEFTBztzaJO-a-5tp6mBACbbrd8zxCp_hHxFf_mw',
      stock: 12, featured: 1, badge: 'New Arrival',
      specs: JSON.stringify({ 'Light Refraction': 'Prismatic base maximizes brilliance', 'Thermal Resistance': 'Thermal shock resistant', 'Artisan Blown': 'Individually mouth-blown by master artisan' }),
      origin: 'Venetian Atelier', capacity: '750ml'
    },
    {
      name: 'Aurelius Tumblers',
      collection: 'Refractions Series',
      category: 'Glassware',
      material: 'Borosilicate Crystal',
      description: 'A matching pair of heavy-base crystal tumblers designed to complement the Aurelius Decanter.',
      price: 180.00, currency: 'EUR',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbNqiNIGIIuk8dAAdUslxhC--kIZyWiu5eyT4g3rmX3FlxIuzYQNLJuWNmZAmsSMvCqKuc0GpcGlnk4mJYE16oz6E32s6fSgRKYzDYRj3Y4FxXflMPixuIIYWU88_RlWr1Le_dlgRlq5cV8R7gZNhKQ7Bv7V1Y_if5kxcfxCMMJQ7e9_n6ta-iGmflkw3-TWcd-nImJJfKdcUjkZJBWKJCV12axT2GCPuXp8SHJKsnfX6eopXqh_d7igrcWccGR8403p_nefwlMkMC',
      stock: 20, featured: 0, badge: null,
      specs: JSON.stringify({ 'Base': 'Heavy weighted base', 'Set': '2 matching tumblers', 'Care': 'Hand wash recommended' }),
      origin: 'Venetian Atelier', capacity: '300ml per tumbler'
    },
    {
      name: 'Travertine Plinth Tray',
      collection: 'Terra Collection',
      category: 'Accessories',
      material: 'Natural Travertine Stone',
      description: 'An elegant circular serving tray carved from a single block of premium travertine stone.',
      price: 320.00, currency: 'EUR',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkCkmpU72Tfqd7EmCE_q0inKDtfOdpBI_AG4mzXFPvkU2QSCEubUg_5eHPMrvNJ_qzpLrTt5CwctXTvawWILPXX_OT4WMCHjkgUtB8KeltQNn8Bu8B2MJReViuBrI_GBfiucoRO8xv7bGeMFAb0_c7TTcSSc77CewLfBaYOUvryPnkPWINOTiFkUyKcG-o9a7llGEm_mqqpM5yUTCO8fBjOWP8ydK3Q2exNoSi-4tdDlPrvPyRquzwUpcJEPYpX5BbAE5IsK-gNMws',
      stock: 14, featured: 0, badge: null,
      specs: JSON.stringify({ 'Material': 'Single-block premium travertine', 'Diameter': '35cm', 'Care': 'Wipe with damp cloth' }),
      origin: 'Italian Quarry', capacity: '35cm diameter'
    },
    {
      name: 'Helix Aerator',
      collection: 'Refractions Series',
      category: 'Accessories',
      material: 'Sculpted Glass',
      description: 'A modern sculptural glass wine aerator with organic flowing curves.',
      price: 110.00, currency: 'EUR',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPIAjfSvvzSEDkuhC4XSIzkuZ6vp3UqmEaBsgQK1AcQ-dobHVble_0jL0yYv9CbPg0KTpeMB28FxPT3q2-X0ihU35DCovU5CaSn_nkvTnQ8VKjbQmxaLMXgxx56Ien3XBY5UwImde_JYtcP-TMRAAcqeA9bp9AjGxlk__hVuFRM4S0Cvpj30bfohFTMGsP9AhTi6HFIkwCqE4CKsJOR7Dp1YGNwKv5InJgzBQk73Vzq51LsGHCDEellY7jj8t5ouG6HXy4qrEafG-9',
      stock: 30, featured: 0, badge: null,
      specs: JSON.stringify({ 'Design': 'Helix flow pattern', 'Aeration': 'Maximum air contact', 'Care': 'Rinse after each use' }),
      origin: 'Venetian Atelier', capacity: 'Single-pour aerator'
    },
    {
      name: 'Prism Decanter Set',
      collection: 'The Prism Series',
      category: 'Glassware',
      material: 'Hand-blown Crystal',
      description: 'The complete Prism experience: a matching decanter and four tumblers. Presented in a bespoke walnut gift box.',
      price: 2400.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB88zqEKZwFEbg99IRJLymj6cHhAsq7pn0weEq2JxRvIv724hsFZbzIUIBHoeeqRbOmIGSwdplK7mRC9NCjyQiWhJK6NVtADL_k6U1rfE5e7Nntoz0y07OPEq4yL6nX776YCvJJupVK91RGLgt2rKE1bK0N6TGN-IAvcUY4YFpPeRQsa8OLTK8R360NyxLy6ZXXrlM6gjX93b7NsSsfAfzHdPEQQe5lLPSs5-hZVgEgru5eFGiw_hP2RX0Ci5wubt7XmuvttKKaJfGQ',
      stock: 6, featured: 1, badge: 'Premium Tier',
      specs: JSON.stringify({ 'Set Contents': '1 decanter + 4 tumblers', 'Packaging': 'Bespoke walnut gift box', 'Crystal': 'Hand-blown lead-free crystal' }),
      origin: 'Venetian Atelier', capacity: '750ml decanter + 250ml tumblers'
    },
    {
      name: 'Basalt Ceramic Suite',
      collection: 'Earth & Fire',
      category: 'Ceramics',
      material: 'Volcanic Basalt Ceramic',
      description: 'A complete 12-piece dining set featuring plates, bowls, and side dishes in our signature basalt grey.',
      price: 1850.00, currency: 'USD',
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-LGv4OvdtR4kwheaG3dXKCfHBpFskjs7P0f0Y5i3ylEp1IuhM07G0DEGo2NyGZtH91nbifRtGKLfWR6SASHzhWvmQR1vHpVq6FIkJze25RUASGF2M5xtVQMO8FHN6-j_VtEseXuuGWk6UXRdmCRhWyFssjcfRIuKlW-MED5f-4hgGpcS8ReruxaAIqOMQCa7Z2vaK0bwHADmOruZ-rK_nIZ2hAo0y8u_Es8RR54JDOHfQMaD-cZ97mrsnPhEKybgjX29nuWgLiBWN',
      stock: 10, featured: 0, badge: null,
      specs: JSON.stringify({ 'Set': '12 pieces', 'Firing': '1200°C triple-fired', 'Care': 'Dishwasher safe' }),
      origin: 'Kyoto Ceramics Studio', capacity: '12-piece set'
    }
  ];

  for (const p of products) {
    dbRun(
      'INSERT INTO products (name, collection, category, material, description, price, currency, image_url, stock, featured, badge, specs, origin, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.name, p.collection, p.category, p.material, p.description, p.price, p.currency, p.image_url, p.stock, p.featured, p.badge, p.specs, p.origin, p.capacity]
    );
  }

  // Seed orders
  dbRun('INSERT INTO orders (customer_name, customer_email, status, total, created_at) VALUES (?, ?, ?, ?, ?)',
    ['A. Sterling', 'a.sterling@example.com', 'Fulfilled', 2400.00, '2024-03-15']);
  dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [1, 11, 1, 2400.00]);

  dbRun('INSERT INTO orders (customer_name, customer_email, status, total, created_at) VALUES (?, ?, ?, ?, ?)',
    ['E. Beaumont', 'e.beaumont@example.com', 'In Transit', 1850.00, '2024-03-18']);
  dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [2, 12, 1, 1850.00]);

  dbRun('INSERT INTO orders (customer_name, customer_email, status, total, created_at) VALUES (?, ?, ?, ?, ?)',
    ['S. Rothschild', 's.rothschild@example.com', 'Processing', 4100.00, '2024-03-20']);
  dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [3, 1, 12, 420.00]);

  dbRun('INSERT INTO orders (customer_name, customer_email, status, total, created_at) VALUES (?, ?, ?, ?, ?)',
    ['M. Kensington', 'm.kensington@example.com', 'Fulfilled', 960.00, '2024-03-10']);
  dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [4, 7, 2, 480.00]);

  dbRun('INSERT INTO orders (customer_name, customer_email, status, total, created_at) VALUES (?, ?, ?, ?, ?)',
    ['L. Harrington', 'l.harrington@example.com', 'Fulfilled', 1450.00, '2024-03-05']);
  dbRun('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [5, 5, 1, 560.00]);

  // Seed subscribers
  dbRun('INSERT INTO subscribers (email) VALUES (?)', ['collector@luxe.com']);
  dbRun('INSERT INTO subscribers (email) VALUES (?)', ['design@studio.net']);
  dbRun('INSERT INTO subscribers (email) VALUES (?)', ['art.buyer@gallery.com']);

  saveDb();
  console.log('Database seeded successfully!');
}

module.exports = { getDb, initializeDatabase, dbRun, dbGet, dbAll, saveDb };
