-- =========================================================
-- CHITWAN WOOD CRAFT — D1 SEED DATA (MIGRATION OF 29 PRODUCTS)
-- =========================================================

-- Insert Categories
INSERT OR REPLACE INTO categories (id, name, blurb, note, display_order) VALUES
('furniture', 'Living & Dining', 'Solid-wood seating and tables built for daily life.', 'Mortise-and-tenon joinery keeps every frame rigid without metal fasteners.', 1),
('bedroom', 'Bedroom', 'Beds, wardrobes and storage with hand-finished edges.', 'Slatted bases and reinforced corners for years of daily use.', 2),
('kitchen', 'Kitchen & Dining', 'Food-safe bowls, boards and serving ware.', 'Finished with food-safe oil — re-oil once a year to keep the grain alive.', 3),
('decor', 'Home Décor', 'Carved panels, frames and accents for the walls.', 'Each piece is carved and sanded by hand, so no two are exactly alike.', 4),
('handicraft', 'Handicrafts & Gifts', 'Traditional Nepali carving, small and giftable.', 'Traditional Chitwan carving, made to be gifted and kept.', 5),
('architectural', 'Doors & Joinery', 'Carved doors, windows and structural joinery.', 'Made to your site measurements; installation available across Bagmati.', 6);

-- Insert Products
INSERT OR REPLACE INTO products (
  id, category_id, name, slug, short_description, full_description, wood_type, finish, dimensions, price, price_note, tag, status, is_featured, display_order, primary_image_url
) VALUES
-- Living & Dining
('f1', 'furniture', 'Pen Holder', 'pen-holder', 'Handcrafted solid Sal wood desk pen holder.', 'Turned and finished solid Sal wood desk accessory crafted to highlight natural grain patterns.', 'Sal', 'Natural oil', '180 × 90 × 76 cm', 68000, NULL, 'Bestseller', 'published', 1, 1, 'penholder.jpg'),
('f2', 'furniture', 'Teak Lounge Chair', 'teak-lounge-chair', 'Ergonomically angled solid Teak lounge chair.', 'Built with seasoned Teak and protected by a durable matte lacquer, engineered for deep comfort and lifelong durability.', 'Teak', 'Matte lacquer', '70 × 75 × 80 cm', 24500, NULL, NULL, 'published', 0, 2, 'chair'),
('f3', 'furniture', 'Handcarved Sofa Set (3+2)', 'handcarved-sofa-set-3-2', 'Signature handcarved Sal wood 5-seater sofa set.', 'Exquisitely carved with traditional motifs by master artisans in Bharatpur. Finished in a rich walnut stain with heavy-duty mortise-and-tenon joinery.', 'Sal', 'Walnut stain', '210 cm / 160 cm', 145000, NULL, 'Signature', 'published', 1, 3, 'sofa'),
('f4', 'furniture', 'Chitwan Coffee Table', 'chitwan-coffee-table', 'Centerpiece Sisau coffee table with natural edge.', 'Locally sourced seasoned Sisau timber displaying vivid grain contrast, coated with eco-friendly natural oils.', 'Sisau', 'Natural oil', '120 × 60 × 45 cm', 32000, NULL, NULL, 'published', 0, 4, 'table'),
('f5', 'furniture', 'Rocking Chair', 'rocking-chair', 'Traditional Teak rocking chair with hand-rubbed wax.', 'Balanced glide geometry with smooth hand-rubbed wax finish for relaxation.', 'Teak', 'Hand-rubbed wax', '65 × 90 × 100 cm', 27500, NULL, NULL, 'published', 0, 5, 'chair'),
('f6', 'furniture', 'Open Bookshelf', 'open-bookshelf', 'Multi-tier solid Pine shelving unit with honey wax finish.', 'Strong, lightweight seasoned Pine with honey wax protection for study and living rooms.', 'Pine', 'Honey wax', '90 × 30 × 180 cm', 38500, NULL, NULL, 'published', 0, 6, 'shelf'),

-- Bedroom
('b1', 'bedroom', 'Four-Poster Bed (Queen)', 'four-poster-bed-queen', 'Solid Sal four-poster queen bed with dark walnut tone.', 'Statement architectural bed frame built from kiln-dried Sal wood, slatted for standard queen mattresses with wobble-free joints.', 'Sal', 'Dark walnut', '210 × 160 cm', 165000, NULL, 'Signature', 'published', 1, 7, 'bed'),
('b2', 'bedroom', 'Two-Door Wardrobe', 'two-door-wardrobe', 'Spacious double wardrobe with internal shelving and hanging rod.', 'Built from kiln-seasoned Sal wood with matte PU coating, resistant to humidity and warping.', 'Sal', 'Matte PU', '120 × 60 × 200 cm', 92000, NULL, NULL, 'published', 0, 8, 'cabinet'),
('b3', 'bedroom', 'Bedside Table', 'bedside-table', 'Compact Teak nightstand with soft-slide drawer.', 'Minimalist bedside nightstand featuring solid Teak construction and natural oil treatment.', 'Teak', 'Natural oil', '45 × 40 × 55 cm', 14500, NULL, NULL, 'published', 0, 9, 'cabinet'),
('b4', 'bedroom', 'Dressing Table with Mirror', 'dressing-table-with-mirror', 'Sisau dressing console with clear reflection mirror frame.', 'Elegant dresser with storage drawers and matching framed mirror in a warm honey wax finish.', 'Sisau', 'Honey wax', '110 × 45 × 150 cm', 58000, NULL, NULL, 'published', 0, 10, 'mirror'),

-- Kitchen & Dining
('k1', 'kitchen', 'Chakati Bowl Set (4 pcs)', 'chakati-bowl-set-4-pcs', 'Food-grade Chakati wood nesting salad and serving bowls.', 'Carved from single blocks of Chakati wood and sealed with non-toxic food-safe botanical oils.', 'Chakati', 'Food-safe oil', '12–20 cm dia', 4800, NULL, NULL, 'published', 0, 11, 'bowl'),
('k2', 'kitchen', 'Teak Cutting Board', 'teak-cutting-board', 'End-grain Teak butcher block and prep board.', 'Naturally high in protective silica and oils, gentle on knife edges and built for years of chopping.', 'Teak', 'Food-safe oil', '40 × 25 × 2.5 cm', 2600, NULL, 'Bestseller', 'published', 0, 12, 'board'),
('k3', 'kitchen', 'Serving Tray with Handles', 'serving-tray-with-handles', 'Sisau wood tea and appetizer tray with ergonomic side grips.', 'Lightweight yet durable tray showcasing rich grain striations for hosting.', 'Sisau', 'Natural oil', '45 × 30 cm', 3200, NULL, NULL, 'published', 0, 13, 'tray'),
('k4', 'kitchen', 'Salad Server Pair', 'salad-server-pair', 'Hand-turned Teak salad fork and spoon set.', 'Smooth organic contours for tossing and serving fresh dishes.', 'Teak', 'Food-safe oil', '30 cm length', 1800, NULL, NULL, 'published', 0, 14, 'utensil'),
('k5', 'kitchen', 'Spice Box (Masala Dabba)', 'spice-box-masala-dabba', 'Traditional round wooden spice storage container with compartments.', 'Carved round container with fitted lid keeping aromatic spices fresh and dry.', 'Sisau', 'Natural oil', '22 cm dia', 3900, NULL, NULL, 'published', 0, 15, 'box'),

-- Home Décor
('d1', 'decor', 'Carved Wall Panel', 'carved-wall-panel', 'Intricate floral lattice wall relief carving in Sal wood.', 'Hand-chiseled by Chitwan artisans with antique staining, adding heritage texture to any feature wall.', 'Sal', 'Antique finish', '90 × 90 cm', 22000, NULL, 'Signature', 'published', 1, 16, 'panel'),
('d2', 'decor', 'Turned Wooden Vase', 'turned-wooden-vase', 'Lathe-turned Sisau dry floral display vase.', 'Sculptural silhouette highlighting natural growth rings and heartwood color.', 'Sisau', 'Matte lacquer', 'H 40 cm', 6500, NULL, NULL, 'published', 0, 17, 'vase'),
('d3', 'decor', 'Photo Frame Set (3 pcs)', 'photo-frame-set-3-pcs', 'Set of 3 tabletop / wall solid Teak picture frames.', 'Beveled Teak profiles with glass insert and easel backs for memories.', 'Teak', 'Natural oil', '5 × 7 in', 2800, NULL, NULL, 'published', 0, 18, 'frame'),
('d4', 'decor', 'Carved Table Lamp', 'carved-table-lamp', 'Pillar style carved Teak accent lamp base.', 'Traditional fluted carving with brass fitting and warm honey wax sheen.', 'Teak', 'Honey wax', 'H 45 cm', 7200, NULL, NULL, 'published', 0, 19, 'lamp'),
('d5', 'decor', 'Round Mirror Frame', 'round-mirror-frame', 'Turned solid Sal circular mirror with walnut stain.', 'Minimalist circular profile suited for entryways, bathrooms, or bedrooms.', 'Sal', 'Walnut stain', '60 cm dia', 9500, NULL, NULL, 'published', 0, 20, 'mirror'),

-- Handicrafts & Gifts
('h1', 'handicraft', 'Mandala Wall Art', 'mandala-wall-art', 'Sacred geometry mandala hand-painted on carved Sisau wood.', 'Precise relief carving with hand-applied mineral pigments celebrating Nepali artistic heritage.', 'Sisau', 'Hand-painted', '45 cm dia', 5400, NULL, NULL, 'published', 0, 21, 'mandala'),
('h2', 'handicraft', 'Pagoda Model', 'pagoda-model', 'Detailed multi-tiered Newari style pagoda architectural souvenir.', 'Scale model miniature featuring intricate eave struts and temple windows.', 'Sal', 'Natural', 'H 30 cm', 4200, NULL, NULL, 'published', 0, 22, 'pagoda'),
('h3', 'handicraft', 'Carved Elephant Pair', 'carved-elephant-pair', 'Chitwan wildlife-inspired pair of hand-carved Sal elephants.', 'Symbol of Chitwan National Park crafted from dense Sal timber with antique finish.', 'Sal', 'Antique', 'H 18 cm', 3600, NULL, 'Bestseller', 'published', 1, 23, 'elephant'),
('h4', 'handicraft', 'Jewellery Box with Brass Inlay', 'jewellery-box-with-brass-inlay', 'Sisau keepsake box with hand-inlaid floral brass wire.', 'Fitted brass latch and velvet lined interior for precious jewelry and keepsakes.', 'Sisau', 'Brass inlay', '20 × 15 × 10 cm', 4900, NULL, NULL, 'published', 0, 24, 'box'),
('h5', 'handicraft', 'Wooden Chess Set', 'wooden-chess-set', 'Weighted Teak and Sisau folding board with hand-carved pieces.', 'High-contrast wood tones with felted base pieces and secure latching interior.', 'Teak & Sisau', 'Polished', '40 × 40 cm', 8600, NULL, NULL, 'published', 0, 25, 'chess'),

-- Doors & Joinery
('a1', 'architectural', 'Handcarved Teak Door', 'handcarved-teak-door', 'Masterpiece entrance door with ornate traditional carvings.', 'Custom-built single or double leaf door made from thick seasoned Teak, featuring deity or floral carvings.', 'Teak', 'Natural oil', '210 × 90 cm', 185000, NULL, 'Signature', 'published', 1, 26, 'door'),
('a2', 'architectural', 'Newari Style Window', 'newari-style-window', 'Aki-Jhyal traditional lattice carved window frame.', 'Authentic Kathmandu Valley architectural woodwork crafted in solid Sal timber.', 'Sal', 'Carved', '120 × 90 cm', 74000, NULL, NULL, 'published', 0, 27, 'window'),
('a3', 'architectural', 'Staircase Railing', 'staircase-railing', 'Custom turned and carved solid Sal balustrades and handrails.', 'Engineered for stability and safety with classic turned balusters and smooth profiles.', 'Sal', 'Matte PU', 'Custom', 3500, '/ running ft', NULL, 'published', 0, 28, 'stair'),
('a4', 'architectural', 'Carved Ceiling Beam', 'carved-ceiling-beam', 'Decorative structural or faux Sal ceiling rafters and corbels.', 'Acanthus and lotus motifs carved along timber beams for luxury residential and hospitality projects.', 'Sal', 'Natural', 'Custom', 4200, '/ running ft', NULL, 'published', 0, 29, 'beam'),
('a5', 'architectural', 'Decorative Wooden Pillar', 'decorative-wooden-pillar', 'Heavy solid Sal veranda column with carved capital and base.', 'Load-bearing or decorative timber column crafted to heritage architectural specifications.', 'Sal', 'Antique', 'H 240 cm', 96000, NULL, NULL, 'published', 0, 30, 'pillar');
