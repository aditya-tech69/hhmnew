// HHM Innovation - Shared Application Logic
const API_BASE = '';

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderLeftColor = '#ba1a1a';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== API HELPERS ====================
async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`, { credentials: 'include' });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiPut(url, data) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiDelete(url) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

// ==================== CART ====================
let cartData = { items: [], total: 0, count: 0 };

async function loadCart() {
  try {
    cartData = await apiGet('/api/cart');
    updateCartBadge();
  } catch (err) {
    console.error('Failed to load cart:', err);
  }
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach(badge => {
    badge.textContent = cartData.count;
    badge.style.display = cartData.count > 0 ? 'flex' : 'none';
  });
}

async function addToCart(productId, quantity = 1) {
  try {
    cartData = await apiPost('/api/cart', { productId, quantity });
    updateCartBadge();
    showToast('Added to your bag');
    renderCartPanel();
    openCart();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCartItem(cartItemId, quantity) {
  try {
    cartData = await apiPut(`/api/cart/${cartItemId}`, { quantity });
    updateCartBadge();
    renderCartPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeCartItem(cartItemId) {
  try {
    cartData = await apiDelete(`/api/cart/${cartItemId}`);
    updateCartBadge();
    renderCartPanel();
    showToast('Item removed');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function formatPrice(price, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);
}

function openCart() {
  document.querySelector('.cart-overlay')?.classList.add('active');
  document.querySelector('.cart-panel')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.querySelector('.cart-overlay')?.classList.remove('active');
  document.querySelector('.cart-panel')?.classList.remove('active');
  document.body.style.overflow = '';
}

function renderCartPanel() {
  const cartContent = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const cartEmpty = document.getElementById('cart-empty');
  const cartFooter = document.getElementById('cart-footer');
  
  if (!cartContent) return;

  if (cartData.items.length === 0) {
    cartContent.innerHTML = '';
    if (cartEmpty) cartEmpty.style.display = 'flex';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (cartEmpty) cartEmpty.style.display = 'none';
  if (cartFooter) cartFooter.style.display = 'block';

  cartContent.innerHTML = cartData.items.map(item => `
    <div class="flex gap-4 py-6 border-b border-stone-200/20">
      <div class="w-20 h-24 bg-surface-container-low overflow-hidden flex-shrink-0">
        <img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] font-label uppercase tracking-widest text-stone-400 mb-1">${item.collection}</p>
        <h4 class="font-headline text-sm truncate">${item.name}</h4>
        <p class="text-secondary text-sm mt-1">${formatPrice(item.price, item.currency)}</p>
        <div class="flex items-center gap-3 mt-3">
          <button onclick="updateCartItem(${item.id}, ${item.quantity - 1})" class="w-7 h-7 border border-stone-300 flex items-center justify-center text-xs hover:bg-stone-100 transition-colors">−</button>
          <span class="text-sm font-medium w-6 text-center">${item.quantity}</span>
          <button onclick="updateCartItem(${item.id}, ${item.quantity + 1})" class="w-7 h-7 border border-stone-300 flex items-center justify-center text-xs hover:bg-stone-100 transition-colors">+</button>
          <button onclick="removeCartItem(${item.id})" class="ml-auto text-stone-400 hover:text-error transition-colors">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  if (cartTotal) cartTotal.textContent = formatPrice(cartData.total);
}

// ==================== CHECKOUT ====================
function openCheckout() {
  document.querySelector('.modal-backdrop')?.classList.add('active');
  document.querySelector('.modal-content')?.classList.add('active');
}

function closeCheckout() {
  document.querySelector('.modal-backdrop')?.classList.remove('active');
  document.querySelector('.modal-content')?.classList.remove('active');
}

async function processCheckout(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const origText = btn.textContent;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    const data = {
      customerName: form.customerName.value,
      customerEmail: form.customerEmail.value,
      customerPhone: form.customerPhone.value,
      shippingAddress: form.shippingAddress.value
    };
    const result = await apiPost('/api/checkout', data);
    showToast(result.message);
    closeCheckout();
    closeCart();
    cartData = { items: [], total: 0, count: 0 };
    updateCartBadge();
    renderCartPanel();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// ==================== INIT SHARED COMPONENTS ====================
function initSharedComponents() {
  // Cart overlay & panel
  const cartHTML = `
    <div class="cart-overlay" onclick="closeCart()"></div>
    <div class="cart-panel">
      <div class="flex items-center justify-between p-6 border-b border-stone-200/20">
        <h3 class="font-headline text-xl">Your Bag</h3>
        <button onclick="closeCart()" class="text-stone-500 hover:text-stone-800 transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div id="cart-items" class="flex-1 overflow-y-auto px-6 custom-scrollbar"></div>
      <div id="cart-empty" class="flex-1 flex flex-col items-center justify-center px-6 text-center" style="display:flex;">
        <span class="material-symbols-outlined text-5xl text-stone-300 mb-4">shopping_bag</span>
        <p class="font-headline text-xl text-stone-400 mb-2">Your bag is empty</p>
        <p class="text-sm text-stone-400">Discover our curated collections</p>
      </div>
      <div id="cart-footer" class="p-6 border-t border-stone-200/20" style="display:none;">
        <div class="flex justify-between items-center mb-4">
          <span class="font-label text-xs uppercase tracking-widest text-stone-500">Subtotal</span>
          <span id="cart-total" class="font-headline text-xl text-secondary">$0.00</span>
        </div>
        <p class="text-[10px] text-stone-400 tracking-widest uppercase mb-4 text-center">Complimentary white-glove shipping</p>
        <button onclick="openCheckout()" class="w-full bg-primary text-on-primary py-4 font-label tracking-widest uppercase text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
          Proceed to Checkout
          <span class="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

  // Checkout modal
  const checkoutHTML = `
    <div class="modal-backdrop" onclick="closeCheckout()"></div>
    <div class="modal-content bg-surface-container-lowest p-8 md:p-12 w-full max-w-lg shadow-2xl">
      <div class="flex justify-between items-start mb-8">
        <div>
          <h2 class="font-headline text-3xl">Checkout</h2>
          <p class="text-sm text-stone-500 mt-1">Complete your acquisition</p>
        </div>
        <button onclick="closeCheckout()" class="text-stone-400 hover:text-stone-800 transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form onsubmit="processCheckout(event)" class="checkout-form space-y-4">
        <div>
          <label class="text-[10px] font-label uppercase tracking-widest text-stone-500 mb-2 block">Full Name</label>
          <input name="customerName" required placeholder="Enter your full name" />
        </div>
        <div>
          <label class="text-[10px] font-label uppercase tracking-widest text-stone-500 mb-2 block">Email Address</label>
          <input name="customerEmail" type="email" required placeholder="Enter your email" />
        </div>
        <div>
          <label class="text-[10px] font-label uppercase tracking-widest text-stone-500 mb-2 block">Phone Number</label>
          <input name="customerPhone" type="tel" required placeholder="Enter your phone number" />
        </div>
        <div>
          <label class="text-[10px] font-label uppercase tracking-widest text-stone-500 mb-2 block">Shipping Address</label>
          <textarea name="shippingAddress" rows="3" placeholder="Enter your shipping address"></textarea>
        </div>
        <button type="submit" class="w-full bg-primary text-on-primary py-4 font-label tracking-widest uppercase text-sm hover:opacity-90 transition-all mt-6">
          Place Order
        </button>
      </form>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', cartHTML);
  document.body.insertAdjacentHTML('beforeend', checkoutHTML);

  // Bind cart buttons
  document.querySelectorAll('.cart-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  });

  // Load cart
  loadCart();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', initSharedComponents);
