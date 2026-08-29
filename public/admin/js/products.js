/**
 * Crystal Crest - Admin Products & Inventory Management (js/products.js)
 * Full CRUD, Multer image upload, Shoe Target Group (Men/Women/Children) & Variant Options.
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http, ApiService } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let productsList = [];
let categoriesList = [];

async function initProductsPage() {
  const user = await AdminLayout.init('products', 'Products & Inventory Catalog');
  if (!user) return;

  await loadCategories();
  await loadProducts();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductsPage);
} else {
  initProductsPage();
}

async function loadCategories() {
  try {
    const res = await http.get('/api/admin/categories');
    categoriesList = res.categories || [];

    const filterSelect = document.getElementById('admin-category-filter');
    const formCatSelect = document.getElementById('form-category-id');

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="all">All Categories</option>` + categoriesList.map(c => `
        <option value="${c.id}">${c.name}</option>
      `).join('');
    }

    if (formCatSelect) {
      formCatSelect.innerHTML = `<option value="">Select Category...</option>` + categoriesList.map(c => `
        <option value="${c.id}">${c.name}</option>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

async function loadProducts() {
  const tbody = document.getElementById('admin-products-tbody');
  if (tbody) {
    UI.renderSkeletonTable(tbody, 5, 8);
  }

  try {
    const res = await http.get('/api/admin/products');
    productsList = res.products || [];
    renderProductsTable(productsList);
  } catch (e) {
    console.error('Failed to load products', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-semibold text-xs">Failed to load catalog products.</td></tr>`;
    }
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-gray-400">
          <div class="space-y-2">
            <span class="text-3xl block">🛍️</span>
            <h4 class="font-bold text-gray-700 text-sm">No Products Found</h4>
            <p class="text-xs text-gray-500">Add new products to populate the catalog.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const priceNum = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);
    const buyingNum = typeof p.buying_price === 'number' ? p.buying_price : (parseFloat(p.buying_price) || 0);
    const img = (p.images && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5">
          <img src="${img}" alt="${p.name}" class="w-10 h-10 object-cover rounded-lg bg-gray-100 border border-gray-200">
        </td>
        <td class="p-3.5">
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-900 block">${p.name}</span>
            ${p.target_group ? `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase rounded">${p.target_group}</span>` : ''}
          </div>
          <span class="text-[10px] text-gray-400 font-mono">ID: ${p.id}</span>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 bg-purple-50 text-[#9B72CF] font-semibold text-[10px] uppercase rounded-full border border-purple-100">
            ${p.category || 'Cosmetics'}
          </span>
        </td>
        <td class="p-3.5 font-bold text-gray-900">KSh ${priceNum.toLocaleString()}</td>
        <td class="p-3.5 text-gray-500">KSh ${buyingNum.toLocaleString()}</td>
        <td class="p-3.5">
          <span class="font-bold ${p.stock_quantity <= 10 ? 'text-red-600' : 'text-gray-900'}">${p.stock_quantity}</span>
        </td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}">
            ${p.is_active ? 'Active' : 'Draft'}
          </span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button data-edit-id="${p.id}" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-[11px] rounded-lg transition-colors">
            Edit
          </button>
          <button data-delete-id="${p.id}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] rounded-lg transition-colors">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-edit-id');
      const prod = productsList.find(p => p.id === id);
      if (prod) openModal(prod);
    });
  });

  tbody.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-delete-id');
      const prod = productsList.find(p => p.id === id);

      const confirmed = await UI.showConfirm({
        title: 'Delete Catalog Product',
        message: `Are you sure you want to permanently delete "${prod ? prod.name : 'this item'}"?`,
        confirmText: 'Delete Item',
        danger: true
      });

      if (confirmed) {
        UI.setButtonLoading(e.currentTarget, true, 'Deleting...');
        try {
          await http.delete(`/api/admin/products/${id}`);
          UI.showToast(`Product "${prod ? prod.name : ''}" deleted.`, "Deleted", "success");
          await loadProducts();
        } catch (err) {
          UI.showToast(err.message || 'Failed to delete product', "Delete Error", "error");
        } finally {
          UI.setButtonLoading(e.currentTarget, false);
        }
      }
    });
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById('admin-product-search');
  const catFilter = document.getElementById('admin-category-filter');

  if (searchInput) searchInput.addEventListener('input', filterTable);
  if (catFilter) catFilter.addEventListener('change', filterTable);

  document.getElementById('open-add-product-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('close-product-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-product-modal')?.addEventListener('click', closeModal);

  const formCatSelect = document.getElementById('form-category-id');
  if (formCatSelect) {
    formCatSelect.addEventListener('change', (e) => {
      toggleCategorySpecificFields(e.target.value);
    });
  }

  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });
  }
}

function filterTable() {
  const search = (document.getElementById('admin-product-search')?.value || '').toLowerCase();
  const catId = document.getElementById('admin-category-filter')?.value || 'all';

  const filtered = productsList.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search);
    const matchCat = catId === 'all' || p.category_id === catId;
    return matchSearch && matchCat;
  });

  renderProductsTable(filtered);
}

function toggleCategorySpecificFields(catId) {
  const catObj = categoriesList.find(c => c.id === catId);
  const catSlug = catObj ? catObj.slug.toLowerCase() : '';
  const catName = catObj ? catObj.name.toLowerCase() : '';

  const shoesBox = document.getElementById('shoes-category-fields');
  const spaBox = document.getElementById('spa-category-fields');

  if (shoesBox) {
    if (catSlug.includes('shoe') || catName.includes('shoe')) {
      shoesBox.classList.remove('hidden');
    } else {
      shoesBox.classList.add('hidden');
    }
  }

  if (spaBox) {
    if (catSlug.includes('spa') || catName.includes('spa')) {
      spaBox.classList.remove('hidden');
    } else {
      spaBox.classList.add('hidden');
    }
  }
}

function showInlineError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('border-red-500', 'bg-red-50/20');
  let parent = inputEl.parentElement;
  let errEl = parent.querySelector('.inline-error-text');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'inline-error-text text-[11px] text-red-500 font-semibold mt-1';
    parent.appendChild(errEl);
  }
  errEl.textContent = msg;
}

function clearInlineErrors() {
  document.querySelectorAll('.inline-error-text').forEach(e => e.remove());
  document.querySelectorAll('.border-red-500').forEach(e => e.classList.remove('border-red-500', 'bg-red-50/20'));
}

function openModal(product = null) {
  clearInlineErrors();
  const modal = document.getElementById('product-modal-backdrop');
  const title = document.getElementById('modal-title');
  if (!modal) return;

  document.getElementById('product-id').value = product ? product.id : '';
  document.getElementById('form-name').value = product ? product.name : '';
  document.getElementById('form-category-id').value = product ? (product.category_id || '') : '';
  document.getElementById('form-target-group').value = product ? (product.target_group || 'Men') : 'Men';
  document.getElementById('form-price').value = product ? product.price : '';
  document.getElementById('form-buying-price').value = product ? product.buying_price : '';
  document.getElementById('form-stock-quantity').value = product ? product.stock_quantity : 50;
  document.getElementById('form-description').value = product ? (product.description || '') : '';
  document.getElementById('form-is-active').checked = product ? (product.is_active !== false) : true;

  document.getElementById('form-shoe-sizes').value = product && product.sizes ? product.sizes.join(', ') : 'EU 40 / US 7.5, EU 42 / US 9';
  document.getElementById('form-shoe-colors').value = product && product.colors ? product.colors.join(', ') : 'Mahogany Brown, Midnight Black';
  document.getElementById('form-spa-duration').value = product && product.sizes ? product.sizes.join(', ') : '60 Min Session';

  if (product && product.category_id) {
    toggleCategorySpecificFields(product.category_id);
  } else {
    toggleCategorySpecificFields('');
  }

  title.textContent = product ? 'Edit Product Details' : 'Add New Product';
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('product-modal-backdrop')?.classList.add('hidden');
}

async function handleFormSubmit() {
  clearInlineErrors();

  const prodId = document.getElementById('product-id').value;
  const nameEl = document.getElementById('form-name');
  const priceEl = document.getElementById('form-price');
  const stockEl = document.getElementById('form-stock-quantity');
  const submitBtn = document.querySelector('#product-form button[type="submit"]');

  const name = nameEl.value.trim();
  const category_id = document.getElementById('form-category-id').value;
  const target_group = document.getElementById('form-target-group').value;
  const price = parseFloat(priceEl.value);
  const buying_price = parseFloat(document.getElementById('form-buying-price').value || 0);
  const stock_quantity = parseInt(stockEl.value || 0, 10);
  const description = document.getElementById('form-description').value.trim();
  const is_active = document.getElementById('form-is-active').checked;

  let isValid = true;
  if (!name) {
    showInlineError(nameEl, 'Product name is required.');
    isValid = false;
  }
  if (isNaN(price) || price < 0) {
    showInlineError(priceEl, 'Price must be a positive number.');
    isValid = false;
  }
  if (isNaN(stock_quantity) || stock_quantity < 0) {
    showInlineError(stockEl, 'Stock quantity must be 0 or greater.');
    isValid = false;
  }

  if (!isValid) return;

  const catObj = categoriesList.find(c => c.id === category_id);
  const catSlug = catObj ? catObj.slug.toLowerCase() : '';

  let sizes = [];
  let colors = [];

  if (catSlug.includes('shoe')) {
    sizes = document.getElementById('form-shoe-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
    colors = document.getElementById('form-shoe-colors').value.split(',').map(c => c.trim()).filter(Boolean);
  } else if (catSlug.includes('spa')) {
    sizes = document.getElementById('form-spa-duration').value.split(',').map(s => s.trim()).filter(Boolean);
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('category_id', category_id);
  formData.append('target_group', target_group);
  formData.append('price', price);
  formData.append('buying_price', buying_price);
  formData.append('stock_quantity', stock_quantity);
  formData.append('description', description);
  formData.append('is_active', is_active);
  formData.append('sizes', JSON.stringify(sizes));
  formData.append('colors', JSON.stringify(colors));

  const fileInput = document.getElementById('form-image-file');
  if (fileInput && fileInput.files.length > 0) {
    formData.append('imageFile', fileInput.files[0]);
  }

  UI.setButtonLoading(submitBtn, true, 'Saving Product...');

  try {
    const url = prodId ? `/api/admin/products/${prodId}` : '/api/admin/products';
    const method = prodId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      UI.showToast(`Product "${name}" saved successfully!`, "Product Saved", "success");
      closeModal();
      await loadProducts();
    } else {
      UI.showToast(data.error || 'Failed to save product', "Save Error", "error");
    }
  } catch (err) {
    UI.showToast(err.message || 'Error submitting product form', "Save Error", "error");
  } finally {
    UI.setButtonLoading(submitBtn, false);
  }
}
