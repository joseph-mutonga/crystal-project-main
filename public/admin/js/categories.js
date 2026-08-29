/**
 * Crystal Crest - Admin Categories CRUD (js/categories.js)
 */

import { AdminLayout } from '../../js/shared/admin-layout.js';
import { http } from '../../js/shared/api.js';
import { UI } from '../../js/shared/ui.js';

let categories = [];

async function initCategoriesPage() {
  const user = await AdminLayout.init('categories', 'Categories & Department Hierarchy');
  if (!user) return;

  await loadCategories();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoriesPage);
} else {
  initCategoriesPage();
}

async function loadCategories() {
  const tbody = document.getElementById('admin-categories-tbody');
  if (tbody) {
    UI.renderSkeletonTable(tbody, 4, 5);
  }

  try {
    const res = await http.get('/api/admin/categories');
    categories = res.categories || [];
    renderTable(categories);
  } catch (e) {
    console.error('Failed to load categories', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 font-semibold text-xs">Failed to load categories.</td></tr>`;
    }
  }
}

function renderTable(cats) {
  const tbody = document.getElementById('admin-categories-tbody');
  if (!tbody) return;

  if (cats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-gray-400">
          <div class="space-y-2">
            <span class="text-3xl block">🏷️</span>
            <h4 class="font-bold text-gray-700 text-sm">No Categories Found</h4>
            <p class="text-xs text-gray-500">Create categories to structure your catalog.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cats.map(c => {
    const img = c.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80';
    let subdept = 'General Cosmetics';
    if (c.slug.includes('shoe')) subdept = 'Men, Women, Children Footwear';
    else if (c.slug.includes('spa')) subdept = 'Nails, Massage, Makeup, Facial Rituals';
    else if (c.slug.includes('skin')) subdept = 'Face Serums & Cleansers';
    else if (c.slug.includes('lip')) subdept = 'Balms, Oils & Lipsticks';
    else if (c.slug.includes('fragrance')) subdept = 'Eau de Parfum & Perfumes';

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td class="p-3.5">
          <img src="${img}" alt="${c.name}" class="w-10 h-10 object-cover rounded-lg bg-gray-100 border border-gray-200">
        </td>
        <td class="p-3.5 font-bold text-gray-900">${c.name}</td>
        <td class="p-3.5 font-mono text-gray-500">${c.slug}</td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-semibold rounded-full border border-amber-200">
            ${subdept}
          </span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button data-edit-cat="${c.id}" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 font-semibold text-[11px] rounded-lg transition-colors">Edit</button>
          <button data-delete-cat="${c.id}" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] rounded-lg transition-colors">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-cat]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-edit-cat');
      const cat = categories.find(c => c.id === id);
      if (cat) openModal(cat);
    });
  });

  tbody.querySelectorAll('[data-delete-cat]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-delete-cat');
      const cat = categories.find(c => c.id === id);

      const confirmed = await UI.showConfirm({
        title: 'Delete Category',
        message: `Are you sure you want to delete category "${cat ? cat.name : 'this category'}"?`,
        confirmText: 'Delete Category',
        danger: true
      });

      if (confirmed) {
        UI.setButtonLoading(e.currentTarget, true, 'Deleting...');
        try {
          await http.delete(`/api/admin/categories/${id}`);
          UI.showToast(`Category "${cat ? cat.name : ''}" deleted.`, "Deleted", "success");
          await loadCategories();
        } catch (err) {
          UI.showToast(err.message || 'Failed to delete category', "Delete Error", "error");
        } finally {
          UI.setButtonLoading(e.currentTarget, false);
        }
      }
    });
  });
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

function setupEventListeners() {
  document.getElementById('open-add-cat-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('close-cat-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-cat-modal')?.addEventListener('click', closeModal);

  const form = document.getElementById('cat-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInlineErrors();

      const id = document.getElementById('cat-id').value;
      const nameEl = document.getElementById('cat-form-name');
      const slugEl = document.getElementById('cat-form-slug');
      const submitBtn = form.querySelector('button[type="submit"]');

      const name = nameEl.value.trim();
      const slug = slugEl.value.trim();
      const image_url = document.getElementById('cat-form-image').value.trim();

      let isValid = true;
      if (!name) {
        showInlineError(nameEl, 'Category name is required.');
        isValid = false;
      }

      if (!isValid) return;

      UI.setButtonLoading(submitBtn, true, 'Saving...');

      try {
        if (id) {
          await http.put(`/api/admin/categories/${id}`, { name, slug, image_url });
          UI.showToast(`Category "${name}" updated.`, "Category Saved", "success");
        } else {
          await http.post('/api/admin/categories', { name, slug, image_url });
          UI.showToast(`Category "${name}" created.`, "Category Created", "success");
        }
        closeModal();
        await loadCategories();
      } catch (err) {
        UI.showToast(err.message || 'Failed to save category', "Save Error", "error");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }
}

function openModal(cat = null) {
  clearInlineErrors();
  document.getElementById('cat-id').value = cat ? cat.id : '';
  document.getElementById('cat-form-name').value = cat ? cat.name : '';
  document.getElementById('cat-form-slug').value = cat ? cat.slug : '';
  document.getElementById('cat-form-image').value = cat ? (cat.image_url || '') : '';
  document.getElementById('cat-modal-title').textContent = cat ? 'Edit Category' : 'Add New Category';
  document.getElementById('cat-modal-backdrop')?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('cat-modal-backdrop')?.classList.add('hidden');
}
