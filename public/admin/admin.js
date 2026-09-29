/**
 * Chitwan Wood Craft — Admin Portal Controller
 * Full CRUD, Image Uploader, Filtering, and Live Sync
 */

(function () {
  'use strict';

  // State
  let products = [];
  let categories = [];
  let currentEditingId = null;
  let currentUploadedImages = [];
  let deleteTargetId = null;

  // DOM Elements
  const tbody = document.getElementById('products-tbody');
  const searchInput = document.getElementById('admin-search');
  const catFilter = document.getElementById('filter-category');
  const statusFilter = document.getElementById('filter-status');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnCreate = document.getElementById('btn-create-product');
  const userEmailEl = document.getElementById('user-email');

  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statPublished = document.getElementById('stat-published');
  const statDrafts = document.getElementById('stat-drafts');
  const statFeatured = document.getElementById('stat-featured');

  // Modal Elements
  const editorModal = document.getElementById('editor-modal');
  const editorTitle = document.getElementById('editor-title');
  const editorClose = document.getElementById('editor-close');
  const btnCancel = document.getElementById('btn-cancel');
  const productForm = document.getElementById('product-form');

  // Delete Modal
  const deleteModal = document.getElementById('delete-modal');
  const deleteMessage = document.getElementById('delete-message');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  // Uploader Elements
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('file-input');
  const galleryPreview = document.getElementById('image-gallery-preview');

  // Form Fields
  const fId = document.getElementById('prod-id');
  const fName = document.getElementById('prod-name');
  const fCategory = document.getElementById('prod-category');
  const fSlug = document.getElementById('prod-slug');
  const fWood = document.getElementById('prod-wood');
  const fFinish = document.getElementById('prod-finish');
  const fDims = document.getElementById('prod-dims');
  const fPrice = document.getElementById('prod-price');
  const fUnit = document.getElementById('prod-unit');
  const fTag = document.getElementById('prod-tag');
  const fStatus = document.getElementById('prod-status');
  const fFeatured = document.getElementById('prod-featured');
  const fShortDesc = document.getElementById('prod-short-desc');
  const fFullDesc = document.getElementById('prod-full-desc');

  // Utility helpers
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const money = n => 'NPR ' + Number(n || 0).toLocaleString('en-IN');

  function toast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast show';
    if (isError) t.style.borderColor = '#ef4444';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  // 1. Check Authentication Status
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        userEmailEl.textContent = data.email || 'Authorized Administrator';
      } else {
        userEmailEl.textContent = 'Unauthorized Session';
      }
    } catch (e) {
      userEmailEl.textContent = 'Admin Mode';
    }
  }

  // 2. Load Categories
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        categories = await res.json();
        
        // Populate filter
        catFilter.innerHTML = '<option value="all">All Catalogues</option>' +
          categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

        // Populate form category select
        fCategory.innerHTML = categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  // 3. Load Products
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Fetching product catalog…</td></tr>';
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        products = await res.json();
        updateStats();
        renderProductsTable();
      } else {
        const err = await res.json().catch(() => ({}));
        tbody.innerHTML = `<tr><td colspan="9" class="table-loading" style="color:#ef4444">Failed to load products: ${esc(err.error || res.statusText)}</td></tr>`;
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      tbody.innerHTML = `<tr><td colspan="9" class="table-loading" style="color:#ef4444">Connection error. Is Cloudflare Worker running?</td></tr>`;
    }
  }

  // 4. Update Stats Cards
  function updateStats() {
    statTotal.textContent = products.length;
    statPublished.textContent = products.filter(p => p.status === 'published').length;
    statDrafts.textContent = products.filter(p => p.status === 'draft').length;
    statFeatured.textContent = products.filter(p => p.is_featured === 1).length;
  }

  // 5. Render Products Table with Search & Filter
  function renderProductsTable() {
    const q = searchInput.value.trim().toLowerCase();
    const cat = catFilter.value;
    const stat = statusFilter.value;

    let filtered = products.filter(p => {
      if (cat !== 'all' && p.catId !== cat) return false;
      if (stat !== 'all' && p.status !== stat) return false;
      if (q) {
        const hay = (p.name + ' ' + (p.wood || '') + ' ' + (p.finish || '') + ' ' + (p.catName || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No matching products found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isImg = p.icon && (p.icon.includes('/') || p.icon.includes('.'));
      const thumbHtml = isImg
        ? `<img src="${p.icon.startsWith('/') || p.icon.startsWith('http') ? esc(p.icon) : '/img/' + esc(p.icon)}" alt="${esc(p.name)}">`
        : `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/></svg>`;

      return `
        <tr data-id="${esc(p.id)}">
          <td><div class="table-thumb">${thumbHtml}</div></td>
          <td>
            <strong>${esc(p.name)}</strong>
            ${p.tag ? `<br><small class="badge badge-cat">${esc(p.tag)}</small>` : ''}
          </td>
          <td><span class="badge badge-cat">${esc(p.catName || p.catId)}</span></td>
          <td>${esc(p.wood)} · <small style="color:var(--muted)">${esc(p.finish)}</small></td>
          <td>${esc(p.dims)}</td>
          <td><strong>${money(p.price)}</strong>${p.unit ? ` <small>${esc(p.unit)}</small>` : ''}</td>
          <td>
            <span class="badge ${p.status === 'published' ? 'badge-published' : 'badge-draft'}">
              ${esc(p.status)}
            </span>
          </td>
          <td style="text-align:center;">
            ${p.is_featured ? `<span class="featured-star" title="Featured on Home">★</span>` : `<span style="color:#cbd5e1">-</span>`}
          </td>
          <td style="text-align: right;">
            <div class="action-btns">
              <button class="btn-icon btn-edit" data-id="${esc(p.id)}" title="Edit product">✎</button>
              <button class="btn-icon btn-delete" data-id="${esc(p.id)}" title="Delete product">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 6. Editor Modal Operations
  function openEditor(product = null) {
    productForm.reset();
    currentEditingId = product ? product.id : null;
    currentUploadedImages = [];

    if (product) {
      editorTitle.textContent = 'Edit Product';
      fId.value = product.id;
      fName.value = product.name || '';
      fCategory.value = product.catId || (categories[0] ? categories[0].id : '');
      fSlug.value = product.slug || '';
      fWood.value = product.wood || '';
      fFinish.value = product.finish || '';
      fDims.value = product.dims || '';
      fPrice.value = product.price || '';
      fUnit.value = product.unit || '';
      fTag.value = product.tag || '';
      fStatus.value = product.status || 'published';
      fFeatured.checked = !!product.is_featured;
      fShortDesc.value = product.short_description || '';
      fFullDesc.value = product.full_description || '';

      // If product has an image or images array
      if (Array.isArray(product.images) && product.images.length > 0) {
        currentUploadedImages = product.images.slice();
      } else if (product.icon && (product.icon.includes('/') || product.icon.includes('.'))) {
        currentUploadedImages.push({
          id: 'primary',
          image_url: product.icon.startsWith('/') || product.icon.startsWith('http') ? product.icon : '/img/' + product.icon,
          r2_key: ''
        });
      }
    } else {
      editorTitle.textContent = 'Add New Product';
      fId.value = '';
      fStatus.value = 'published';
      fFeatured.checked = false;
      if (categories.length > 0) fCategory.value = categories[0].id;
    }

    renderGalleryPreview();
    editorModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeEditor() {
    editorModal.classList.remove('open');
    document.body.style.overflow = '';
    currentEditingId = null;
    currentUploadedImages = [];
  }

  // 7. Image Upload Logic (Cloudflare R2 Direct Stream)
  function renderGalleryPreview() {
    if (currentUploadedImages.length === 0) {
      galleryPreview.innerHTML = '';
      return;
    }

    galleryPreview.innerHTML = currentUploadedImages.map((img, idx) => `
      <div class="preview-item">
        <img src="${esc(img.image_url)}" alt="Preview ${idx + 1}">
        <button type="button" class="preview-remove" data-idx="${idx}" title="Remove photo">✕</button>
        ${idx === 0 ? '<span class="preview-primary-badge">Primary</span>' : ''}
      </div>
    `).join('');

    galleryPreview.querySelectorAll('.preview-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        currentUploadedImages.splice(idx, 1);
        renderGalleryPreview();
      });
    });
  }

  async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast(`File "${file.name}" exceeds 5MB limit.`, true);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (currentEditingId) formData.append('productId', currentEditingId);

      toast(`Uploading ${file.name} to R2…`);

      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const uploaded = await res.json();
          currentUploadedImages.push({
            id: uploaded.id,
            r2_key: uploaded.r2_key,
            image_url: uploaded.image_url,
            alt_text: file.name
          });
          renderGalleryPreview();
          toast(`Uploaded ${file.name} successfully!`);
        } else {
          const err = await res.json().catch(() => ({}));
          toast(`Upload error: ${err.error || res.statusText}`, true);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        toast(`Upload failed for ${file.name}`, true);
      }
    }
  }

  // Dropzone drag & drop events
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    handleFileUpload(e.target.files);
    fileInput.value = '';
  });

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  });

  // 8. Form Submission (Create or Update Product)
  productForm.addEventListener('submit', async e => {
    e.preventDefault();

    const saveBtn = document.getElementById('btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const payload = {
      name: fName.value.trim(),
      category_id: fCategory.value,
      slug: fSlug.value.trim() || undefined,
      wood_type: fWood.value.trim(),
      finish: fFinish.value.trim(),
      dimensions: fDims.value.trim(),
      price: parseInt(fPrice.value, 10),
      price_note: fUnit.value.trim() || null,
      tag: fTag.value || null,
      status: fStatus.value,
      is_featured: fFeatured.checked ? 1 : 0,
      short_description: fShortDesc.value.trim() || null,
      full_description: fFullDesc.value.trim() || null,
      primary_image_url: currentUploadedImages.length > 0 ? currentUploadedImages[0].image_url : null,
      images: currentUploadedImages
    };

    try {
      const isEdit = !!currentEditingId;
      const url = isEdit ? `/api/admin/products/${encodeURIComponent(currentEditingId)}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast(`Product "${payload.name}" saved successfully!`);
        closeEditor();
        await loadProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(`Error saving product: ${err.error || res.statusText}`, true);
      }
    } catch (err) {
      console.error('Failed to save product:', err);
      toast('Network error saving product.', true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Product';
    }
  });

  // 9. Delete Confirmation & Execution
  function openDeleteModal(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    deleteTargetId = id;
    deleteMessage.textContent = `Are you sure you want to permanently delete "${prod.name}" (${prod.wood})? This will remove it from the database and Cloudflare R2 storage.`;
    deleteModal.classList.add('open');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('open');
    deleteTargetId = null;
  }

  btnConfirmDelete.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    btnConfirmDelete.disabled = true;
    btnConfirmDelete.textContent = 'Deleting…';

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(deleteTargetId)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast('Product deleted successfully.');
        closeDeleteModal();
        await loadProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(`Delete failed: ${err.error || res.statusText}`, true);
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast('Network error deleting product.', true);
    } finally {
      btnConfirmDelete.disabled = false;
      btnConfirmDelete.textContent = 'Delete Permanently';
    }
  });

  // Event Listeners
  btnCreate.addEventListener('click', () => openEditor(null));
  editorClose.addEventListener('click', closeEditor);
  btnCancel.addEventListener('click', closeEditor);
  btnCancelDelete.addEventListener('click', closeDeleteModal);

  editorModal.addEventListener('click', e => { if (e.target === editorModal) closeEditor(); });
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });

  searchInput.addEventListener('input', renderProductsTable);
  catFilter.addEventListener('change', renderProductsTable);
  statusFilter.addEventListener('change', renderProductsTable);
  btnRefresh.addEventListener('click', loadProducts);

  // Table action clicks (Delegated)
  tbody.addEventListener('click', e => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      const prod = products.find(p => p.id === editBtn.dataset.id);
      if (prod) openEditor(prod);
      return;
    }

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      openDeleteModal(delBtn.dataset.id);
      return;
    }
  });

  // Initialization
  async function init() {
    await checkAuth();
    await loadCategories();
    await loadProducts();
  }

  init();
})();
