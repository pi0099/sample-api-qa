export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderInfo {
  orderId: string;
  status: OrderStatus;
  total: number;
  currency: string;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderInfoResponse {
  userId: string;
  email: string;
  orderCount: number;
  orders: OrderInfo[];
}

export interface OrderInfoInput {
  userId?: string;
  email?: string;
}

const PRODUCT_CATALOG: ReadonlyArray<{ sku: string; name: string; basePrice: number }> = [
  { sku: 'SKU-1001', name: 'Wireless Mouse', basePrice: 29.99 },
  { sku: 'SKU-1002', name: 'Mechanical Keyboard', basePrice: 89.99 },
  { sku: 'SKU-1003', name: 'USB-C Hub', basePrice: 45.5 },
  { sku: 'SKU-1004', name: '27-inch Monitor', basePrice: 249.0 },
  { sku: 'SKU-1005', name: 'Noise Cancelling Headphones', basePrice: 159.99 },
  { sku: 'SKU-1006', name: 'Webcam HD', basePrice: 69.99 },
  { sku: 'SKU-1007', name: 'Laptop Stand', basePrice: 39.99 },
  { sku: 'SKU-1008', name: 'Portable SSD 1TB', basePrice: 119.99 },
];

const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildSyntheticEmail(userId: string): string {
  const slug = userId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.');
  return `${slug || 'user'}@example.com`;
}

function buildSyntheticUserId(email: string): string {
  const localPart = normalizeEmail(email).split('@')[0] ?? 'user';
  return localPart.replace(/[^a-z0-9]+/gi, '-');
}

export function resolveOrderLookup(input: OrderInfoInput): {
  userId: string;
  email: string;
  seedKey: string;
} {
  const userId = input.userId?.trim();
  const email = input.email ? normalizeEmail(input.email) : undefined;

  if (!userId && !email) {
    throw new Error('Either userId or email is required');
  }

  if (userId && email) {
    return {
      userId,
      email,
      seedKey: `${userId}|${email}`,
    };
  }

  if (userId) {
    return {
      userId,
      email: buildSyntheticEmail(userId),
      seedKey: userId,
    };
  }

  return {
    userId: buildSyntheticUserId(email ?? 'user'),
    email: email ?? 'user@example.com',
    seedKey: email ?? 'user@example.com',
  };
}

function pickOrderStatus(random: () => number): OrderStatus {
  const index = Math.floor(random() * ORDER_STATUSES.length);
  return ORDER_STATUSES[index] ?? 'pending';
}

function buildOrderItems(random: () => number): OrderItem[] {
  const itemCount = 1 + Math.floor(random() * 3);
  const items: OrderItem[] = [];
  const usedSkus = new Set<string>();

  for (let index = 0; index < itemCount; index += 1) {
    let product = PRODUCT_CATALOG[Math.floor(random() * PRODUCT_CATALOG.length)];

    while (product && usedSkus.has(product.sku)) {
      product = PRODUCT_CATALOG[Math.floor(random() * PRODUCT_CATALOG.length)];
    }

    if (!product) {
      continue;
    }

    usedSkus.add(product.sku);

    const quantity = 1 + Math.floor(random() * 3);
    const priceVariance = 0.85 + random() * 0.3;

    items.push({
      sku: product.sku,
      name: product.name,
      quantity,
      unitPrice: roundMoney(product.basePrice * priceVariance),
    });
  }

  return items;
}

function buildCreatedAt(random: () => number): string {
  const daysAgo = Math.floor(random() * 90);
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(Math.floor(random() * 24), Math.floor(random() * 60), 0, 0);
  return date.toISOString();
}

function buildOrder(orderIndex: number, random: () => number): OrderInfo {
  const items = buildOrderItems(random);
  const total = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );

  const orderNumber = 100000 + Math.floor(random() * 899999);

  return {
    orderId: `ORD-${orderNumber}-${orderIndex + 1}`,
    status: pickOrderStatus(random),
    total,
    currency: 'USD',
    items,
    createdAt: buildCreatedAt(random),
  };
}

export function getOrderInfo(input: OrderInfoInput): OrderInfoResponse {
  const lookup = resolveOrderLookup(input);
  const random = createSeededRandom(hashString(lookup.seedKey));
  const orderCount = 1 + Math.floor(random() * 4);
  const orders: OrderInfo[] = [];

  for (let index = 0; index < orderCount; index += 1) {
    orders.push(buildOrder(index, random));
  }

  orders.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    userId: lookup.userId,
    email: lookup.email,
    orderCount: orders.length,
    orders,
  };
}
