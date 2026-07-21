import request from 'supertest';
import app from '../src/app';
import * as db from './helpers/db';
import { User, UserRole } from '../src/models/user.model';
import { Product } from '../src/models/product.model';
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
  const token = signToken({ sub: user.id, role: user.role });
  return { user, token };
}

const sampleProduct = { name: 'Test Widget', price: 19.99, stock: 10, category: 'gadgets' };

describe('Products — create (admin only)', () => {
  it('admin can create a product (201)', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleProduct);

    expect(res.status).toBe(201);
    expect(res.body.data.product.name).toBe('Test Widget');
    expect(res.body.data.product.category).toBe('gadgets');
    expect(res.body.data.product.id).toEqual(expect.any(String));
  });

  it('customer cannot create a product (403)', async () => {
    const { token } = await makeUser('customer', 'cust@example.com');
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleProduct);

    expect(res.status).toBe(403);
  });

  it('unauthenticated request cannot create a product (401)', async () => {
    const res = await request(app).post('/api/v1/products').send(sampleProduct);
    expect(res.status).toBe(401);
  });

  it('rejects invalid product data (400)', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', price: -5, stock: 1.5 }); // empty name, negative price, non-integer stock

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Products — list (public, pagination + filtering)', () => {
  beforeEach(async () => {
    await Product.insertMany([
      { name: 'A', price: 10, stock: 5, category: 'electronics' },
      { name: 'B', price: 20, stock: 5, category: 'electronics' },
      { name: 'C', price: 30, stock: 5, category: 'kitchen' },
      { name: 'D', price: 40, stock: 5, category: 'kitchen' },
      { name: 'E', price: 50, stock: 5, category: 'home' },
    ]);
  });

  it('returns a paginated list with pagination meta (200, no auth needed)', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(5);
    expect(res.body.meta.totalPages).toBe(3);
    expect(res.body.meta.hasNextPage).toBe(true);
    expect(res.body.meta.hasPrevPage).toBe(false);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/v1/products?category=kitchen');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((p: { category: string }) => p.category === 'kitchen')).toBe(true);
  });

  it('filters by price range', async () => {
    const res = await request(app).get('/api/v1/products?minPrice=20&maxPrice=40');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3); // 20, 30, 40
  });

  it('rejects invalid query parameters (400)', async () => {
    const res = await request(app).get('/api/v1/products?page=0');
    expect(res.status).toBe(400);
  });
});

describe('Products — get by id', () => {
  it('returns a product (200)', async () => {
    const product = await Product.create(sampleProduct);
    const res = await request(app).get(`/api/v1/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.product.id).toBe(product.id);
  });

  it('returns 404 for a non-existent (but valid) id', async () => {
    const res = await request(app).get('/api/v1/products/6a5e61d8d8fc9709046d5236');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/v1/products/not-a-valid-id');
    expect(res.status).toBe(400);
  });
});

describe('Products — update & delete (admin only)', () => {
  it('admin can replace a product (200)', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const product = await Product.create(sampleProduct);
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Widget', price: 99.99, stock: 10, category: 'gadgets' });

    expect(res.status).toBe(200);
    expect(res.body.data.product.price).toBe(99.99);
  });

  it('rejects a partial PUT body (400) — full representation required', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const product = await Product.create(sampleProduct);
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 99.99 }); // missing name / stock / category

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('customer cannot replace a product (403)', async () => {
    const { token } = await makeUser('customer', 'cust@example.com');
    const product = await Product.create(sampleProduct);
    const res = await request(app)
      .put(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', price: 99.99, stock: 5, category: 'gadgets' });

    expect(res.status).toBe(403);
  });

  it('admin can delete a product (200), and it is then gone (404)', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const product = await Product.create(sampleProduct);

    const del = await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const get = await request(app).get(`/api/v1/products/${product.id}`);
    expect(get.status).toBe(404);
  });

  it('customer cannot delete a product (403)', async () => {
    const { token } = await makeUser('customer', 'cust@example.com');
    const product = await Product.create(sampleProduct);
    const res = await request(app)
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when replacing a non-existent product', async () => {
    const { token } = await makeUser('admin', 'admin@example.com');
    const res = await request(app)
      .put('/api/v1/products/6a5e61d8d8fc9709046d5236')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', price: 5, stock: 1, category: 'x' });

    expect(res.status).toBe(404);
  });
});
