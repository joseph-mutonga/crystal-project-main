/**
 * Crystal Crest - Shared In-Memory Products Store
 * Ensures Admin product updates & stock changes immediately reflect on the Customer Storefront.
 */

const INITIAL_PRODUCTS = [
  {
    id: "prod-gold-serum-001",
    name: "Celestial Rose 24K Gold Youth Serum",
    category_id: "cat-skincare-001",
    category_name: "Skincare",
    price: 14500.00,
    buying_price: 6500.00,
    rating: 4.9,
    review_count: 128,
    is_bestseller: true,
    is_new: false,
    images: ["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80"],
    sizes: ["30 ml / 1.0 fl oz", "50 ml / 1.7 fl oz"],
    colors: [],
    stock_quantity: 45,
    is_active: true,
    description: "An elixir infused with pure 24K gold flakes, Damask rose extract, and triple-hyaluronic complex."
  },
  {
    id: "prod-lip-elixir-002",
    name: "Velvet Satin Lip Elixir - Royal Plum",
    category_id: "cat-lipcare-002",
    category_name: "Lip Care",
    price: 4800.00,
    buying_price: 1800.00,
    rating: 4.8,
    review_count: 94,
    is_bestseller: true,
    is_new: true,
    images: ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80"],
    sizes: ["4.5 g / 0.15 oz"],
    colors: ["Royal Plum", "Dusty Rose", "Crimson Majesty"],
    stock_quantity: 80,
    is_active: true,
    description: "Deeply nourishing hybrid lipstick oil that delivers rich velvet color with intense hydration."
  },
  {
    id: "prod-oud-perfume-004",
    name: "Imperial Oud & Rose Eau de Parfum",
    category_id: "cat-fragrance-003",
    category_name: "Fragrance",
    price: 22000.00,
    buying_price: 9500.00,
    rating: 4.9,
    review_count: 215,
    is_bestseller: true,
    is_new: false,
    images: ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80"],
    sizes: ["50 ml", "100 ml"],
    colors: [],
    stock_quantity: 25,
    is_active: true,
    description: "An opulent fragrance blending rare Cambodian agarwood, Bulgarian rose, and warm amber resin."
  },
  // SHOES
  {
    id: "prod-shoe-men-01",
    name: "Imperial Italian Leather Oxfords",
    category_id: "cat-shoes-005",
    category_name: "Luxury Shoes",
    target_group: "Men",
    price: 28000.00,
    buying_price: 12000.00,
    rating: 4.9,
    review_count: 42,
    is_bestseller: true,
    is_new: false,
    images: ["https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80"],
    sizes: ["EU 40 / US 7.5", "EU 41 / US 8.5", "EU 42 / US 9", "EU 44 / US 10.5"],
    colors: ["Mahogany Brown", "Midnight Black", "Cognac Tan"],
    stock_quantity: 20,
    is_active: true,
    description: "Handcrafted Italian calfskin leather dress shoes featuring Goodyear welt construction and mahogany shine."
  },
  {
    id: "prod-shoe-women-02",
    name: "Starlight Satin Crystal Heels",
    category_id: "cat-shoes-005",
    category_name: "Luxury Shoes",
    target_group: "Women",
    price: 32000.00,
    buying_price: 14000.00,
    rating: 5.0,
    review_count: 56,
    is_bestseller: true,
    is_new: true,
    images: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80"],
    sizes: ["EU 36 / US 6", "EU 37 / US 6.5", "EU 38 / US 7.5", "EU 40 / US 9"],
    colors: ["Rose Gold", "Ivory Pearl", "Champagne Gold"],
    stock_quantity: 18,
    is_active: true,
    description: "Haute couture satin stiletto pumps adorned with Swarovski crystal brooches and cushioned soft leather insoles."
  },
  {
    id: "prod-shoe-child-03",
    name: "Petite Gold Velvet Party Slippers",
    category_id: "cat-shoes-005",
    category_name: "Luxury Shoes",
    target_group: "Children",
    price: 9500.00,
    buying_price: 3800.00,
    rating: 4.8,
    review_count: 29,
    is_bestseller: false,
    is_new: true,
    images: ["https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80"],
    sizes: ["Kid US 10", "Kid US 12", "Kid US 2"],
    colors: ["Blush Pink", "Royal Navy", "Metallic Gold"],
    stock_quantity: 30,
    is_active: true,
    description: "Adorable luxury velvet dress shoes for kids with non-slip leather soles and gold buckle embellishments."
  },
  // SPA SERVICES
  {
    id: "prod-spa-nails-01",
    name: "24K Gold Gel Manicure & Hand Ritual",
    category_id: "cat-spa-006",
    category_name: "Spa & Beauty Services",
    spa_type: "Nails",
    price: 8500.00,
    buying_price: 2500.00,
    rating: 4.9,
    review_count: 78,
    is_bestseller: true,
    is_new: false,
    images: ["https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80"],
    sizes: ["60 Min Session"],
    colors: [],
    stock_quantity: 100,
    is_active: true,
    description: "Luxurious hand soak, gold flake scrub, nail shaping, gel polish, and warm botanical oil hand massage."
  },
  {
    id: "prod-spa-massage-02",
    name: "Aromatherapy Damask Rose Body Massage",
    category_id: "cat-spa-006",
    category_name: "Spa & Beauty Services",
    spa_type: "Massage",
    price: 15000.00,
    buying_price: 4500.00,
    rating: 5.0,
    review_count: 112,
    is_bestseller: true,
    is_new: false,
    images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80"],
    sizes: ["60 Min Session", "90 Min Session"],
    colors: [],
    stock_quantity: 100,
    is_active: true,
    description: "Full body tension release massage using warm organic Bulgarian rose oil and heated volcanic basalt stones."
  }
];

let productsStore = [...INITIAL_PRODUCTS];

module.exports = {
  getProducts() {
    return productsStore;
  },
  getProductById(id) {
    return productsStore.find(p => p.id === id);
  },
  addProduct(prod) {
    productsStore.unshift(prod);
    return prod;
  },
  updateProduct(id, updatedFields) {
    const idx = productsStore.findIndex(p => p.id === id);
    if (idx > -1) {
      productsStore[idx] = { ...productsStore[idx], ...updatedFields };
      return productsStore[idx];
    }
    return null;
  },
  deleteProduct(id) {
    productsStore = productsStore.filter(p => p.id !== id);
  }
};
