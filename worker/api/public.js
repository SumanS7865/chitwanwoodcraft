/**
 * Public API Handlers (Read-only, high performance, edge-cache friendly)
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Access-Control-Allow-Origin': '*'
};

/**
 * GET /api/categories
 */
export async function handleGetCategories(request, env) {
  try {
    const query = `
      SELECT 
        c.id, c.name, c.blurb, c.note, c.display_order,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.status = 'published'
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `;
    const { results } = await env.DB.prepare(query).all();
    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return new Response(JSON.stringify({ error: 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/products
 * Query Params:
 *  - category: filter by category_id
 *  - featured: 1 or true to filter home featured items
 *  - q: search keyword
 *  - sort: 'price-asc', 'price-desc', 'name', 'featured'
 */
export async function handleGetProducts(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const featured = url.searchParams.get('featured');
    const q = url.searchParams.get('q');
    const sort = url.searchParams.get('sort');

    let sql = `
      SELECT 
        p.id, p.category_id as catId, c.name as catName, c.note as catNote,
        p.name, p.slug, p.short_description, p.full_description,
        p.wood_type as wood, p.finish, p.dimensions as dims,
        p.price, p.price_note as unit, p.tag, p.is_featured,
        p.primary_image_url as icon, p.status, p.display_order,
        p.created_at, p.updated_at
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
    `;

    const params = [];

    if (category && category !== 'all') {
      sql += ` AND p.category_id = ?`;
      params.push(category);
    }

    if (featured === '1' || featured === 'true') {
      sql += ` AND p.is_featured = 1`;
    }

    if (q) {
      sql += ` AND (p.name LIKE ? OR p.wood_type LIKE ? OR p.finish LIKE ? OR c.name LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    // Sort order
    if (sort === 'price-asc') {
      sql += ` ORDER BY p.price ASC`;
    } else if (sort === 'price-desc') {
      sql += ` ORDER BY p.price DESC`;
    } else if (sort === 'name') {
      sql += ` ORDER BY p.name ASC`;
    } else {
      sql += ` ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC`;
    }

    let stmt = env.DB.prepare(sql);
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const { results } = await stmt.all();

    // Fetch associated product images
    const productList = results || [];
    if (productList.length > 0) {
      const productIds = productList.map(p => `'${p.id}'`).join(',');
      const imgQuery = `
        SELECT product_id, id, r2_key, image_url, alt_text, display_order
        FROM product_images
        WHERE product_id IN (${productIds})
        ORDER BY display_order ASC
      `;
      const imgResult = await env.DB.prepare(imgQuery).all();
      const imagesByProduct = {};
      (imgResult.results || []).forEach(img => {
        if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
        imagesByProduct[img.product_id].push(img);
      });

      productList.forEach(p => {
        p.images = imagesByProduct[p.id] || [];
        if (p.images.length > 0 && !p.icon) {
          p.icon = p.images[0].image_url;
        }
      });
    }

    return new Response(JSON.stringify(productList), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return new Response(JSON.stringify({ error: 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/products/:id
 */
export async function handleGetProductById(request, env, id) {
  try {
    const sql = `
      SELECT 
        p.id, p.category_id as catId, c.name as catName, c.note as catNote,
        p.name, p.slug, p.short_description, p.full_description,
        p.wood_type as wood, p.finish, p.dimensions as dims,
        p.price, p.price_note as unit, p.tag, p.is_featured,
        p.primary_image_url as icon, p.status, p.display_order,
        p.created_at, p.updated_at
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE (p.id = ? OR p.slug = ?) AND p.status = 'published'
    `;

    const product = await env.DB.prepare(sql).bind(id, id).first();
    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
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
    console.error('Error fetching product by ID:', err);
    return new Response(JSON.stringify({ error: 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/media/*
 * Streams media from R2 bucket
 */
export async function handleGetMedia(request, env, key) {
  try {
    if (!env.BUCKET) {
      return new Response('R2 bucket binding not configured', { status: 500 });
    }

    const object = await env.BUCKET.get(key);
    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (err) {
    console.error('Error serving media from R2:', err);
    return new Response('Error retrieving media', { status: 500 });
  }
}
