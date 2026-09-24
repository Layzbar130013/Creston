/**
 * CRESTON PREMIUM COLLECTIONS - Client Application
 * Motto: Quality, Style, Trust
 */

// Application State
const state = {
  storeSettings: null,
  paymentSettings: null,
  categories: [],
  products: [],
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'newest',
  cart: JSON.parse(localStorage.getItem('creston_cart') || '[]'),
  currentUser: JSON.parse(localStorage.getItem('creston_user') || 'null'),
  token: localStorage.getItem('creston_token') || '',
  activeProductModal: null,
  currentOrder: null
};

// Kenyan Counties List
const KENYAN_COUNTIES = [
  "Nairobi", "Mombasa", "Kiambu", "Machakos", "Kajiado", "Nakuru", "Kisumu", "Uasin Gishu (Eldoret)",
  "Kilifi", "Kwale", "Taita Taveta", "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru",
  "Tharaka-Nithi", "Embu", "Kitui", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga", "Murang'a",
  "Turkana", "West Pokot", "Samburu", "Trans Nzoia", "Elgeyo-Marakwet", "Nandi", "Baringo",
  "Laikipia", "Narok", "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya",
  "Homa Bay", "Migori", "Kisii", "Nyamira", "Tana River", "Lamu"
];

// Utility: Format currency in KSh
function formatKSh(amount) {
  return 'KSh ' + Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Utility: Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(endpoint, config);
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, error: 'Network communication failure. Please check connection.' };
  }
}

// Initialize Application
async function initApp() {
  renderCountyDropdown();
  await loadStoreSettings();
  await loadPaymentSettings();
  await loadCategories();
  await loadProducts();
  updateCartUI();
  updateAuthUI();
  setupEventListeners();
}

// Load Store Branding & Settings
async function loadStoreSettings() {
  const res = await apiCall('/api/store/settings');
  if (res.success && res.settings) {
    state.storeSettings = res.settings;
    renderStoreBranding();
  }
}

function renderStoreBranding() {
  const s = state.storeSettings;
  if (!s) return;

  // Title and motto
  document.querySelectorAll('.store-name-text').forEach(el => el.textContent = s.store_name);
  document.querySelectorAll('.store-motto-text').forEach(el => el.textContent = s.motto);
  document.querySelectorAll('.store-logo-img').forEach(el => {
    el.src = s.logo_url;
    el.alt = s.store_name;
  });

  // Top banner
  const bannerEl = document.getElementById('announcement-banner-text');
  if (bannerEl && s.banner_text) bannerEl.textContent = s.banner_text;

  // About modal & footer
  const aboutTitle = document.getElementById('about-modal-title');
  if (aboutTitle) aboutTitle.textContent = s.about_title;
  const aboutBody = document.getElementById('about-modal-text');
  if (aboutBody) aboutBody.textContent = s.about_text;
  const aboutAddress = document.getElementById('about-modal-address');
  if (aboutAddress) aboutAddress.textContent = s.physical_address;
  const aboutPhone = document.getElementById('about-modal-phone');
  if (aboutPhone) aboutPhone.textContent = s.phone_number;
  const aboutEmail = document.getElementById('about-modal-email');
  if (aboutEmail) aboutEmail.textContent = s.email_address;
  const aboutHours = document.getElementById('about-modal-hours');
  if (aboutHours) aboutHours.textContent = s.opening_hours;

  // Footer address
  const footerAddress = document.getElementById('footer-address');
  if (footerAddress) footerAddress.textContent = s.physical_address;
  const footerPhone = document.getElementById('footer-phone');
  if (footerPhone) footerPhone.textContent = s.phone_number;
}

// Load Payment Settings (Till & Paybill)
async function loadPaymentSettings() {
  const res = await apiCall('/api/payment-settings');
  if (res.success && res.payment_settings) {
    state.paymentSettings = res.payment_settings;
    renderPaymentOptions();
  }
}

function renderPaymentOptions() {
  const ps = state.paymentSettings;
  if (!ps) return;
  const tillDisplay = document.getElementById('checkout-till-display');
  if (tillDisplay) tillDisplay.textContent = ps.till_number;
  const tillNameDisplay = document.getElementById('checkout-till-name');
  if (tillNameDisplay) tillNameDisplay.textContent = ps.till_name;
  const paybillDisplay = document.getElementById('checkout-paybill-display');
  if (paybillDisplay) paybillDisplay.textContent = ps.paybill_number;
  const paybillAccDisplay = document.getElementById('checkout-paybill-acc');
  if (paybillAccDisplay) paybillAccDisplay.textContent = ps.paybill_account;
  const instructionsDisplay = document.getElementById('checkout-instructions-display');
  if (instructionsDisplay) instructionsDisplay.textContent = ps.instructions;
}

// Load Categories
async function loadCategories() {
  const res = await apiCall('/api/categories');
  if (res.success && res.categories) {
    state.categories = res.categories;
    renderCategoryPills();
  }
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;
  
  let html = `
    <button class="cat-pill ${state.activeCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
      ✨ All Collections
    </button>
  `;

  state.categories.forEach(cat => {
    const isActive = state.activeCategory === cat.slug;
    html += `
      <button class="cat-pill ${isActive ? 'active' : ''}" onclick="selectCategory('${cat.slug}')">
        <span>${cat.icon}</span> ${cat.name}
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(slug) {
  state.activeCategory = slug;
  renderCategoryPills();
  loadProducts();
}

// Load Products
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state"><p>Loading Creston Collections...</p></div>';

  let url = `/api/products?sort=${state.sortBy}`;
  if (state.activeCategory && state.activeCategory !== 'all') {
    url += `&category=${state.activeCategory}`;
  }
  if (state.searchQuery) {
    url += `&q=${encodeURIComponent(state.searchQuery)}`;
  }

  const res = await apiCall(url);
  if (res.success && res.products) {
    state.products = res.products;
    renderProducts();
  } else {
    grid.innerHTML = '<div class="empty-state"><h3>No items found</h3><p>Try clearing your search filters.</p></div>';
  }
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  if (state.products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No matching garments found</h3>
        <p>Check back soon or browse our other executive and casual collections.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.products.map(p => {
    const isSale = p.original_price && p.original_price > p.price;
    const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 5;
    const isOutOfStock = p.stock_quantity <= 0;

    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-img-box" onclick="openProductModal(${p.id})">
          <img src="${p.image_url}" alt="${p.name}" class="product-img" loading="lazy">
          <div class="product-badges">
            <span class="badge badge-category">${p.category_name}</span>
            ${isSale ? '<span class="badge badge-sale">Sale</span>' : ''}
            ${isLowStock ? `<span class="badge badge-lowstock">Only ${p.stock_quantity} Left</span>` : ''}
            ${isOutOfStock ? '<span class="badge badge-sale">Sold Out</span>' : ''}
          </div>
        </div>
        <div class="product-info">
          <div class="product-category-label">${p.category_name}</div>
          <h3 class="product-title" onclick="openProductModal(${p.id})">${p.name}</h3>
          <div class="product-sizes-preview">Sizes: ${p.sizes || 'Standard'}</div>
          <div class="product-pricing">
            <span class="price-currency">KSh</span>
            <span class="price-current">${Number(p.price).toLocaleString()}</span>
            ${isSale ? `<span class="price-original">KSh ${Number(p.original_price).toLocaleString()}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-add-cart" onclick="quickAddToCart(${p.id})" ${isOutOfStock ? 'disabled style="opacity:0.5;"' : ''}>
              <span>🛍️</span> ${isOutOfStock ? 'Out of Stock' : 'Add to Bag'}
            </button>
            <button class="btn-quick-view" onclick="openProductModal(${p.id})" title="View Details">
              👁️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Product Quick View Modal
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  state.activeProductModal = product;

  const modal = document.getElementById('product-detail-modal');
  const body = document.getElementById('product-detail-modal-body');

  const sizes = (product.sizes || 'S, M, L, XL').split(',').map(s => s.trim()).filter(Boolean);
  const colors = (product.colors || 'Standard').split(',').map(c => c.trim()).filter(Boolean);

  body.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div style="border-radius: var(--radius-md); overflow: hidden; height: 380px;">
        <img src="${product.image_url}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div>
        <div class="product-category-label">${product.category_name}</div>
        <h2 style="font-family: var(--font-serif); font-size: 1.4rem; margin-bottom: 8px;">${product.name}</h2>
        <div class="product-pricing" style="margin-bottom: 16px;">
          <span class="price-currency">KSh</span>
          <span class="price-current">${Number(product.price).toLocaleString()}</span>
          ${product.original_price && product.original_price > product.price ? `<span class="price-original">KSh ${Number(product.original_price).toLocaleString()}</span>` : ''}
        </div>
        <p style="font-size: 0.88rem; color: #4B5563; margin-bottom: 16px; line-height: 1.5;">${product.description}</p>
        
        <div class="form-group">
          <label class="form-label">Select Tailored Size:</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="modal-size-selector">
            ${sizes.map((s, idx) => `
              <button type="button" class="cat-pill ${idx === 0 ? 'active' : ''}" onclick="selectModalSize(this, '${s}')">${s}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Select Color / Shade:</label>
          <select class="form-select" id="modal-color-select">
            ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div style="display: flex; gap: 12px; align-items: center; margin-top: 20px;">
          <div style="display: flex; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-sm);">
            <button class="qty-btn" onclick="adjustModalQty(-1)">-</button>
            <span class="qty-display" id="modal-qty-display" style="padding: 0 12px;">1</span>
            <button class="qty-btn" onclick="adjustModalQty(1)">+</button>
          </div>
          <button class="btn-add-cart" style="flex: 1; padding: 12px;" onclick="addModalProductToCart()">
            Add to Bag • <span id="modal-total-btn">${formatKSh(product.price)}</span>
          </button>
        </div>

        <div style="margin-top: 14px; font-size: 0.78rem; color: var(--mpesa); display: flex; align-items: center; gap: 6px;">
          <span>✓</span> Guaranteed Authentic • Lipa na M-Pesa Available
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

let modalQty = 1;
let modalSelectedSize = '';

function selectModalSize(btn, size) {
  document.querySelectorAll('#modal-size-selector .cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  modalSelectedSize = size;
}

function adjustModalQty(delta) {
  modalQty = Math.max(1, modalQty + delta);
  const display = document.getElementById('modal-qty-display');
  if (display) display.textContent = modalQty;
  if (state.activeProductModal) {
    const totalBtn = document.getElementById('modal-total-btn');
    if (totalBtn) totalBtn.textContent = formatKSh(state.activeProductModal.price * modalQty);
  }
}

function addModalProductToCart() {
  if (!state.activeProductModal) return;
  const p = state.activeProductModal;
  const colorSelect = document.getElementById('modal-color-select');
  const color = colorSelect ? colorSelect.value : '';
  const size = modalSelectedSize || (p.sizes ? p.sizes.split(',')[0].trim() : 'M');

  addToCart(p, modalQty, size, color);
  closeModals();
  toggleCartDrawer(true);
}

// Cart Logic
function quickAddToCart(productId) {
  const p = state.products.find(item => item.id === productId);
  if (!p) return;
  const defaultSize = p.sizes ? p.sizes.split(',')[0].trim() : 'M';
  const defaultColor = p.colors ? p.colors.split(',')[0].trim() : 'Standard';
  addToCart(p, 1, defaultSize, defaultColor);
  showToast(`Added "${p.name}" to shopping bag!`, 'success');
}

function addToCart(product, quantity = 1, size = '', color = '') {
  const existing = state.cart.find(item => item.id === product.id && item.size === size && item.color === color);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      size: size,
      color: color,
      quantity: quantity
    });
  }
  saveCart();
  updateCartUI();
}

function updateCartQty(index, delta) {
  if (!state.cart[index]) return;
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  updateCartUI();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('creston_cart', JSON.stringify(state.cart));
}

function getCartSubtotal() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calculateShippingFee(county, subtotal) {
  if (subtotal >= 5000 || subtotal === 0) return 0;
  const c = (county || '').toLowerCase();
  if (c === 'nairobi') return 200;
  if (['kiambu', 'machakos', 'kajiado'].includes(c)) return 300;
  if (['mombasa', 'nakuru', 'kisumu', 'eldoret', 'uasin gishu (eldoret)'].includes(c)) return 400;
  return 500;
}

function updateCartUI() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-badge').forEach(el => el.textContent = totalCount);

  const cartList = document.getElementById('cart-items-list');
  if (!cartList) return;

  if (state.cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-state" style="padding: 40px 10px;">
        <p style="font-size: 2rem;">🛍️</p>
        <h4>Your shopping bag is empty</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Discover our handcrafted suits, gowns, and executive shirts.</p>
      </div>
    `;
    const subtotalEl = document.getElementById('cart-subtotal-display');
    if (subtotalEl) subtotalEl.textContent = formatKSh(0);
    const btnCheckout = document.getElementById('btn-open-checkout');
    if (btnCheckout) btnCheckout.disabled = true;
    return;
  }

  const btnCheckout = document.getElementById('btn-open-checkout');
  if (btnCheckout) btnCheckout.disabled = false;

  cartList.innerHTML = state.cart.map((item, idx) => `
    <div class="cart-item">
      <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="cart-item-meta">${item.size ? 'Size: ' + item.size : ''} ${item.color ? '• ' + item.color : ''}</div>
        <div class="cart-item-price">${formatKSh(item.price * item.quantity)}</div>
        <div class="cart-qty-ctrl">
          <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
        </div>
      </div>
      <div>
        <button class="cart-item-remove" onclick="removeFromCart(${idx})" title="Remove item">✕</button>
      </div>
    </div>
  `).join('');

  const subtotal = getCartSubtotal();
  const subtotalEl = document.getElementById('cart-subtotal-display');
  if (subtotalEl) subtotalEl.textContent = formatKSh(subtotal);
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (open) {
    drawer.classList.add('active');
    backdrop.classList.add('active');
  } else {
    drawer.classList.remove('active');
    backdrop.classList.remove('active');
  }
}

// Checkout Modal & Delivery Location Management
function renderCountyDropdown() {
  const select = document.getElementById('checkout-county');
  if (!select) return;
  select.innerHTML = KENYAN_COUNTIES.map(c => `
    <option value="${c}" ${c === 'Nairobi' ? 'selected' : ''}>${c}</option>
  `).join('');
}

let selectedPaymentMethod = 'mpesa_stk';

function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Your bag is empty! Add items first.', 'error');
    return;
  }
  toggleCartDrawer(false);

  // Pre-fill user details if logged in
  if (state.currentUser) {
    const nameInput = document.getElementById('checkout-name');
    if (nameInput) nameInput.value = state.currentUser.full_name || '';
    const phoneInput = document.getElementById('checkout-phone');
    if (phoneInput) phoneInput.value = state.currentUser.phone || '';
    const emailInput = document.getElementById('checkout-email');
    if (emailInput) emailInput.value = state.currentUser.email || '';
    const countySelect = document.getElementById('checkout-county');
    if (countySelect && state.currentUser.delivery_county) countySelect.value = state.currentUser.delivery_county;
    const addressInput = document.getElementById('checkout-address');
    if (addressInput) addressInput.value = state.currentUser.delivery_address || '';
  }

  updateCheckoutSummary();
  selectPaymentMethod('mpesa_stk');
  document.getElementById('checkout-modal').classList.add('active');
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method-card').forEach(card => {
    if (card.dataset.method === method) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const tillBox = document.getElementById('mpesa-till-box');
  const stkBox = document.getElementById('mpesa-stk-info-box');
  const manualCodeBox = document.getElementById('manual-mpesa-code-box');

  if (method === 'mpesa_till' || method === 'mpesa_paybill') {
    if (tillBox) tillBox.style.display = 'block';
    if (stkBox) stkBox.style.display = 'none';
    if (manualCodeBox) manualCodeBox.style.display = 'block';
  } else if (method === 'mpesa_stk') {
    if (tillBox) tillBox.style.display = 'none';
    if (stkBox) stkBox.style.display = 'block';
    if (manualCodeBox) manualCodeBox.style.display = 'none';
  } else {
    // COD
    if (tillBox) tillBox.style.display = 'none';
    if (stkBox) stkBox.style.display = 'none';
    if (manualCodeBox) manualCodeBox.style.display = 'none';
  }
}

function updateCheckoutSummary() {
  const county = document.getElementById('checkout-county') ? document.getElementById('checkout-county').value : 'Nairobi';
  const subtotal = getCartSubtotal();
  const shipping = calculateShippingFee(county, subtotal);
  const total = subtotal + shipping;

  const subEl = document.getElementById('checkout-subtotal');
  if (subEl) subEl.textContent = formatKSh(subtotal);
  const shipEl = document.getElementById('checkout-shipping');
  if (shipEl) shipEl.textContent = shipping === 0 ? 'FREE' : formatKSh(shipping);
  const totEl = document.getElementById('checkout-total');
  if (totEl) totEl.textContent = formatKSh(total);
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const customer_name = document.getElementById('checkout-name').value.trim();
  const customer_phone = document.getElementById('checkout-phone').value.trim();
  const customer_email = document.getElementById('checkout-email').value.trim();
  const delivery_county = document.getElementById('checkout-county').value;
  const delivery_town = document.getElementById('checkout-town').value.trim();
  const delivery_address = document.getElementById('checkout-address').value.trim();
  const delivery_notes = document.getElementById('checkout-notes').value.trim();
  const mpesa_code = document.getElementById('checkout-mpesa-code') ? document.getElementById('checkout-mpesa-code').value.trim() : '';

  if (!customer_name || !customer_phone || !delivery_address) {
    showToast('Please fill in your name, Kenyan phone, and delivery address.', 'error');
    return;
  }

  const items = state.cart.map(item => ({
    product_id: item.id,
    quantity: item.quantity,
    size: item.size,
    color: item.color
  }));

  const payload = {
    customer_name,
    customer_phone,
    customer_email,
    delivery_county,
    delivery_town,
    delivery_address,
    delivery_notes,
    payment_method: selectedPaymentMethod,
    mpesa_code,
    items
  };

  const btn = document.getElementById('btn-submit-order');
  btn.disabled = true;
  btn.textContent = 'Processing Order...';

  const res = await apiCall('/api/orders/checkout', 'POST', payload);
  btn.disabled = false;
  btn.textContent = 'Confirm & Place Order';

  if (!res.success) {
    showToast(res.error || 'Failed to place order', 'error');
    return;
  }

  state.currentOrder = res;
  // Clear cart
  state.cart = [];
  saveCart();
  updateCartUI();

  // If STK Push chosen, open simulated STK push prompt!
  if (selectedPaymentMethod === 'mpesa_stk') {
    closeModals();
    openSTKSimulation(res);
  } else {
    closeModals();
    openReceiptModal(res);
  }
}

// Simulated STK Push Phone Popup
function openSTKSimulation(order) {
  const modal = document.getElementById('stk-simulation-modal');
  const amountEl = document.getElementById('stk-amount-display');
  const tillEl = document.getElementById('stk-till-display');
  const phoneEl = document.getElementById('stk-phone-display');

  if (amountEl) amountEl.textContent = formatKSh(order.total_amount);
  if (tillEl) tillEl.textContent = (state.paymentSettings ? state.paymentSettings.till_number : '5842910');
  if (phoneEl) phoneEl.textContent = order.customer_phone;

  document.getElementById('stk-pin-input').value = '';
  modal.classList.add('active');
}

async function confirmSTKPayment() {
  const pin = document.getElementById('stk-pin-input').value;
  if (!pin || pin.length < 4) {
    showToast('Please enter your 4-digit M-Pesa PIN', 'error');
    return;
  }

  const res = await apiCall('/api/orders/confirm-mpesa', 'POST', {
    order_number: state.currentOrder.order_number,
    mpesa_code: `SK${Math.random().toString(36).substring(2, 7).toUpperCase()}LK`
  });

  closeModals();
  if (res.success) {
    state.currentOrder.payment_status = 'Paid';
    state.currentOrder.mpesa_code = res.mpesa_code;
    showToast('M-Pesa payment confirmed successfully!', 'success');
    openReceiptModal(state.currentOrder);
  } else {
    showToast('Payment confirmation failed', 'error');
  }
}

// Receipt & Tracking Modal
function openReceiptModal(order) {
  const modal = document.getElementById('receipt-modal');
  const body = document.getElementById('receipt-modal-body');

  body.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 3rem; color: var(--mpesa); margin-bottom: 6px;">✓</div>
      <h3 style="font-family: var(--font-serif); font-size: 1.4rem;">Order Placed Successfully!</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Asante Sana for shopping with Creston Premium Collections.</p>
    </div>

    <div style="background: #F9FAFB; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
      <div class="summary-row">
        <span>Order Tracking No:</span>
        <strong style="color: var(--primary); font-size: 1.05rem;">${order.order_number}</strong>
      </div>
      <div class="summary-row">
        <span>Customer Phone:</span>
        <span>${order.customer_phone || ''}</span>
      </div>
      <div class="summary-row">
        <span>Delivery Location:</span>
        <span>${order.delivery_county || 'Kenya'}</span>
      </div>
      <div class="summary-row">
        <span>Payment Status:</span>
        <strong style="color: var(--mpesa);">${order.payment_status || 'Paid'}</strong>
      </div>
      ${order.mpesa_code ? `
        <div class="summary-row">
          <span>M-Pesa Receipt:</span>
          <strong>${order.mpesa_code}</strong>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total Paid:</span>
        <span>${formatKSh(order.total_amount)}</span>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button class="btn-checkout" style="background: var(--primary); margin-top: 0;" onclick="window.print()">
        🖨️ Print Receipt
      </button>
      <button class="btn-checkout" style="margin-top: 0;" onclick="closeModals()">
        Continue Shopping
      </button>
    </div>
  `;

  modal.classList.add('active');
}

// Order Tracking Lookup
async function handleTrackOrder(e) {
  e.preventDefault();
  const orderNumber = document.getElementById('track-order-input').value.trim();
  if (!orderNumber) return;

  const resultDiv = document.getElementById('track-order-result');
  resultDiv.innerHTML = '<p>Searching order history...</p>';

  const res = await apiCall(`/api/orders/track/${encodeURIComponent(orderNumber)}`);
  if (!res.success) {
    resultDiv.innerHTML = `<p style="color: var(--danger);">Order "${orderNumber}" not found. Please verify your order code.</p>`;
    return;
  }

  const o = res.order;
  resultDiv.innerHTML = `
    <div style="background: #F9FAFB; padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-top: 14px;">
      <div class="summary-row"><span>Order No:</span><strong>${o.order_number}</strong></div>
      <div class="summary-row"><span>Status:</span><span class="badge badge-instock" style="background: var(--mpesa);">${o.order_status}</span></div>
      <div class="summary-row"><span>Delivery County:</span><span>${o.delivery_county} (${o.delivery_town || ''})</span></div>
      <div class="summary-row"><span>Address:</span><span>${o.delivery_address}</span></div>
      <div class="summary-row"><span>Payment:</span><span>${o.payment_method.toUpperCase()} (${o.payment_status})</span></div>
      ${o.mpesa_code ? `<div class="summary-row"><span>M-Pesa Ref:</span><strong>${o.mpesa_code}</strong></div>` : ''}
      <div class="summary-row total"><span>Total:</span><span>${formatKSh(o.total_amount)}</span></div>
    </div>
  `;
}

// Authentication & Customer Profile
function updateAuthUI() {
  const btn = document.getElementById('btn-account-toggle');
  if (!btn) return;
  if (state.currentUser) {
    btn.innerHTML = `👤 ${state.currentUser.full_name.split(' ')[0]}`;
  } else {
    btn.innerHTML = `👤 Sign In`;
  }
}

function openAuthModal(tab = 'signin') {
  const modal = document.getElementById('auth-modal');
  switchAuthTab(tab);
  modal.classList.add('active');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(b => {
    if (b.dataset.tab === tab) b.classList.add('active');
    else b.classList.remove('active');
  });

  const signinForm = document.getElementById('signin-form');
  const registerForm = document.getElementById('register-form');
  const profileView = document.getElementById('user-profile-view');

  if (state.currentUser && tab === 'profile') {
    if (signinForm) signinForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (profileView) {
      profileView.style.display = 'block';
      loadCustomerOrders();
    }
  } else if (tab === 'register') {
    if (signinForm) signinForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (profileView) profileView.style.display = 'none';
  } else {
    if (signinForm) signinForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  const identifier = document.getElementById('signin-identifier').value.trim();
  const password = document.getElementById('signin-password').value;

  const res = await apiCall('/api/auth/login', 'POST', { identifier, password });
  if (!res.success) {
    showToast(res.error || 'Login failed', 'error');
    return;
  }

  state.currentUser = res.user;
  state.token = res.token;
  localStorage.setItem('creston_user', JSON.stringify(res.user));
  localStorage.setItem('creston_token', res.token);

  showToast(`Welcome back, ${res.user.full_name}!`, 'success');
  updateAuthUI();
  closeModals();
}

async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const delivery_county = document.getElementById('reg-county').value;
  const delivery_address = document.getElementById('reg-address').value.trim();

  const res = await apiCall('/api/auth/register', 'POST', {
    full_name, email, phone, password, delivery_county, delivery_address
  });

  if (!res.success) {
    showToast(res.error || 'Registration failed', 'error');
    return;
  }

  state.currentUser = res.user;
  state.token = res.token;
  localStorage.setItem('creston_user', JSON.stringify(res.user));
  localStorage.setItem('creston_token', res.token);

  showToast(`Karibu ${res.user.full_name}! Account created.`, 'success');
  updateAuthUI();
  closeModals();
}

function handleSignOut() {
  apiCall('/api/auth/logout', 'POST');
  state.currentUser = null;
  state.token = '';
  localStorage.removeItem('creston_user');
  localStorage.removeItem('creston_token');
  updateAuthUI();
  closeModals();
  showToast('You have been signed out.', 'info');
}

async function loadCustomerOrders() {
  const container = document.getElementById('customer-orders-list');
  if (!container) return;
  container.innerHTML = '<p>Loading order history...</p>';

  const res = await apiCall('/api/orders/my-orders');
  if (!res.success || !res.orders || res.orders.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">You have not placed any orders yet.</p>';
    return;
  }

  container.innerHTML = res.orders.map(o => `
    <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; background: white;">
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem;">
        <span>${o.order_number}</span>
        <span style="color: var(--mpesa);">${formatKSh(o.total_amount)}</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
        Placed on ${new Date(o.created_at).toLocaleDateString()} • Status: <strong>${o.order_status}</strong>
      </div>
    </div>
  `).join('');
}

// Modals management
function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
}

function setupEventListeners() {
  // Search input with debounce
  const searchInput = document.getElementById('search-products-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        loadProducts();
      }, 300);
    });
  }

  // Sort select
  const sortSelect = document.getElementById('sort-products-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      loadProducts();
    });
  }

  // County select in checkout updates shipping
  const countySelect = document.getElementById('checkout-county');
  if (countySelect) {
    countySelect.addEventListener('change', updateCheckoutSummary);
  }

  // Close modals on backdrop click or escape key
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModals();
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModals();
      toggleCartDrawer(false);
    }
  });
}

// Launch application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
