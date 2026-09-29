-- =========================================================
-- CHITWAN WOOD CRAFT — D1 SQL SCHEMA
-- =========================================================

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,               -- e.g. 'furniture', 'bedroom', 'kitchen', 'decor', 'handicraft', 'architectural'
  name TEXT NOT NULL,                -- e.g. 'Living & Dining'
  blurb TEXT,                        -- Short blurb
  note TEXT,                         -- Joinery/craftsmanship note
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,               -- Unique identifier (e.g. 'f1' or UUID)
  category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,                -- e.g. 'Chitwan Coffee Table'
  slug TEXT UNIQUE NOT NULL,         -- e.g. 'chitwan-coffee-table'
  short_description TEXT,            -- Brief description for cards / listings
  full_description TEXT,             -- Detailed craftsmanship description
  wood_type TEXT NOT NULL,           -- e.g. 'Sal', 'Teak', 'Sisau', 'Pine'
  finish TEXT NOT NULL,              -- e.g. 'Natural oil', 'Matte lacquer'
  dimensions TEXT NOT NULL,          -- e.g. '120 × 60 × 45 cm'
  price INTEGER NOT NULL,            -- Price in NPR
  price_note TEXT,                   -- e.g. '/ running ft'
  tag TEXT,                          -- 'Bestseller', 'Signature', or NULL
  status TEXT DEFAULT 'published',   -- 'published', 'draft', 'archived'
  is_featured INTEGER DEFAULT 0,     -- 1 = Featured on Homepage
  display_order INTEGER DEFAULT 0,
  primary_image_url TEXT,            -- Path/URL or SVG icon name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCT IMAGES TABLE (Multi-image support)
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,               -- UUID
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,              -- Key in R2 bucket
  image_url TEXT NOT NULL,           -- Public or API streaming URL
  alt_text TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
