// Admin Panel
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
});

async function checkAdminAuth() {
  try {
    const data = await apiGet('/api/admin/me');
    document.getElementById('admin-name').textContent = data.admin.name;
    document.getElementById('admin-role').textContent = data.admin.role;
    loadDashboard();
    loadInventory();
    loadOrders();
  } catch (err) {
    window.location.href = '/login';
  }
}

async function adminLogout() {
  try {
    await apiPost('/api/admin/logout', {});
    window.location.href = '/login';
  } catch (err) {
    showToast('Logout failed', 'error');
  }
}

// ==================== NAVIGATION ====================
let currentSection = 'dashboard';

function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${section}`).style.display = 'block';
  
  // Update nav
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.classList.remove('bg-stone-200/50', 'text-stone-900', 'font-semibold');
    link.classList.add('text-stone-500');
    const icon = link.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = "'FILL' 0";
  });
  const activeLink = document.querySelector(`[data-section="${section}"]`);
  if (activeLink) {
    activeLink.classList.add('bg-stone-200/50', 'text-stone-900', 'font-semibold');
    activeLink.classList.remove('text-stone-500');
    const icon = activeLink.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = "'FILL' 1";
  }

  // Update header
  const titles = { dashboard: 'Vitreous Overview', inventory: 'Inventory Management', orders: 'Order Registry', settings: 'Settings' };
  const descs = { dashboard: 'Refining the landscape of luxury glassware management.', inventory: 'Manage your curated collection of luxury pieces.', orders: 'Track and manage client acquisitions.', settings: 'Configure your luxury control panel.' };
  document.getElementById('section-title').textContent = titles[section] || section;
  document.getElementById('section-desc').textContent = descs[section] || '';
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
  try {
    const data = await apiGet('/api/admin/dashboard');
    const m = data.metrics;

    document.getElementById('metric-revenue').textContent = `₹${m.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-orders').textContent = m.activeOrders;
    document.getElementById('metric-processing').textContent = `${m.processingOrders} AWAITING FULFILLMENT`;
    document.getElementById('metric-inventory').textContent = `${m.totalInventory.toLocaleString()}`;
    document.getElementById('metric-integrity').textContent = `${m.stockIntegrity}% STOCK INTEGRITY`;

    // Inventory bars
    const categories = { 'Glassware': 'inv-glass', 'Ceramics': 'inv-ceramic', 'Accessories': 'inv-accessories', 'Bespeak': 'inv-bespeak' };
    const maxStock = Math.max(...data.inventoryByCategory.map(c => c.stock), 1);
    data.inventoryByCategory.forEach(cat => {
      const barId = categories[cat.category];
      if (barId) {
        const pct = Math.round((cat.stock / maxStock) * 100);
        const bar = document.getElementById(barId);
        if (bar) {
          bar.style.width = `${pct}%`;
          bar.parentElement.previousElementSibling.querySelector('.inv-pct').textContent = `${pct}%`;
        }
      }
    });

    // Recent orders table
    const ordersTable = document.getElementById('recent-orders-body');
    if (ordersTable) {
      ordersTable.innerHTML = data.recentOrders.slice(0, 5).map(order => {
        const statusColors = {
          'Fulfilled': 'bg-emerald-50 text-emerald-700',
          'In Transit': 'bg-amber-50 text-amber-700',
          'Processing': 'bg-stone-100 text-stone-600',
          'Cancelled': 'bg-red-50 text-red-700'
        };
        const firstProduct = order.product_names?.split(',')[0] || 'Unknown';
        return `
          <tr class="group hover:bg-surface-container-low transition-colors">
            <td class="py-4">
              <span class="font-body font-medium text-sm">${firstProduct.trim()}</span>
            </td>
            <td class="py-4 text-sm text-on-surface-variant">${order.customer_name}</td>
            <td class="py-4">
              <span class="inline-block px-2 py-1 text-[9px] font-label tracking-widest uppercase ${statusColors[order.status] || 'bg-stone-100 text-stone-600'}">${order.status}</span>
            </td>
            <td class="py-4 text-sm font-semibold text-right">₹${order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Dashboard load failed:', err);
    showToast('Failed to load dashboard', 'error');
  }
}

// ==================== INVENTORY ====================
let allProducts = [];

async function loadInventory() {
  try {
    const data = await apiGet('/api/products?limit=100');
    allProducts = data.products;
    renderInventoryTable();
  } catch (err) {
    showToast('Failed to load inventory', 'error');
  }
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-body');
  if (!tbody) return;

  tbody.innerHTML = allProducts.map(p => `
    <tr class="group hover:bg-surface-container-low transition-colors border-b border-outline-variant/10">
      <td class="py-4">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-primary-container/30 overflow-hidden flex items-center justify-center rounded-sm">
            <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover" />
          </div>
          <div class="ml-3">
            <span class="font-body font-medium text-sm block">${p.name}</span>
            <span class="text-[10px] text-stone-400">${p.collection}</span>
          </div>
        </div>
      </td>
      <td class="py-4 text-sm text-on-surface-variant">${p.category}</td>
      <td class="py-4 text-sm text-on-surface-variant">${p.material}</td>
      <td class="py-4 text-sm font-medium">${formatPrice(p.price, p.currency)}</td>
      <td class="py-4">
        <span class="text-sm font-medium ${p.stock < 5 ? 'text-error' : p.stock < 15 ? 'text-amber-600' : 'text-emerald-600'}">${p.stock}</span>
      </td>
      <td class="py-4 text-right">
        <button onclick='openEditProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-stone-400 hover:text-secondary transition-colors mr-2">
          <span class="material-symbols-outlined text-lg">edit</span>
        </button>
        <button onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="text-stone-400 hover:text-error transition-colors">
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ==================== PRODUCT FORM ====================
let editingProductId = null;

function openNewProduct() {
  editingProductId = null;
  document.getElementById('product-form-title').textContent = 'New Acquisition';
  document.getElementById('product-form').reset();
  document.getElementById('product-modal-backdrop').classList.add('active');
  document.getElementById('product-modal').classList.add('active');
}

function openEditProduct(product) {
  editingProductId = product.id;
  document.getElementById('product-form-title').textContent = 'Edit Product';
  const form = document.getElementById('product-form');
  form.pName.value = product.name;
  form.pCollection.value = product.collection;
  form.pCategory.value = product.category;
  form.pMaterial.value = product.material;
  form.pDescription.value = product.description;
  form.pPrice.value = product.price;
  form.pCurrency.value = product.currency || 'USD';
  form.pImageUrl.value = product.image_url;
  form.pStock.value = product.stock;
  form.pOrigin.value = product.origin || '';
  form.pCapacity.value = product.capacity || '';
  form.pBadge.value = product.badge || '';
  form.pFeatured.checked = product.featured === 1;
  document.getElementById('product-modal-backdrop').classList.add('active');
  document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal-backdrop').classList.remove('active');
  document.getElementById('product-modal').classList.remove('active');
}

async function saveProduct(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const origText = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;

  const data = {
    name: form.pName.value,
    collection: form.pCollection.value,
    category: form.pCategory.value,
    material: form.pMaterial.value,
    description: form.pDescription.value,
    price: parseFloat(form.pPrice.value),
    currency: form.pCurrency.value,
    image_url: form.pImageUrl.value,
    stock: parseInt(form.pStock.value),
    origin: form.pOrigin.value,
    capacity: form.pCapacity.value,
    badge: form.pBadge.value || null,
    featured: form.pFeatured.checked
  };

  try {
    if (editingProductId) {
      await apiPut(`/api/admin/products/${editingProductId}`, data);
      showToast('Product updated');
    } else {
      await apiPost('/api/admin/products', data);
      showToast('Product created');
    }
    closeProductModal();
    loadInventory();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
  try {
    await apiDelete(`/api/admin/products/${id}`);
    showToast('Product deleted');
    loadInventory();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== ORDERS ====================
let allOrders = [];

async function loadOrders() {
  try {
    allOrders = await apiGet('/api/admin/orders');
    renderOrdersTable();
  } catch (err) {
    showToast('Failed to load orders', 'error');
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;

  const statusColors = {
    'Fulfilled': 'bg-emerald-50 text-emerald-700',
    'In Transit': 'bg-amber-50 text-amber-700',
    'Processing': 'bg-stone-100 text-stone-600',
    'Cancelled': 'bg-red-50 text-red-700'
  };

  tbody.innerHTML = allOrders.map(order => `
    <tr class="group hover:bg-surface-container-low transition-colors border-b border-outline-variant/10">
      <td class="py-4 text-sm font-medium">#${String(order.id).padStart(4, '0')}</td>
      <td class="py-4 text-sm">${order.customer_name}</td>
      <td class="py-4 text-sm text-on-surface-variant">${order.customer_email}</td>
      <td class="py-4 text-sm text-on-surface-variant">${order.customer_phone || '-'}</td>
      <td class="py-4 text-sm text-on-surface-variant max-w-[150px] truncate" title="${order.shipping_address || '-'}">${order.shipping_address || '-'}</td>
      <td class="py-4 text-sm text-on-surface-variant">${order.product_names || '-'}</td>
      <td class="py-4">
        <select onchange="updateOrderStatus(${order.id}, this.value)" class="text-[10px] font-label tracking-widest uppercase px-2 py-1 border-0 bg-transparent cursor-pointer ${statusColors[order.status] || ''}">
          <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="In Transit" ${order.status === 'In Transit' ? 'selected' : ''}>In Transit</option>
          <option value="Fulfilled" ${order.status === 'Fulfilled' ? 'selected' : ''}>Fulfilled</option>
          <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td class="py-4 text-sm font-semibold text-right">₹${order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td class="py-4 text-sm text-right text-on-surface-variant">${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function updateOrderStatus(orderId, status) {
  try {
    await apiPut(`/api/admin/orders/${orderId}`, { status });
    showToast(`Order #${String(orderId).padStart(4, '0')} updated to ${status}`);
    loadDashboard();
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
