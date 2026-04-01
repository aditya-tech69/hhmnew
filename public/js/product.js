// Product Details Page
document.addEventListener('DOMContentLoaded', async () => {
  const productId = window.location.pathname.split('/').pop();
  const productHero = document.getElementById('product-hero');
  const relatedGrid = document.getElementById('related-grid');

  if (!productId || isNaN(productId)) {
    window.location.href = '/catalog';
    return;
  }

  // Show loading
  productHero.innerHTML = `
    <div class="w-full md:w-3/5 relative flex justify-center items-center">
      <div class="skeleton w-full aspect-square md:aspect-[4/5] rounded-xl"></div>
    </div>
    <div class="w-full md:w-2/5 flex flex-col space-y-6">
      <div class="skeleton h-3 w-32 rounded"></div>
      <div class="skeleton h-12 w-full rounded"></div>
      <div class="skeleton h-6 w-24 rounded"></div>
      <div class="skeleton h-24 w-full rounded"></div>
      <div class="skeleton h-40 w-full rounded"></div>
      <div class="skeleton h-14 w-full rounded"></div>
    </div>
  `;

  try {
    const data = await apiGet(`/api/products/${productId}`);
    const product = data.product;
    const related = data.related;

    // Update page title
    document.title = `${product.name} | HHM Innovation`;

    // Parse specs
    let specs = product.specs;
    if (typeof specs === 'string') {
      try { specs = JSON.parse(specs); } catch(e) { specs = {}; }
    }

    // Render product hero
    productHero.innerHTML = `
      <!-- Background Decoration -->
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl -z-10"></div>
      <div class="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl -z-10"></div>
      <!-- Left: Product Image -->
      <div class="w-full md:w-3/5 relative flex justify-center items-center">
        <div class="glass-card specular-highlight w-full aspect-square md:aspect-[4/5] rounded-xl flex items-center justify-center p-8 shadow-[0_40px_60px_-5px_rgba(26,28,27,0.04)]">
          <img class="max-h-full max-w-full object-contain custom-transition hover:scale-105 drop-shadow-2xl" src="${product.image_url}" alt="${product.name}" />
        </div>
      </div>
      <!-- Right: Product Details -->
      <div class="w-full md:w-2/5 flex flex-col space-y-8">
        <nav class="flex gap-2 text-[10px] tracking-widest uppercase text-outline font-label">
          <a href="/catalog" class="hover:text-secondary transition-colors">Collections</a>
          <span>/</span>
          <a href="/catalog?category=${encodeURIComponent(product.category)}" class="hover:text-secondary transition-colors">${product.category}</a>
          <span>/</span>
          <span>${product.collection}</span>
        </nav>
        <header>
          <h1 class="font-headline text-5xl md:text-7xl text-on-surface tracking-tighter leading-tight mb-4">${product.name}</h1>
          <p class="text-secondary font-medium tracking-wide text-lg">${formatPrice(product.price, product.currency)}</p>
          ${product.badge ? `<span class="inline-block mt-3 bg-secondary text-on-secondary text-[10px] font-bold px-3 py-1 uppercase tracking-widest">${product.badge}</span>` : ''}
        </header>
        <div class="space-y-4">
          <p class="text-on-surface-variant font-body leading-relaxed text-lg">${product.description}</p>
        </div>
        <div class="bg-surface-container-low p-6 rounded-sm space-y-4">
          <div class="flex justify-between items-center border-b border-outline-variant/20 pb-3">
            <span class="text-[10px] font-label uppercase tracking-widest text-outline">Material</span>
            <span class="text-sm font-medium">${product.material}</span>
          </div>
          ${product.capacity ? `
          <div class="flex justify-between items-center border-b border-outline-variant/20 pb-3">
            <span class="text-[10px] font-label uppercase tracking-widest text-outline">Capacity</span>
            <span class="text-sm font-medium">${product.capacity}</span>
          </div>` : ''}
          <div class="flex justify-between items-center border-b border-outline-variant/20 pb-3">
            <span class="text-[10px] font-label uppercase tracking-widest text-outline">Origin</span>
            <span class="text-sm font-medium">${product.origin}</span>
          </div>
          <div class="flex justify-between items-center pb-1">
            <span class="text-[10px] font-label uppercase tracking-widest text-outline">Availability</span>
            <span class="text-sm font-medium ${product.stock > 0 ? 'text-emerald-600' : 'text-error'}">${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</span>
          </div>
        </div>
        <div class="pt-2">
          <div class="flex items-center gap-4 mb-4">
            <label class="text-[10px] font-label uppercase tracking-widest text-outline">Quantity</label>
            <div class="flex items-center border border-stone-300">
              <button onclick="changeQty(-1)" class="w-10 h-10 flex items-center justify-center hover:bg-stone-100 transition-colors text-lg">−</button>
              <input id="qty-input" type="number" value="1" min="1" max="${product.stock}" class="w-12 h-10 text-center border-x border-stone-300 text-sm font-medium outline-none bg-transparent" />
              <button onclick="changeQty(1)" class="w-10 h-10 flex items-center justify-center hover:bg-stone-100 transition-colors text-lg">+</button>
            </div>
          </div>
          <button onclick="addToCart(${product.id}, getQty())" ${product.stock < 1 ? 'disabled' : ''} class="w-full bg-primary text-on-primary py-5 rounded-sm font-label tracking-widest uppercase text-sm hover:opacity-90 transition-all flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
            ${product.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
            <span class="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
          <p class="text-center mt-4 text-[10px] text-outline tracking-widest uppercase">Complimentary white-glove shipping on all orders</p>
        </div>
      </div>
    `;

    // Render specs section
    const specsSection = document.getElementById('specs-section');
    if (specsSection && specs && Object.keys(specs).length > 0) {
      const specIcons = { 'Light Refraction': 'flare', 'Thermal Resistance': 'science', 'Artisan Blown': 'handyman', 'Kiln Temperature': 'local_fire_department', 'Finish': 'palette', 'Care': 'water_drop', 'Composition': 'science', 'Sizes': 'straighten', 'Rim Detail': 'diamond', 'Style': 'architecture', 'Color': 'palette', 'Details': 'auto_awesome', 'Uniqueness': 'fingerprint', 'Material': 'layers', 'Diameter': 'circle', 'Design': 'draw', 'Aeration': 'air', 'Set Contents': 'inventory_2', 'Packaging': 'inventory', 'Crystal': 'diamond', 'Base': 'square', 'Set': 'grid_view' };
      
      specsSection.innerHTML = Object.entries(specs).map(([key, val]) => `
        <div class="space-y-4">
          <span class="material-symbols-outlined text-secondary text-3xl">${specIcons[key] || 'info'}</span>
          <h3 class="font-headline text-xl">${key}</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">${val}</p>
        </div>
      `).join('');
    }

    // Render related products
    if (relatedGrid && related.length > 0) {
      document.getElementById('related-section').style.display = 'block';
      relatedGrid.innerHTML = related.map(p => `
        <div class="group cursor-pointer" onclick="window.location.href='/product/${p.id}'">
          <div class="aspect-[3/4] bg-surface-container-low flex items-center justify-center p-12 transition-transform duration-500 group-hover:-translate-y-2">
            <img class="max-h-full object-contain" src="${p.image_url}" alt="${p.name}" />
          </div>
          <div class="mt-6 flex justify-between items-start">
            <div>
              <h4 class="font-headline text-lg group-hover:text-secondary transition-colors">${p.name}</h4>
              <p class="text-outline text-xs uppercase tracking-widest mt-1">${p.category}</p>
            </div>
            <p class="text-sm font-medium">${formatPrice(p.price, p.currency)}</p>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load product:', err);
    productHero.innerHTML = `
      <div class="text-center py-24 w-full">
        <span class="material-symbols-outlined text-5xl text-stone-300 mb-4 block">error</span>
        <h3 class="font-headline text-2xl text-stone-400 mb-2">Product not found</h3>
        <a href="/catalog" class="text-secondary underline text-sm">Browse catalog</a>
      </div>
    `;
  }
});

function getQty() {
  return parseInt(document.getElementById('qty-input')?.value || 1);
}

function changeQty(delta) {
  const input = document.getElementById('qty-input');
  if (!input) return;
  const newVal = parseInt(input.value) + delta;
  const max = parseInt(input.max) || 99;
  if (newVal >= 1 && newVal <= max) input.value = newVal;
}
