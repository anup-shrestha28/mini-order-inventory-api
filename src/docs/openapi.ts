/**
 * Hand-written OpenAPI 3.0 spec, kept as data (not JSDoc comments) so it is
 * available in the compiled `dist` build too. New paths/schemas are added here
 * as each phase lands. Served as interactive Swagger UI at `/api/docs`.
 */
const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Mini Order & Inventory API',
    version: '1.0.0',
    description:
      'Backend for a small e-commerce operation — products, users, and orders — with concurrency-safe stock management.\n\n' +
      'To call protected endpoints: log in via `POST /auth/login` (or seed an admin with `npm run seed`), copy the `token`, ' +
      'click **Authorize** (top-right), and paste it.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Auth', description: 'Signup, login, and current user' },
    { name: 'Products', description: 'Product catalog — public reads, admin-only writes' },
    { name: 'Orders', description: 'Order placement, listing, and cancellation' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66b0f2a1c3d4e5f6a7b8c9d0' },
          name: { type: 'string', example: 'Alice' },
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          role: { type: 'string', enum: ['admin', 'customer'], example: 'customer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string', description: 'JWT access token' },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66b0f2a1c3d4e5f6a7b8c9d0' },
          name: { type: 'string', example: 'Wireless Mouse' },
          price: { type: 'number', example: 25.99 },
          stock: { type: 'integer', example: 100 },
          category: { type: 'string', example: 'electronics' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['name', 'price', 'stock', 'category'],
        properties: {
          name: { type: 'string', example: 'Wireless Mouse' },
          price: { type: 'number', minimum: 0, example: 25.99 },
          stock: { type: 'integer', minimum: 0, example: 100 },
          category: { type: 'string', example: 'electronics' },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 3 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false },
        },
      },
      ProductListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product id' },
          name: { type: 'string', example: 'Wireless Mouse' },
          priceAtPurchase: { type: 'number', example: 25.99 },
          quantity: { type: 'integer', example: 2 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          user: { type: 'string', description: 'User id (populated as {id,name,email} on reads)' },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          totalAmount: { type: 'number', example: 55.98 },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'], example: 'pending' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateOrderInput: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: '66b0f2a1c3d4e5f6a7b8c9d0' },
                quantity: { type: 'integer', minimum: 1, example: 2 },
              },
            },
          },
        },
      },
      OrderListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new customer (returns a JWT)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Alice' },
                  email: { type: 'string', format: 'email', example: 'alice@example.com' },
                  password: { type: 'string', format: 'password', minLength: 8, example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Customer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'alice@example.com' },
                  password: { type: 'string', format: 'password', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'The current user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                  },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (public, paginated + filterable)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', '-createdAt', 'price', '-price'], default: '-createdAt' } },
        ],
        responses: {
          200: { description: 'Paginated list of products', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } } } },
          400: { description: 'Invalid query parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
        responses: {
          201: { description: 'Product created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Not authenticated' },
          403: { description: 'Not an admin' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get a product by id (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'The product', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } } } },
          400: { description: 'Invalid id', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Product not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Update a product (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number', minimum: 0 },
                  stock: { type: 'integer', minimum: 0 },
                  category: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Product updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { product: { $ref: '#/components/schemas/Product' } } } } } } } },
          400: { description: 'Validation error / invalid id' },
          401: { description: 'Not authenticated' },
          403: { description: 'Not an admin' },
          404: { description: 'Product not found' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete a product (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Not an admin' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Place an order (authenticated)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderInput' } } } },
        responses: {
          201: { description: 'Order placed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { order: { $ref: '#/components/schemas/Order' } } } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Product not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Insufficient stock', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'List orders (own for customers, all for admins)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'createdAt >= from' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'createdAt <= to' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', '-createdAt', 'totalAmount', '-totalAmount'], default: '-createdAt' } },
        ],
        responses: {
          200: { description: 'Paginated orders', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderListResponse' } } } },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get an order by id (own for customers, any for admins)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'The order', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { order: { $ref: '#/components/schemas/Order' } } } } } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel an order and restore stock (own for customers, any for admins)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Order cancelled', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { order: { $ref: '#/components/schemas/Order' } } } } } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Order not found' },
          409: { description: 'Order already cancelled' },
        },
      },
    },
  },
};

export default openapiSpec;
