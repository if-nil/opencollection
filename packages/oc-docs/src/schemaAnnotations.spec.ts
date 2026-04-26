import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

const openCollectionSchema = JSON.parse(
  readFileSync(
    new URL('../../oc-schema/src/opencollection.schema.json', import.meta.url),
    'utf8'
  )
);

describe('OpenCollection schema raw body annotations', () => {
  it('accepts field annotations on JSON raw bodies', () => {
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(openCollectionSchema);

    const collection = {
      opencollection: '1.0.0',
      info: {
        name: 'Annotated API'
      },
      items: [
        {
          info: {
            name: 'Create User',
            type: 'http'
          },
          http: {
            method: 'POST',
            url: 'https://api.example.com/users',
            body: {
              type: 'json',
              data: JSON.stringify({
                user: {
                  name: 'Alice'
                },
                items: [
                  {
                    price: 12.5
                  }
                ]
              }),
              annotations: {
                user: {
                  dataType: 'object',
                  description: 'User object'
                },
                'user.name': {
                  dataType: 'string',
                  description: {
                    content: 'The user display name',
                    type: 'text/markdown'
                  }
                },
                'items[]': {
                  dataType: 'object',
                  description: 'One item in the order'
                },
                'items[].price': {
                  dataType: 'number',
                  description: 'Unit price for the item'
                },
                legacyString: 'Legacy string annotation',
                legacyStructuredText: {
                  content: 'The user display name',
                  type: 'text/markdown'
                }
              }
            }
          }
        }
      ]
    };

    expect(validate(collection), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});
