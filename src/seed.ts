/**
 * Idempotent seed script. Creates a documented admin account (so reviewers can
 * test admin-only endpoints immediately) plus a few sample products.
 *
 * Run:  npm run seed            (compiled: node dist/seed.js)
 *       npm run seed:dev        (TypeScript directly via tsx)
 *   in Docker: docker compose exec app npm run seed
 */
import env from './config/env';
import logger from './utils/logger';
import { connectDB, disconnectDB } from './config/db';
import { User } from './models/user.model';
import { Product } from './models/product.model';
import { invalidateProductListCache } from './services/product.service';

const SAMPLE_PRODUCTS = [
  { name: 'Wireless Mouse', price: 25.99, stock: 100, category: 'electronics' },
  { name: 'Mechanical Keyboard', price: 79.99, stock: 50, category: 'electronics' },
  { name: 'Coffee Mug', price: 9.99, stock: 200, category: 'kitchen' },
  { name: 'Notebook', price: 4.5, stock: 500, category: 'stationery' },
  { name: 'Desk Lamp', price: 34.0, stock: 30, category: 'home' },
];

async function seed(): Promise<void> {
  await connectDB();

  // --- Admin (idempotent) ---
  let admin = await User.findOne({ email: env.ADMIN_EMAIL });
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD, // hashed by the model's pre-save hook
      role: 'admin',
    });
    logger.info(`Created admin account: ${env.ADMIN_EMAIL}`);
  } else {
    logger.info(`Admin account already exists: ${env.ADMIN_EMAIL}`);
  }

  // --- Sample products (only if the catalog is empty) ---
  const existingCount = await Product.countDocuments();
  if (existingCount === 0) {
    await Product.insertMany(SAMPLE_PRODUCTS);
    logger.info(`Inserted ${SAMPLE_PRODUCTS.length} sample products`);
  } else {
    logger.info(`Products already present (${existingCount}) — skipping sample insert`);
  }

  // Reflect the seeded catalog in any cached product list.
  await invalidateProductListCache();

  // Print the admin credentials so a reviewer can log in immediately.
  console.log(
    `\n✅ Seed complete.\n   Admin login:  email="${env.ADMIN_EMAIL}"  password="${env.ADMIN_PASSWORD}"\n`
  );

  await disconnectDB();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exit(1);
  });
