/**
 * CRESTON PREMIUM COLLECTIONS - Admin Portal Controller
 * Motto: Quality, Style, Trust
 */

const adminState = {
  token: localStorage.getItem('creston_admin_token') || '',
  adminUser: JSON.parse(localStorage.getItem('creston_admin_user') || 'null'),
  products: [],
  categories: [],
  orders: [],
  storeSettings: null,
  paymentSettings: null,
  selectedReportDate: new Date().toISOString().split('T')[0],
  activeTab: 'report'
};

function formatKSh(amount) {
  return 'KSh ' + Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function showAdminToast(message, type = 'info') {
  const container = document.getElementById('admin-toast-container');
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

async function adminApi(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminState.token) {
    headers['Authorization'] = `Bearer ${adminState.token}`;
  }
  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(endpoint, config);
    if (res.status === 401 || res.status === 403) {
      if (!endpoint.includes('/api/auth/login')) {
        showLoginOverlay(true);
      }
    }
    return await res.json();
  } catch (err) {
    console.error('Admin API Error:', err);
    return { success: false, error: 'Connection error' };
  }
}

// Initialization
async function initAdmin() {
  setupAdminTabs();
  
  if (!adminState.token || !adminState.adminUser || adminState.adminUser.role !== 'admin') {
    showLoginOverlay(true);
    return;
  }

  showLoginOverlay(false);
  renderAdminProfile();
  await loadAdminCategories();
  await loadDailyReport(adminState.selectedReportDate);
  await loadAdminProducts();
  await loadAdminPaymentSettings();
  await loadAdminStoreSettings();
  await loadAdminOrders();
}

function showLoginOverlay(show) {
  const overlay = document.getElementById('admin-login-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function renderAdminProfile() {
  const profileEl = document.getElementById('admin-profile-name');
  if (profileEl && adminState.adminUser) {
    profileEl.textContent = adminState.adminUser.full_name;
  }
}

// Tab Switching
function setupAdminTabs() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      const tabId = item.dataset.tab;
      adminState.activeTab = tabId;
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// --------------------------------------------------------------------------
// TAB 1: DAILY SALES REPORT
// --------------------------------------------------------------------------
async function loadDailyReport(targetDate) {
  adminState.selectedReportDate = targetDate;
  const res = await adminApi(`/api/admin/reports/daily?date=${targetDate}`);
  if (!res.success) {
    showAdminToast(res.error || 'Failed to load report', 'error');
    return;
  }

  const s = res.summary;
  document.getElementById('kpi-gross-sales').textContent = formatKSh(s.gross_sales);
  document.getElementById('kpi-total-orders').textContent = s.total_orders;
  document.getElementById('kpi-units-sold').textContent = s.units_sold;
  document.getElementById('kpi-aov').textContent = formatKSh(s.aov);
  document.getElementById('kpi-delivery-fees').textContent = formatKSh(s.delivery_fees);

  // Product breakdown table
  const tbody = document.getElementById('report-product-breakdown-tbody');
  if (res.product_breakdown && res.product_breakdown.length > 0) {
    tbody.innerHTML = res.product_breakdown.map(p => `
      <tr>
        <td><strong>${p.product_name}</strong></td>
        <td><span class="badge badge-category">${p.category_name || 'Apparel'}</span></td>
        <td>${p.units_sold}</td>
        <td><strong>${formatKSh(p.total_revenue)}</strong></td>
        <td><span class="badge ${p.current_stock <= 5 ? 'badge-lowstock' : 'badge-instock'}">${p.current_stock} in stock</span></td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No products sold on ${targetDate}.</td></tr>`;
  }

  // Payment breakdown
  const payContainer = document.getElementById('report-payment-breakdown');
  if (res.payment_breakdown && res.payment_breakdown.length > 0) {
    payContainer.innerHTML = res.payment_breakdown.map(pm => {
      let label = pm.payment_method.toUpperCase();
      if (pm.payment_method === 'mpesa_stk') label = 'M-Pesa STK Push';
      if (pm.payment_method === 'mpesa_till') label = 'Buy Goods Till';
      if (pm.payment_method === 'mpesa_paybill') label = 'M-Pesa Paybill';
      if (pm.payment_method === 'cod') label = 'Cash On Delivery';
      return `
        <div style="background: #F9FAFB; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${label}</span>
            <span style="color: var(--mpesa);">${formatKSh(pm.total_amount)}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
            ${pm.order_count} Orders Processed
          </div>
        </div>
      `;
    }).join('');
  } else {
    payContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No payment data recorded for this date.</p>';
  }

  // County delivery breakdown
  const countyContainer = document.getElementById('report-county-breakdown');
  if (res.county_breakdown && res.county_breakdown.length > 0) {
    countyContainer.innerHTML = res.county_breakdown.map(c => `
      <div class="summary-row" style="font-size: 0.85rem; padding: 4px 0;">
        <span>🇰🇪 ${c.delivery_county}:</span>
        <strong>${c.order_count} orders (${formatKSh(c.total_amount)})</strong>
      </div>
    `).join('');
  } else {
    countyContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No county delivery logs.</p>';
  }
}

function handleDateFilterChange(e) {
  const newDate = e.target.value;
  if (newDate) {
    loadDailyReport(newDate);
  }
}

function exportDailyReportCSV() {
  const targetDate = adminState.selectedReportDate;
  const url = `/api/admin/reports/export?date=${targetDate}`;
  // Use a temporary anchor to download
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `Creston_Sales_Report_${targetDate}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --------------------------------------------------------------------------
// TAB 2: CLOTHING & STOCK MANAGEMENT (PRICES, STOCK, VOID ITEMS)
// --------------------------------------------------------------------------
async function loadAdminCategories() {
  const res = await adminApi('/api/categories');
  if (res.success && res.categories) {
    adminState.categories = res.categories;
    const catSelect = document.getElementById('product-category-input');
    if (catSelect) {
      catSelect.innerHTML = res.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    const editCatSelect = document.getElementById('edit-product-category-input');
    if (editCatSelect) {
      editCatSelect.innerHTML = res.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }
}

async function loadAdminProducts() {
  const res = await adminApi('/api/admin/products');
  if (!res.success) return;
  adminState.products = res.products;
  renderAdminProductsTable();
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-table-tbody');
  if (!tbody) return;

  if (adminState.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px;">No products in inventory.</td></tr>';
    return;
  }

  tbody.innerHTML = adminState.products.map(p => {
    const isVoided = p.is_voided === 1;
    return `
      <tr style="${isVoided ? 'background: #FEF2F2; opacity: 0.95;' : ''}">
        <td style="width: 60px;">
          <img src="${p.image_url}" alt="${p.name}" style="width: 50px; height: 60px; object-fit: cover; border-radius: var(--radius-sm);">
        </td>
        <td>
          <div style="font-weight: 700; color: var(--primary);">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Sizes: ${p.sizes || 'Standard'} | Colors: ${p.colors || 'Standard'}</div>
          ${isVoided ? `
            <div style="margin-top: 4px;">
              <span class="badge badge-sale" style="font-size: 0.7rem; background: #DC2626; color: white;">🚫 VOIDED (Hidden from Shoppers)</span>
              <div style="font-size: 0.75rem; color: #991B1B; margin-top: 2px;">Reason: ${p.void_reason || 'Discontinued'}</div>
            </div>
          ` : ''}
        </td>
        <td><span class="badge badge-category">${p.category_name}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 0.8rem; color: var(--mpesa); font-weight: 700;">KSh</span>
            <input type="number" id="price-input-${p.id}" value="${p.price}" style="width: 85px; padding: 4px 6px; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;">
          </div>
        </td>
        <!-- CLICK TO EDIT STOCK LEVEL -->
        <td id="stock-cell-container-${p.id}">
          <div class="stock-clickable-badge" onclick="enableStockEdit(${p.id}, ${p.stock_quantity})" 
               title="Click to edit current stock" 
               style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; border: 1px dashed var(--gold); background: #FFFDF9; transition: all 0.2s;">
            <span style="font-weight: 800; font-size: 0.95rem; color: ${p.stock_quantity <= 5 ? '#D97706' : 'var(--primary)'};">
              ${p.stock_quantity}
            </span>
            <span style="font-size: 0.72rem; color: var(--gold); font-weight: 600;">✏️ Edit</span>
          </div>
        </td>
        <td>
          <button class="btn-ussd btn-ussd-send" style="padding: 6px 10px; font-size: 0.78rem;" onclick="saveProductPriceStock(${p.id})" title="Save price changes">
            💾 Save Price
          </button>
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn-ussd" style="background: var(--gold); color: var(--primary); padding: 6px 10px; font-size: 0.78rem;" onclick="openEditProductModal(${p.id})" title="Full Garment Edit">
              ✏️ Edit
            </button>
            ${isVoided ? `
              <button class="btn-ussd" style="background: var(--danger); color: white; padding: 6px 10px; font-size: 0.78rem; font-weight: 700;" onclick="promptDeleteProduct(${p.id})" title="Remove this voided item from website completely">
                🗑️ Remove Completely
              </button>
              <button class="btn-ussd" style="background: #4B5563; color: white; padding: 6px 10px; font-size: 0.78rem;" onclick="toggleVoidProduct(${p.id}, true)" title="Restore item to customer catalog">
                ↩️ Unvoid
              </button>
            ` : `
              <button class="btn-ussd" style="background: #D97706; color: white; padding: 6px 10px; font-size: 0.78rem;" onclick="promptVoidProduct(${p.id})" title="Hide item from shoppers">
                🚫 Void
              </button>
              <button class="btn-ussd" style="background: #991B1B; color: white; padding: 6px 10px; font-size: 0.78rem;" onclick="promptDeleteProduct(${p.id})" title="Permanently delete from website">
                🗑️ Remove
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Quick price & stock save
async function saveProductPriceStock(productId) {
  const price = parseFloat(document.getElementById(`price-input-${productId}`).value);
  const stock = parseInt(document.getElementById(`stock-input-${productId}`).value);

  if (isNaN(price) || isNaN(stock)) {
    showAdminToast('Please enter valid numeric values for price and stock', 'error');
    return;
  }

  const res = await adminApi(`/api/admin/products/${productId}/price-stock`, 'PATCH', {
    price: price,
    stock_quantity: stock
  });

  if (res.success) {
    showAdminToast('Stock price and quantity updated successfully!', 'success');
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Update failed', 'error');
  }
}

// Void item prompt
let productToVoidId = null;

function promptVoidProduct(productId) {
  productToVoidId = productId;
  const modal = document.getElementById('admin-void-modal');
  document.getElementById('void-reason-input').value = 'Seasonal fabric discontinued / Defective inventory';
  modal.classList.add('active');
}

async function confirmVoidProduct() {
  if (!productToVoidId) return;
  const reason = document.getElementById('void-reason-input').value.trim();

  const res = await adminApi(`/api/admin/products/${productToVoidId}/void`, 'POST', {
    reason: reason || 'Discontinued by administrator'
  });

  closeAdminModals();
  if (res.success) {
    showAdminToast('Product has been voided and hidden from customer catalog.', 'info');
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Failed to void product', 'error');
  }
}

async function toggleVoidProduct(productId, unvoid = false) {
  const res = await adminApi(`/api/admin/products/${productId}/void`, 'POST', { unvoid: unvoid });
  if (res.success) {
    showAdminToast('Product unvoided and restored to public catalog!', 'success');
    loadAdminProducts();
  }
}

// --------------------------------------------------------------------------
// CLICK & EDIT CURRENT STOCK IN INVENTORY
// --------------------------------------------------------------------------
function enableStockEdit(productId, currentStock) {
  const container = document.getElementById(`stock-cell-container-${productId}`);
  if (!container) return;

  container.innerHTML = `
    <div style="display: inline-flex; align-items: center; gap: 3px; background: white; padding: 2px; border: 2px solid var(--gold); border-radius: 6px;">
      <button type="button" class="qty-btn" style="width: 22px; height: 22px; font-size: 0.8rem;" onclick="adjustStockValue(${productId}, -1)">-</button>
      <input type="number" id="inline-stock-input-${productId}" value="${currentStock}" min="0" 
             style="width: 54px; text-align: center; font-weight: 800; font-size: 0.95rem; border: none; outline: none; padding: 2px;"
             onkeydown="if(event.key === 'Enter') saveInlineStock(${productId}); if(event.key === 'Escape') cancelInlineStock(${productId}, ${currentStock});"
             onblur="saveInlineStock(${productId})">
      <button type="button" class="qty-btn" style="width: 22px; height: 22px; font-size: 0.8rem;" onclick="adjustStockValue(${productId}, 1)">+</button>
    </div>
  `;

  const input = document.getElementById(`inline-stock-input-${productId}`);
  if (input) {
    input.focus();
    input.select();
  }
}

function adjustStockValue(productId, delta) {
  const input = document.getElementById(`inline-stock-input-${productId}`);
  if (!input) return;
  const currentVal = parseInt(input.value) || 0;
  input.value = Math.max(0, currentVal + delta);
  saveInlineStock(productId);
}

let isSavingStock = false;
async function saveInlineStock(productId) {
  if (isSavingStock) return;
  const input = document.getElementById(`inline-stock-input-${productId}`);
  if (!input) return;
  const newStock = parseInt(input.value);
  if (isNaN(newStock) || newStock < 0) {
    showAdminToast('Please enter a valid stock number', 'error');
    return;
  }

  isSavingStock = true;
  const res = await adminApi(`/api/admin/products/${productId}/price-stock`, 'PATCH', {
    stock_quantity: newStock
  });
  isSavingStock = false;

  if (res.success) {
    showAdminToast(`Stock for item #${productId} updated to ${newStock} units!`, 'success');
    const p = adminState.products.find(item => item.id === productId);
    if (p) p.stock_quantity = newStock;
    renderStockBadge(productId, newStock);
  } else {
    showAdminToast(res.error || 'Failed to update stock', 'error');
  }
}

function renderStockBadge(productId, stockQuantity) {
  const container = document.getElementById(`stock-cell-container-${productId}`);
  if (!container) return;
  container.innerHTML = `
    <div class="stock-clickable-badge" onclick="enableStockEdit(${productId}, ${stockQuantity})" 
         title="Click to edit current stock" 
         style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; border: 1px dashed var(--gold); background: #FFFDF9; transition: all 0.2s;">
      <span style="font-weight: 800; font-size: 0.95rem; color: ${stockQuantity <= 5 ? '#D97706' : 'var(--primary)'};">
        ${stockQuantity}
      </span>
      <span style="font-size: 0.72rem; color: var(--gold); font-weight: 600;">✏️ Edit</span>
    </div>
  `;
}

function cancelInlineStock(productId, oldStock) {
  renderStockBadge(productId, oldStock);
}

function convertVoidToDelete() {
  const id = productToVoidId;
  closeAdminModals();
  if (id) promptDeleteProduct(id);
}

// --------------------------------------------------------------------------
// EDIT PRODUCT (FULL ATTRIBUTE EDITING)
// --------------------------------------------------------------------------
function openEditProductModal(productId) {
  const p = adminState.products.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('edit-product-id').value = p.id;
  document.getElementById('edit-product-name-input').value = p.name || '';
  const catSelect = document.getElementById('edit-product-category-input');
  if (catSelect && p.category_id) catSelect.value = p.category_id;
  document.getElementById('edit-product-price-input').value = p.price || 0;
  document.getElementById('edit-product-orig-price-input').value = p.original_price || p.price || '';
  document.getElementById('edit-product-cost-input').value = p.cost_price || '';
  document.getElementById('edit-product-stock-input').value = p.stock_quantity || 0;
  document.getElementById('edit-product-sizes-input').value = p.sizes || '';
  document.getElementById('edit-product-colors-input').value = p.colors || '';
  document.getElementById('edit-product-image-input').value = p.image_url || '';
  document.getElementById('edit-product-desc-input').value = p.description || '';

  const editFileInput = document.getElementById('edit-product-file-input');
  if (editFileInput) editFileInput.value = '';

  // Update preview image
  const previewImg = document.getElementById('edit-product-preview-img');
  if (previewImg && p.image_url) {
    previewImg.src = p.image_url;
  }
  const previewLabel = document.getElementById('edit-product-preview-label');
  if (previewLabel) {
    previewLabel.textContent = 'Current Garment Image';
  }

  document.getElementById('admin-edit-product-modal').classList.add('active');
}

async function handleUpdateProduct(e) {
  e.preventDefault();
  const productId = parseInt(document.getElementById('edit-product-id').value);
  const name = document.getElementById('edit-product-name-input').value.trim();
  const category_id = parseInt(document.getElementById('edit-product-category-input').value);
  const price = parseFloat(document.getElementById('edit-product-price-input').value);
  const original_price = parseFloat(document.getElementById('edit-product-orig-price-input').value) || price;
  const cost_price = parseFloat(document.getElementById('edit-product-cost-input').value) || (price * 0.5);
  const stock_quantity = parseInt(document.getElementById('edit-product-stock-input').value);
  const sizes = document.getElementById('edit-product-sizes-input').value.trim();
  const colors = document.getElementById('edit-product-colors-input').value.trim();
  const image_url = document.getElementById('edit-product-image-input').value.trim();
  const description = document.getElementById('edit-product-desc-input').value.trim();

  const res = await adminApi(`/api/admin/products/${productId}`, 'PUT', {
    name, category_id, price, original_price, cost_price, stock_quantity,
    sizes, colors, image_url, description
  });

  if (res.success) {
    showAdminToast(`Product "${name}" updated successfully!`, 'success');
    closeAdminModals();
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Failed to update product', 'error');
  }
}

// --------------------------------------------------------------------------
// REMOVE / DELETE PRODUCT (PERMANENT DELETION)
// --------------------------------------------------------------------------
let productToDeleteId = null;

function promptDeleteProduct(productId) {
  const p = adminState.products.find(item => item.id === productId);
  if (!p) return;
  productToDeleteId = productId;
  document.getElementById('delete-product-name-display').textContent = `"${p.name}"`;
  document.getElementById('admin-delete-product-modal').classList.add('active');
}

async function confirmDeleteProduct() {
  if (!productToDeleteId) return;

  const res = await adminApi(`/api/admin/products/${productToDeleteId}`, 'DELETE');
  closeAdminModals();

  if (res.success) {
    showAdminToast(res.message || 'Product permanently removed!', 'success');
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Failed to remove product', 'error');
  }
}

// Upload new product
async function handleCreateProduct(e) {
  e.preventDefault();
  const name = document.getElementById('product-name-input').value.trim();
  const category_id = parseInt(document.getElementById('product-category-input').value);
  const price = parseFloat(document.getElementById('product-price-input').value);
  const original_price = parseFloat(document.getElementById('product-orig-price-input').value) || price;
  const cost_price = parseFloat(document.getElementById('product-cost-input').value) || (price * 0.5);
  const stock_quantity = parseInt(document.getElementById('product-stock-input').value);
  const sizes = document.getElementById('product-sizes-input').value.trim();
  const colors = document.getElementById('product-colors-input').value.trim();
  const image_url = document.getElementById('product-image-input').value.trim();
  const description = document.getElementById('product-desc-input').value.trim();

  const res = await adminApi('/api/admin/products', 'POST', {
    name, category_id, price, original_price, cost_price, stock_quantity,
    sizes, colors, image_url, description
  });

  if (res.success) {
    showAdminToast(`Product "${name}" uploaded successfully!`, 'success');
    closeAdminModals();
    document.getElementById('add-product-form').reset();
    const previewContainer = document.getElementById('product-upload-preview');
    if (previewContainer) previewContainer.style.display = 'none';
    const previewImg = document.getElementById('product-preview-img');
    if (previewImg) previewImg.src = '';
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Failed to upload product', 'error');
  }
}

// --------------------------------------------------------------------------
// TAB 3: PAYMENT & TILL SETTINGS (M-PESA)
// --------------------------------------------------------------------------
async function loadAdminPaymentSettings() {
  const res = await adminApi('/api/payment-settings');
  if (!res.success || !res.payment_settings) return;
  adminState.paymentSettings = res.payment_settings;

  const ps = res.payment_settings;
  document.getElementById('setting-till-number').value = ps.till_number || '';
  document.getElementById('setting-till-name').value = ps.till_name || '';
  document.getElementById('setting-paybill-number').value = ps.paybill_number || '';
  document.getElementById('setting-paybill-account').value = ps.paybill_account || '';
  document.getElementById('setting-stk-toggle').checked = Boolean(ps.stk_enabled);
  document.getElementById('setting-till-toggle').checked = Boolean(ps.till_enabled);
  document.getElementById('setting-paybill-toggle').checked = Boolean(ps.paybill_enabled);
  document.getElementById('setting-cod-toggle').checked = Boolean(ps.cod_enabled);
  document.getElementById('setting-instructions').value = ps.instructions || '';
}

async function handleSavePaymentSettings(e) {
  e.preventDefault();
  const till_number = document.getElementById('setting-till-number').value.trim();
  const till_name = document.getElementById('setting-till-name').value.trim();
  const paybill_number = document.getElementById('setting-paybill-number').value.trim();
  const paybill_account = document.getElementById('setting-paybill-account').value.trim();
  const stk_enabled = document.getElementById('setting-stk-toggle').checked ? 1 : 0;
  const till_enabled = document.getElementById('setting-till-toggle').checked ? 1 : 0;
  const paybill_enabled = document.getElementById('setting-paybill-toggle').checked ? 1 : 0;
  const cod_enabled = document.getElementById('setting-cod-toggle').checked ? 1 : 0;
  const instructions = document.getElementById('setting-instructions').value.trim();

  const res = await adminApi('/api/admin/payment-settings', 'PUT', {
    till_number, till_name, paybill_number, paybill_account,
    stk_enabled, till_enabled, paybill_enabled, cod_enabled, instructions
  });

  if (res.success) {
    showAdminToast('M-Pesa payment options and Till number updated!', 'success');
  } else {
    showAdminToast(res.error || 'Failed to update payment settings', 'error');
  }
}

// --------------------------------------------------------------------------
// TAB 4: STORE BRANDING & ABOUT DETAILS (LOGO & ABOUT US)
// --------------------------------------------------------------------------
async function loadAdminStoreSettings() {
  const res = await adminApi('/api/store/settings');
  if (!res.success || !res.settings) return;
  adminState.storeSettings = res.settings;

  const s = res.settings;
  document.getElementById('setting-store-name').value = s.store_name || '';
  document.getElementById('setting-store-motto').value = s.motto || '';
  document.getElementById('setting-logo-url').value = s.logo_url || '';
  document.getElementById('admin-logo-preview').src = s.logo_url || '';
  document.getElementById('setting-about-title').value = s.about_title || '';
  document.getElementById('setting-about-text').value = s.about_text || '';
  document.getElementById('setting-physical-address').value = s.physical_address || '';
  document.getElementById('setting-phone').value = s.phone_number || '';
  document.getElementById('setting-email').value = s.email_address || '';
  document.getElementById('setting-opening-hours').value = s.opening_hours || '';
  document.getElementById('setting-banner-text').value = s.banner_text || '';
}

// Preview logo dynamically on typing or file choose
function handleLogoUrlChange(e) {
  const preview = document.getElementById('admin-logo-preview');
  if (preview && e.target.value) {
    preview.src = e.target.value;
  }
}

function handleLogoFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const base64Data = event.target.result;
    document.getElementById('setting-logo-url').value = base64Data;
    document.getElementById('admin-logo-preview').src = base64Data;
  };
  reader.readAsDataURL(file);
}

async function handleSaveStoreSettings(e) {
  e.preventDefault();
  const store_name = document.getElementById('setting-store-name').value.trim();
  const motto = document.getElementById('setting-store-motto').value.trim();
  const logo_url = document.getElementById('setting-logo-url').value.trim();
  const about_title = document.getElementById('setting-about-title').value.trim();
  const about_text = document.getElementById('setting-about-text').value.trim();
  const physical_address = document.getElementById('setting-physical-address').value.trim();
  const phone_number = document.getElementById('setting-phone').value.trim();
  const email_address = document.getElementById('setting-email').value.trim();
  const opening_hours = document.getElementById('setting-opening-hours').value.trim();
  const banner_text = document.getElementById('setting-banner-text').value.trim();

  const res = await adminApi('/api/admin/store/settings', 'PUT', {
    store_name, motto, logo_url, about_title, about_text,
    physical_address, phone_number, email_address, opening_hours, banner_text
  });

  if (res.success) {
    showAdminToast('Store logo and About Us details saved successfully!', 'success');
  } else {
    showAdminToast(res.error || 'Failed to save store settings', 'error');
  }
}

// --------------------------------------------------------------------------
// TAB 5: ORDERS MANAGEMENT & ORDER VOIDING
// --------------------------------------------------------------------------
async function loadAdminOrders() {
  const res = await adminApi('/api/admin/orders');
  if (!res.success) return;
  adminState.orders = res.orders;
  renderAdminOrdersTable();
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('admin-orders-table-tbody');
  if (!tbody) return;

  if (adminState.orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px;">No customer orders found.</td></tr>';
    return;
  }

  tbody.innerHTML = adminState.orders.map(o => {
    const isVoided = o.is_voided === 1;
    return `
      <tr style="${isVoided ? 'background: #FEF2F2; opacity: 0.8;' : ''}">
        <td>
          <strong>${o.order_number}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(o.created_at).toLocaleString()}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${o.customer_name}</div>
          <div style="font-size: 0.8rem; color: var(--mpesa);">${o.customer_phone}</div>
        </td>
        <td>
          <div>${o.delivery_county}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${o.delivery_address}</div>
        </td>
        <td>
          <div style="font-weight: 700;">${formatKSh(o.total_amount)}</div>
          <div style="font-size: 0.75rem;">${o.payment_method.toUpperCase()} ${o.mpesa_code ? `(${o.mpesa_code})` : ''}</div>
        </td>
        <td>
          <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding: 4px; font-size: 0.82rem; border-radius: 4px;" ${isVoided ? 'disabled' : ''}>
            <option value="Processing" ${o.order_status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Out for Delivery" ${o.order_status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Delivered" ${o.order_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Voided" ${o.order_status === 'Voided' ? 'selected' : ''}>Voided</option>
          </select>
        </td>
        <td>
          ${isVoided ? `
            <span class="badge badge-sale">Voided: ${o.void_reason || 'Cancelled'}</span>
          ` : `
            <button class="btn-ussd btn-ussd-cancel" style="padding: 4px 8px; font-size: 0.75rem;" onclick="promptVoidOrder(${o.id})">
              Void Order
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  const res = await adminApi(`/api/admin/orders/${orderId}/status`, 'PATCH', { order_status: newStatus });
  if (res.success) {
    showAdminToast(`Order status updated to ${newStatus}`, 'success');
    loadAdminOrders();
  }
}

async function promptVoidOrder(orderId) {
  const reason = prompt("Enter reason for voiding order (items will be returned to inventory):", "Customer requested cancellation");
  if (!reason) return;

  const res = await adminApi(`/api/admin/orders/${orderId}/void`, 'POST', { reason });
  if (res.success) {
    showAdminToast('Order voided and inventory replenished.', 'info');
    loadAdminOrders();
    loadAdminProducts();
  } else {
    showAdminToast(res.error || 'Failed to void order', 'error');
  }
}

// Admin Authentication
async function handleAdminLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('admin-login-identifier').value.trim();
  const password = document.getElementById('admin-login-password').value;

  const res = await adminApi('/api/auth/login', 'POST', { identifier, password });
  if (!res.success) {
    showAdminToast(res.error || 'Admin login failed', 'error');
    return;
  }

  if (res.user.role !== 'admin') {
    showAdminToast('Access denied: You do not have administrator permissions.', 'error');
    return;
  }

  adminState.token = res.token;
  adminState.adminUser = res.user;
  localStorage.setItem('creston_admin_token', res.token);
  localStorage.setItem('creston_admin_user', JSON.stringify(res.user));

  showLoginOverlay(false);
  showAdminToast(`Welcome, Administrator ${res.user.full_name}!`, 'success');
  initAdmin();
}

function handleAdminLogout() {
  adminApi('/api/auth/logout', 'POST');
  adminState.token = '';
  adminState.adminUser = null;
  localStorage.removeItem('creston_admin_token');
  localStorage.removeItem('creston_admin_user');
  showLoginOverlay(true);
}

function closeAdminModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
}

// Local PC file upload handler for Add Product and Edit Product modals
function setupProductFileUploads() {
  // 1. New Product Upload Modal file input
  const addFileInput = document.getElementById('product-file-input');
  const addUrlInput = document.getElementById('product-image-input');
  const addPreviewContainer = document.getElementById('product-upload-preview');
  const addPreviewImg = document.getElementById('product-preview-img');

  if (addFileInput) {
    addFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(event) {
        const base64Data = event.target.result;
        if (addPreviewImg) {
          addPreviewImg.src = base64Data;
          if (addPreviewContainer) addPreviewContainer.style.display = 'flex';
        }
        showAdminToast('Uploading garment photo to server...', 'info');
        const res = await adminApi('/api/admin/upload', 'POST', {
          data: base64Data,
          filename: file.name
        });
        if (res.success && res.url) {
          if (addUrlInput) addUrlInput.value = res.url;
          showAdminToast('Image uploaded from PC successfully!', 'success');
        } else {
          showAdminToast(res.error || 'Failed to upload image', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (addUrlInput) {
    addUrlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && addPreviewImg) {
        addPreviewImg.src = val;
        if (addPreviewContainer) addPreviewContainer.style.display = 'flex';
      }
    });
  }

  // 2. Edit Product Modal file input
  const editFileInput = document.getElementById('edit-product-file-input');
  const editUrlInput = document.getElementById('edit-product-image-input');
  const editPreviewContainer = document.getElementById('edit-product-upload-preview');
  const editPreviewImg = document.getElementById('edit-product-preview-img');
  const editPreviewLabel = document.getElementById('edit-product-preview-label');

  if (editFileInput) {
    editFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(event) {
        const base64Data = event.target.result;
        if (editPreviewImg) {
          editPreviewImg.src = base64Data;
          if (editPreviewContainer) editPreviewContainer.style.display = 'flex';
          if (editPreviewLabel) editPreviewLabel.textContent = `New PC Image: ${file.name}`;
        }
        showAdminToast('Uploading new garment photo...', 'info');
        const res = await adminApi('/api/admin/upload', 'POST', {
          data: base64Data,
          filename: file.name
        });
        if (res.success && res.url) {
          if (editUrlInput) editUrlInput.value = res.url;
          showAdminToast('New image uploaded from PC successfully!', 'success');
        } else {
          showAdminToast(res.error || 'Failed to upload image', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (editUrlInput) {
    editUrlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && editPreviewImg) {
        editPreviewImg.src = val;
        if (editPreviewContainer) editPreviewContainer.style.display = 'flex';
        if (editPreviewLabel) editPreviewLabel.textContent = 'URL Preview';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('report-date-picker');
  if (dateInput) {
    dateInput.value = adminState.selectedReportDate;
    dateInput.addEventListener('change', handleDateFilterChange);
  }

  const logoUrlInput = document.getElementById('setting-logo-url');
  if (logoUrlInput) {
    logoUrlInput.addEventListener('input', handleLogoUrlChange);
  }

  const logoFileInput = document.getElementById('setting-logo-file');
  if (logoFileInput) {
    logoFileInput.addEventListener('change', handleLogoFileSelected);
  }

  setupProductFileUploads();
  initAdmin();
});
