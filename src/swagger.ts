import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Škoda Transportation IPS Integration API',
      version: '1.0.0',
      description: 'API for S1000D linking and S2000M provisioning data import.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    components: {
      schemas: {
        S2000MPart: {
          type: 'object',
          required: ['partNumber', 'description'],
          properties: {
            partNumber: {
              type: 'string',
              minLength: 3,
              description: 'Part number (at least 3 characters)',
              example: 'BP-109E-001',
            },
            description: {
              type: 'string',
              description: 'Part description',
              example: 'Brake Pad, disc brake, front axle',
            },
            unitOfMeasure: {
              type: 'string',
              default: 'PC',
              description: 'Unit of measure (optional, default PC)',
            },
            quantity: {
              type: 'number',
              minimum: 1,
              default: 1,
              description: 'Quantity (positive number, default 1)',
            },
          },
        },
        S2000MImportBody: {
          type: 'object',
          required: ['parts'],
          properties: {
            parts: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/S2000MPart' },
              description: 'At least one part is required',
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, 'routes', `*.${__dirname.includes('dist') ? 'js' : 'ts'}`)],
};

const swaggerSpec = swaggerJsdoc(options);
export { swaggerSpec, swaggerSpec as specs };
