import request from 'supertest';
import app from '../src/app';
import * as db from './helpers/db';

beforeAll(async () => {
  await db.connect();
}, 120000);

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.close();
});

const validUser = { name: 'Alice', email: 'alice@example.com', password: 'password123' };

describe('Auth — signup', () => {
  it('creates a customer and returns a token (201)', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.role).toBe('customer');
  });

  it('never returns the password hash', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(validUser);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('rejects a duplicate email (409)', async () => {
    await request(app).post('/api/v1/auth/signup').send(validUser);
    const res = await request(app).post('/api/v1/auth/signup').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid input with a structured 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('ignores a client-supplied role — cannot self-register as admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...validUser, role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('customer');
  });
});

describe('Auth — login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/signup').send(validUser);
  });

  it('returns a token for valid credentials (200)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('rejects a wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
  });
});

describe('Auth — GET /me', () => {
  it('requires authentication (401 without a token)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token (200)', async () => {
    const signupRes = await request(app).post('/api/v1/auth/signup').send(validUser);
    const { token } = signupRes.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
  });
});
