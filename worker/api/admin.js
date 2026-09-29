/**
 * Admin API Handlers (Protected by Cloudflare Access)
 * Full CRUD, Image Upload to R2, Status Management, D1 Transactions
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*'
};

/**
 * Generate a clean URL-friendly slug from a product name
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/admin/products
 */
export async function handleAdminGetProducts(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');

    let sql = `
      SELECT 
        p.id, p.category_id as catId, c.name as catName,
        p.name, p.slug, p.short_description, p.full_description,
        p.wood_type as wood, p.finish, p.dimensions as dims,
        p.price, p.price_note as unit, p.tag, p.is_featured,
        p.primary_image_url as icon, p.status, p.display_order,
        p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) as image_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (category && category !== 'all') {
      sql += ` AND p.category_id = ?`;
      params.push(category);
    }

    if (status && status !== 'all') {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    if (q) {
      sql += ` AND (p.name LIKE ? OR p.wood_type LIKE ? OR p.finish LIKE ? OR c.name LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY p.display_order ASC, p.created_at DESC`;

    let stmt = env.DB.prepare(sql);
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const { results } = await stmt.all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error fetching admin products:', err);
    return new Response(JSON.stringify({ error: 'Database query failed: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * GET /api/admin/products/:id
 */
export async function handleAdminGetProductById(request, env, id) {
  try {
    const sql = `
      SELECT 
        p.id, p.category_id as catId, c.name as catName,
        p.name, p.slug, p.short_description, p.full_description,
        p.wood_type as wood, p.finish, p.dimensions as dims,
        p.price, p.price_note as unit, p.tag, p.is_featured,
        p.primary_image_url as icon, p.status, p.display_order,
        p.created_at, p.updated_at
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `;

    const product = await env.DB.prepare(sql).bind(id).first();
    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: JSON_HEADERS
      });
    }

    const images = await env.DB.prepare(`
      SELECT id, r2_key, image_url, alt_text, display_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY display_order ASC
    `).bind(product.id).all();

    product.images = images.results || [];

    return new Response(JSON.stringify(product), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error fetching admin product by ID:', err);
    return new Response(JSON.stringify({ error: 'Database error: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * POST /api/admin/products (Create Product)
 */
export async function handleAdminCreateProduct(request, env) {
  try {
    const data = await request.json();

    // Validation
    if (!data.name || !data.category_id || !data.wood_type || !data.finish || !data.dimensions || data.price === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required product fields (name, category_id, wood_type, finish, dimensions, price)' }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    const id = data.id || ('cw-' + Math.random().toString(36).substring(2, 9));
    const baseSlug = slugify(data.slug || data.name);
    let slug = baseSlug;

    // Check slug uniqueness
    const existingSlug = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
    if (existingSlug) {
      slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
    }

    const price = parseInt(data.price, 10) || 0;
    const is_featured = data.is_featured ? 1 : 0;
    const status = data.status || 'published';
    const primary_image_url = data.primary_image_url || (data.images && data.images[0] ? data.images[0].image_url : null) || 'box';

    const insertSql = `
      INSERT INTO products (
        id, category_id, name, slug, short_description, full_description,
        wood_type, finish, dimensions, price, price_note, tag, status,
        is_featured, display_order, primary_image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await env.DB.prepare(insertSql).bind(
      id,
      data.category_id,
      data.name.trim(),
      slug,
      data.short_description || null,
      data.full_description || null,
      data.wood_type.trim(),
      data.finish.trim(),
      data.dimensions.trim(),
      price,
      data.price_note || null,
      data.tag || null,
      status,
      is_featured,
      data.display_order || 0,
      primary_image_url
    ).run();

    // If initial images array passed, insert into product_images
    if (Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const imgId = img.id || ('img-' + Math.random().toString(36).substring(2, 9));
        await env.DB.prepare(`
          INSERT INTO product_images (id, product_id, r2_key, image_url, alt_text, display_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(imgId, id, img.r2_key || '', img.image_url, img.alt_text || data.name, i).run();
      }
    }

    return new Response(JSON.stringify({ success: true, id, slug }), {
      status: 201,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error creating product:', err);
    return new Response(JSON.stringify({ error: 'Failed to create product: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * PUT /api/admin/products/:id (Update Product)
 */
export async function handleAdminUpdateProduct(request, env, id) {
  try {
    const data = await request.json();

    const existing = await env.DB.prepare('SELECT id, primary_image_url FROM products WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: JSON_HEADERS
      });
    }

    let slug = data.slug ? slugify(data.slug) : undefined;
    if (slug) {
      const conflict = await env.DB.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(slug, id).first();
      if (conflict) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }
    }

    const price = data.price !== undefined ? parseInt(data.price, 10) : undefined;
    const is_featured = data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : undefined;

    const updateSql = `
      UPDATE products SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        short_description = COALESCE(?, short_description),
        full_description = COALESCE(?, full_description),
        wood_type = COALESCE(?, wood_type),
        finish = COALESCE(?, finish),
        dimensions = COALESCE(?, dimensions),
        price = COALESCE(?, price),
        price_note = ?,
        tag = ?,
        status = COALESCE(?, status),
        is_featured = COALESCE(?, is_featured),
        display_order = COALESCE(?, display_order),
        primary_image_url = COALESCE(?, primary_image_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await env.DB.prepare(updateSql).bind(
      data.category_id || null,
      data.name ? data.name.trim() : null,
      slug || null,
      data.short_description !== undefined ? data.short_description : null,
      data.full_description !== undefined ? data.full_description : null,
      data.wood_type ? data.wood_type.trim() : null,
      data.finish ? data.finish.trim() : null,
      data.dimensions ? data.dimensions.trim() : null,
      price !== undefined ? price : null,
      data.price_note !== undefined ? data.price_note : null,
      data.tag !== undefined ? data.tag : null,
      data.status || null,
      is_featured !== undefined ? is_featured : null,
      data.display_order !== undefined ? data.display_order : null,
      data.primary_image_url || null,
      id
    ).run();

    // If new image order or list is provided, synchronize product_images table
    if (Array.isArray(data.images)) {
      // Remove images not in the updated list
      const currentImages = await env.DB.prepare('SELECT id, r2_key FROM product_images WHERE product_id = ?').bind(id).all();
      const updatedImageIds = new Set(data.images.map(img => img.id).filter(Boolean));

      for (const img of (currentImages.results || [])) {
        if (!updatedImageIds.has(img.id)) {
          // Delete from R2 if bucket exists
          if (env.BUCKET && img.r2_key) {
            try { await env.BUCKET.delete(img.r2_key); } catch (e) {}
          }
          await env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(img.id).run();
        }
      }

      // Upsert / reorder images
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const imgId = img.id || ('img-' + Math.random().toString(36).substring(2, 9));
        await env.DB.prepare(`
          INSERT OR REPLACE INTO product_images (id, product_id, r2_key, image_url, alt_text, display_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(imgId, id, img.r2_key || '', img.image_url, img.alt_text || data.name, i).run();
      }
    }

    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error updating product:', err);
    return new Response(JSON.stringify({ error: 'Failed to update product: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * DELETE /api/admin/products/:id
 */
export async function handleAdminDeleteProduct(request, env, id) {
  try {
    const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: JSON_HEADERS
      });
    }

    // Delete associated images in R2
    const images = await env.DB.prepare('SELECT r2_key FROM product_images WHERE product_id = ?').bind(id).all();
    if (env.BUCKET && images.results) {
      for (const img of images.results) {
        if (img.r2_key) {
          try { await env.BUCKET.delete(img.r2_key); } catch (e) {}
        }
      }
    }

    // Delete from D1 (cascade cleans up product_images)
    await env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, deletedId: id }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete product: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * POST /api/admin/upload (Upload image to R2)
 * Supports Multipart Form Data or Binary Stream
 */
export async function handleAdminUploadImage(request, env) {
  try {
    if (!env.BUCKET) {
      return new Response(JSON.stringify({ error: 'R2 storage bucket is not configured' }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }

    const contentType = request.headers.get('Content-Type') || '';
    let fileBuffer, fileName, mimeType, productId;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      productId = formData.get('productId') || 'general';

      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'No file provided in form data' }), {
          status: 400,
          headers: JSON_HEADERS
        });
      }

      fileName = file.name || 'image.jpg';
      mimeType = file.type || 'image/jpeg';
      fileBuffer = await file.arrayBuffer();
    } else {
      // Direct binary upload
      productId = request.headers.get('X-Product-Id') || 'general';
      mimeType = contentType;
      fileName = request.headers.get('X-File-Name') || 'upload.jpg';
      fileBuffer = await request.arrayBuffer();
    }

    // MIME Type Validation
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      return new Response(JSON.stringify({ error: `Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WebP, AVIF.` }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Size limit: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (fileBuffer.byteLength > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'File size exceeds maximum allowed limit of 5MB' }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    // Generate safe unique key
    const ext = fileName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).substring(2, 9));
    const r2Key = `products/${productId}/${uniqueId}.${ext}`;

    // Upload to Cloudflare R2
    await env.BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    const imageUrl = `/api/media/${r2Key}`;

    // If a valid productId was provided and exists in DB, record in product_images
    let imageRecordId = 'img-' + uniqueId;
    if (productId && productId !== 'general') {
      try {
        await env.DB.prepare(`
          INSERT INTO product_images (id, product_id, r2_key, image_url, alt_text, display_order)
          VALUES (?, ?, ?, ?, ?, 99)
        `).bind(imageRecordId, productId, r2Key, imageUrl, fileName).run();
      } catch (e) {
        console.warn('Could not associate image with product record yet:', e.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      id: imageRecordId,
      r2_key: r2Key,
      image_url: imageUrl,
      fileName,
      size: fileBuffer.byteLength
    }), {
      status: 201,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error uploading image to R2:', err);
    return new Response(JSON.stringify({ error: 'Upload failed: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

/**
 * DELETE /api/admin/images/:id
 */
export async function handleAdminDeleteImage(request, env, imageId) {
  try {
    const img = await env.DB.prepare('SELECT id, product_id, r2_key FROM product_images WHERE id = ?').bind(imageId).first();
    if (!img) {
      return new Response(JSON.stringify({ error: 'Image record not found' }), {
        status: 404,
        headers: JSON_HEADERS
      });
    }

    if (env.BUCKET && img.r2_key) {
      try { await env.BUCKET.delete(img.r2_key); } catch (e) {}
    }

    await env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(imageId).run();

    return new Response(JSON.stringify({ success: true, deletedImageId: imageId }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error deleting image:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete image: ' + err.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
