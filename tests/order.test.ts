import request from 'supertest';
import app from '../src/app';
import * as db from './helpers/db';
import { User, UserRole } from '../src/models/user.model';
import { Product } from '../src/models/product.model';
import { Order } from '../src/models/order.model';
import { signToken } from '../src/utils/jwt';

beforeAll(async () => {
  await db.connect();
}, 120000);

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.close();
});

async function makeUser(role: UserRole, email: string) {
  const user = await User.create({ name: role, email, password: 'password123', role });
  return { user, token: signToken({ sub: user.id, role: user.role }) };
}

function makeProduct(overrides: Partial<{ name: string; price: number; stock: number; category: string }> = {}) {
  return Product.create({ name: 'Widget', price: 10, stock: 100, category: 'gadgets', ...overrides });
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Orders — creation', () => {
  it('places an order, decrements stock, snapshots price, computes total (201)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ price: 10, stock: 5 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.order.totalAmount).toBe(20);
    expect(res.body.data.order.items[0].priceAtPurchase).toBe(10);
    expect(res.body.data.order.items[0].quantity).toBe(2);
    expect(res.body.data.order.status).toBe('pending');

    const fresh = await Product.findById(product.id);
    expect(fresh!.stock).toBe(3);
  });

  it('handles a multi-product order', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const a = await makeProduct({ name: 'A', price: 5, stock: 10 });
    const b = await makeProduct({ name: 'B', price: 8, stock: 10 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.order.totalAmount).toBe(2 * 5 + 3 * 8);
    expect((await Product.findById(a.id))!.stock).toBe(8);
    expect((await Product.findById(b.id))!.stock).toBe(7);
  });

  it('aggregates duplicate line items for the same product', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 5 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 2 }, { productId: product.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect((await Product.findById(product.id))!.stock).toBe(1); // 5 - (2 + 2)
  });

  it('rejects when aggregated duplicates exceed stock (409), stock unchanged', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 3 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 2 }, { productId: product.id, quantity: 2 }] });

    expect(res.status).toBe(409);
    expect((await Product.findById(product.id))!.stock).toBe(3);
  });

  it('rejects insufficient stock (409) and leaves stock unchanged', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 1 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 5 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect((await Product.findById(product.id))!.stock).toBe(1);
  });

  it('rejects a non-existent product (404)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: '6a5e61d8d8fc9709046d5236', quantity: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects invalid quantity (400)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct();
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty order (400)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const res = await request(app).post('/api/v1/orders').set(bearer(token)).send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('is all-or-nothing: a failing line rolls back earlier decrements', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const a = await makeProduct({ name: 'A', stock: 5 });
    const b = await makeProduct({ name: 'B', stock: 1 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 5 }] });

    expect(res.status).toBe(409);
    // A must NOT have been decremented — the transaction rolled back.
    expect((await Product.findById(a.id))!.stock).toBe(5);
    expect((await Product.findById(b.id))!.stock).toBe(1);
    expect(await Order.countDocuments()).toBe(0); // no partial order persisted
  });

  it('requires authentication (401)', async () => {
    const product = await makeProduct();
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(401);
  });
});

describe('Orders — concurrency (race condition)', () => {
  it('never oversells stock under many simultaneous orders', async () => {
    const { token } = await makeUser('customer', 'racer@example.com');
    const product = await makeProduct({ stock: 10 });

    const CONCURRENT = 20; // twice the available stock
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        request(app)
          .post('/api/v1/orders')
          .set(bearer(token))
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      )
    );

    const created = results.filter((r) => r.status === 201).length;
    const conflicts = results.filter((r) => r.status === 409).length;

    // Exactly the available stock succeeds; the rest are cleanly rejected.
    expect(created).toBe(10);
    expect(conflicts).toBe(10);
    // Stock is never oversold / never negative.
    expect((await Product.findById(product.id))!.stock).toBe(0);
  }, 30000);
});

describe('Orders — listing & ownership', () => {
  it('customers see only their own orders; admins see all', async () => {
    const c1 = await makeUser('customer', 'c1@example.com');
    const c2 = await makeUser('customer', 'c2@example.com');
    const admin = await makeUser('admin', 'admin@example.com');
    const product = await makeProduct({ stock: 100 });

    const place = (token: string) =>
      request(app).post('/api/v1/orders').set(bearer(token)).send({ items: [{ productId: product.id, quantity: 1 }] });

    await place(c1.token);
    await place(c1.token);
    await place(c2.token);

    const c1List = await request(app).get('/api/v1/orders').set(bearer(c1.token));
    expect(c1List.status).toBe(200);
    expect(c1List.body.meta.total).toBe(2);

    const adminList = await request(app).get('/api/v1/orders').set(bearer(admin.token));
    expect(adminList.body.meta.total).toBe(3);
  });

  it('a customer cannot view another customer’s order (404); an admin can (200)', async () => {
    const c1 = await makeUser('customer', 'c1@example.com');
    const c2 = await makeUser('customer', 'c2@example.com');
    const admin = await makeUser('admin', 'admin@example.com');
    const product = await makeProduct({ stock: 10 });

    const created = await request(app)
      .post('/api/v1/orders')
      .set(bearer(c1.token))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    const asOther = await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(c2.token));
    expect(asOther.status).toBe(404);

    const asAdmin = await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(admin.token));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.order.id).toBe(orderId);
  });

  it('supports pagination and status filtering', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 100 });
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/v1/orders').set(bearer(token)).send({ items: [{ productId: product.id, quantity: 1 }] });
    }

    const page1 = await request(app).get('/api/v1/orders?page=1&limit=2').set(bearer(token));
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.total).toBe(3);

    const pending = await request(app).get('/api/v1/orders?status=pending').set(bearer(token));
    expect(pending.body.meta.total).toBe(3);
    const cancelled = await request(app).get('/api/v1/orders?status=cancelled').set(bearer(token));
    expect(cancelled.body.meta.total).toBe(0);
  });
});

describe('Orders — cancellation', () => {
  it('cancels an order and restores stock atomically (200)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 5 });

    const created = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 3 }] });
    const orderId = created.body.data.order.id;
    expect((await Product.findById(product.id))!.stock).toBe(2);

    const cancel = await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.order.status).toBe('cancelled');
    expect((await Product.findById(product.id))!.stock).toBe(5); // restored
  });

  it('cannot cancel an already-cancelled order (409)', async () => {
    const { token } = await makeUser('customer', 'c@example.com');
    const product = await makeProduct({ stock: 5 });
    const created = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(token));
    const again = await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(token));
    expect(again.status).toBe(409);
  });

  it('a customer cannot cancel another customer’s order (404)', async () => {
    const c1 = await makeUser('customer', 'c1@example.com');
    const c2 = await makeUser('customer', 'c2@example.com');
    const product = await makeProduct({ stock: 5 });
    const created = await request(app)
      .post('/api/v1/orders')
      .set(bearer(c1.token))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    const res = await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(c2.token));
    expect(res.status).toBe(404);
    // stock not restored, since cancellation was rejected
    expect((await Product.findById(product.id))!.stock).toBe(4);
  });
});
