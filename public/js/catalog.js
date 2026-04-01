// Product Catalog Page
document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.getElementById('product-grid');
  const searchInput = document.getElementById('search-input');
  const categoryFilters = document.querySelectorAll('.category-filter');
  const materialFilters = document.querySelectorAll('.material-filter');
  const priceRange = document.getElementById('price-range');
  const priceDisplay = document.getElementById('price-display');
  const sortSelect = document.getElementById('sort-select');
  const resultCount = document.getElementById('result-count');

  let currentFilters = {
    category: '',
    materials: [],
    search: '',
    maxPrice: 2500,
    sort: ''
  };

  async function loadProducts() {
    const params = new URLSearchParams();
    if (currentFilters.category) params.append('category', currentFilters.category);
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.maxPrice < 2500) params.append('maxPrice', currentFilters.maxPrice);
    if (currentFilters.sort) params.append('sort', currentFilters.sort);
    // Material filter - we'll filter client-side for multiple
    if (currentFilters.materials.length === 1) {
      params.append('material', currentFilters.materials[0]);
    }

    // Show skeletons
    productGrid.innerHTML = Array(6).fill(`
      <div class="group">
        <div class="relative aspect-[4/5] skeleton rounded-sm"></div>
        <div class="mt-8 flex justify-between">
          <div class="flex-1">
            <div class="skeleton h-3 w-24 rounded mb-3"></div>
            <div class="skeleton h-5 w-40 rounded mb-2"></div>
            <div class="skeleton h-3 w-32 rounded"></div>
          </div>
          <div class="skeleton h-5 w-12 rounded"></div>
        </div>
      </div>
    `).join('');

    try {
      const data = await apiGet(`/api/products?${params.toString()}`);
      let products = data.products;

      // Client-side material filtering for multiple
      if (currentFilters.materials.length > 1) {
        products = products.filter(p => 
          currentFilters.materials.some(m => p.material.toLowerCase().includes(m.toLowerCase()))
        );
      }

      if (resultCount) {
        resultCount.textContent = `${products.length} piece${products.length !== 1 ? 's' : ''}`;
      }

      if (products.length === 0) {
        productGrid.innerHTML = `
          <div class="col-span-full text-center py-24">
            <span class="material-symbols-outlined text-5xl text-stone-300 mb-4 block">search_off</span>
            <h3 class="font-headline text-2xl text-stone-400 mb-2">No pieces found</h3>
            <p class="text-stone-400 text-sm">Try adjusting your filters</p>
          </div>
        `;
        return;
      }

      productGrid.innerHTML = products.map((product, i) => `
        <div class="group cursor-pointer ${i % 3 === 1 ? 'md:mt-16' : ''}" onclick="window.location.href='/product/${product.id}'">
          <div class="relative aspect-[4/5] bg-surface-container overflow-hidden transition-all duration-500 group-hover:scale-[1.02]">
            <img alt="${product.name}" class="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" src="${product.image_url}" />
            <div class="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/5 transition-colors duration-500"></div>
            ${product.badge ? `<div class="absolute top-6 left-6"><span class="bg-secondary text-on-secondary text-[10px] font-bold px-3 py-1 uppercase tracking-widest">${product.badge}</span></div>` : ''}
            <div class="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onclick="event.stopPropagation(); addToCart(${product.id})" class="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg">
                <span class="material-symbols-outlined text-stone-700 text-xl">shopping_bag</span>
              </button>
            </div>
          </div>
          <div class="mt-8 flex justify-between items-start">
            <div>
              <p class="text-[10px] font-label font-bold uppercase tracking-widest text-stone-400 mb-2">${product.collection}</p>
              <h3 class="text-xl font-serif text-stone-900">${product.name}</h3>
              <p class="text-sm text-stone-500 mt-1">${product.material}</p>
            </div>
            <span class="text-secondary font-serif text-lg">${formatPrice(product.price, product.currency)}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load products:', err);
      productGrid.innerHTML = `
        <div class="col-span-full text-center py-24">
          <span class="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <h3 class="font-headline text-2xl text-stone-400 mb-2">Failed to load products</h3>
          <button onclick="loadProducts()" class="text-secondary underline text-sm">Try again</button>
        </div>
      `;
    }
  }

  // Search with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        loadProducts();
      }, 300);
    });
  }

  // Category filters
  categoryFilters.forEach(filter => {
    filter.addEventListener('click', (e) => {
      e.preventDefault();
      categoryFilters.forEach(f => {
        f.classList.remove('bg-stone-200/50', 'text-stone-900', 'font-semibold');
        f.classList.add('text-stone-500');
      });
      filter.classList.add('bg-stone-200/50', 'text-stone-900', 'font-semibold');
      filter.classList.remove('text-stone-500');
      currentFilters.category = filter.dataset.category || '';
      loadProducts();
    });
  });

  // Material filters
  materialFilters.forEach(filter => {
    filter.addEventListener('change', () => {
      currentFilters.materials = Array.from(document.querySelectorAll('.material-filter:checked')).map(c => c.value);
      loadProducts();
    });
  });

  // Price range
  if (priceRange) {
    priceRange.addEventListener('input', (e) => {
      currentFilters.maxPrice = parseInt(e.target.value);
      if (priceDisplay) priceDisplay.textContent = `₹${currentFilters.maxPrice.toLocaleString('en-IN')}+`;
    });
    priceRange.addEventListener('change', () => loadProducts());
  }

  // Sort
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value;
      loadProducts();
    });
  }

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('category')) {
    currentFilters.category = urlParams.get('category');
    categoryFilters.forEach(f => {
      if (f.dataset.category === currentFilters.category) {
        f.classList.add('bg-stone-200/50', 'text-stone-900', 'font-semibold');
        f.classList.remove('text-stone-500');
      }
    });
  }
  if (urlParams.get('search')) {
    currentFilters.search = urlParams.get('search');
    if (searchInput) searchInput.value = currentFilters.search;
  }

  loadProducts();
});
