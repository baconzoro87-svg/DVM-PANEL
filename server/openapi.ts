export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'DVM Panel — BusterNodes REST API',
    version: '1.0.0',
    description: `Official enterprise API specification for DVM Panel by BusterNodes.
Provides programmatically secured virtualization management, Docker container VM orchestration, granular RBAC permissions, and audit telemetry.

**Branding:** BusterNodes  
**Developer Credit:** Made by Azmal  
**Architecture:** Non-systemd micro-service & host Docker runtime  
**Base URL:** \`/api/v1\`

### Authentication
All requests to protected endpoints require an API key passed in the \`Authorization\` header:
\`\`\`http
Authorization: Bearer dvm_live_your_api_key_here
\`\`\`
`,
    contact: {
      name: 'BusterNodes Support (Made by Azmal)',
      url: 'https://busternodes.com'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current DVM Panel Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'dvm_live_*',
        description: 'Provide your BusterNodes API key starting with dvm_live_'
      }
    },
    schemas: {
      ApiResponseSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string', example: 'Request completed successfully' }
        }
      },
      ApiResponseError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string', example: 'Invalid or missing API key' },
              details: { type: 'object' }
            }
          }
        }
      },
      VirtualMachine: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'vm-bn-01' },
          name: { type: 'string', example: 'dvm-prod-edge-01' },
          image: { type: 'string', example: 'ubuntu:24.04' },
          status: { type: 'string', enum: ['running', 'stopped', 'restarting', 'error'], example: 'running' },
          cpu: { type: 'integer', example: 4 },
          ram_mb: { type: 'integer', example: 8192 },
          disk_gb: { type: 'integer', example: 80 },
          ssh_port: { type: 'integer', example: 2201 },
          ip_address: { type: 'string', example: '172.28.0.10' },
          ports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                host: { type: 'integer', example: 8080 },
                guest: { type: 'integer', example: 80 },
                protocol: { type: 'string', example: 'tcp' }
              }
            }
          },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      CreateVmRequest: {
        type: 'object',
        required: ['name', 'image'],
        properties: {
          name: { type: 'string', example: 'dvm-app-worker', description: 'Unique VM hostname/name' },
          image: { type: 'string', example: 'ubuntu:24.04', description: 'Base OS container image' },
          cpu: { type: 'integer', minimum: 1, maximum: 64, default: 2 },
          ram_mb: { type: 'integer', minimum: 512, maximum: 131072, default: 2048 },
          disk_gb: { type: 'integer', minimum: 5, maximum: 2048, default: 20 },
          ssh_port: { type: 'integer', description: 'Optional custom SSH host port (allocated automatically if omitted)' },
          notes: { type: 'string', example: 'Microservices container' }
        }
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'key_prod_01' },
          name: { type: 'string', example: 'CI/CD Deploy Key' },
          key_prefix: { type: 'string', example: 'dvm_live_7a9f...b2c1' },
          permissions: {
            type: 'array',
            items: { type: 'string', example: 'vms.create' }
          },
          created_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          last_used_at: { type: 'string', format: 'date-time', nullable: true },
          is_revoked: { type: 'integer', example: 0 },
          description: { type: 'string' }
        }
      },
      CreateApiKeyRequest: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          name: { type: 'string', example: 'Production Microservice Worker' },
          permissions: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'vms.read', 'vms.create', 'vms.start', 'vms.stop', 'vms.restart', 'vms.delete',
                'images.read', 'usage.read', 'api.keys.read', 'api.keys.manage'
              ]
            }
          },
          expires_in_days: { type: 'integer', nullable: true, example: 90, description: 'Null or 0 for never expire' },
          description: { type: 'string', example: 'Integration with GitLab CI' }
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ],
  paths: {
    '/status': {
      get: {
        summary: 'Get System and Docker Virtualization Status',
        description: 'Returns live node telemetry, host uptime, Docker daemon connectivity, and BusterNodes platform information.',
        security: [],
        responses: {
          '200': {
            description: 'Node status retrieved successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseSuccess' } } }
          }
        }
      }
    },
    '/usage': {
      get: {
        summary: 'Get API Usage & Quota Metrics',
        description: 'Retrieves current API key request consumption, rate limit limits, and recent activity.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Usage details',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseSuccess' } } }
          },
          '401': { $ref: '#/components/schemas/ApiResponseError' }
        }
      }
    },
    '/vms': {
      get: {
        summary: 'List Virtual Machines',
        description: 'Returns all virtual machine instances owned by the authenticated account. Requires `vms.read` permission.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of virtual machines',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponseSuccess' } } }
          },
          '403': { description: 'Missing vms.read permission' }
        }
      },
      post: {
        summary: 'Provision Virtual Machine',
        description: 'Creates and launches a new Docker-based virtual machine with allocated ports and memory. Requires `vms.create` permission.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVmRequest' } } }
        },
        responses: {
          '201': { description: 'Virtual machine created successfully' },
          '400': { description: 'Validation error in request parameters' },
          '403': { description: 'Missing vms.create permission' }
        }
      }
    },
    '/vms/{id}': {
      get: {
        summary: 'Get Virtual Machine Details',
        description: 'Returns specs, status, and network bindings for a single VM owned by the authenticated user. Protected against IDOR.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Virtual machine found' },
          '404': { description: 'VM not found or not owned by user' }
        }
      },
      delete: {
        summary: 'Delete Virtual Machine',
        description: 'Permanently stops and destroys the container VM and frees its SSH port. Requires `vms.delete` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Virtual machine deleted' },
          '403': { description: 'Missing vms.delete permission' },
          '404': { description: 'VM not found' }
        }
      }
    },
    '/vms/{id}/start': {
      post: {
        summary: 'Start Virtual Machine',
        description: 'Powers on a stopped VM instance. Requires `vms.start` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'VM started successfully' },
          '403': { description: 'Missing vms.start permission' }
        }
      }
    },
    '/vms/{id}/stop': {
      post: {
        summary: 'Stop Virtual Machine',
        description: 'Sends graceful ACPI/SIGTERM stop command to VM. Requires `vms.stop` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'VM stopped successfully' },
          '403': { description: 'Missing vms.stop permission' }
        }
      }
    },
    '/vms/{id}/restart': {
      post: {
        summary: 'Restart Virtual Machine',
        description: 'Reboots VM instance. Requires `vms.restart` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'VM restarted successfully' },
          '403': { description: 'Missing vms.restart permission' }
        }
      }
    },
    '/images': {
      get: {
        summary: 'List Supported Operating System Images',
        description: 'Returns available OS container templates including Ubuntu 24.04 LTS, Debian 12, Alpine 3.20, Rocky Linux, and AlmaLinux. Requires `images.read` permission.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of images returned' }
        }
      }
    },
    '/api-keys': {
      get: {
        summary: 'List API Keys',
        description: 'Retrieves all API keys associated with the account (hashed secrets are never returned). Requires `api.keys.read` or `api.keys.manage`.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'API keys list' }
        }
      },
      post: {
        summary: 'Create New API Key',
        description: 'Generates a new cryptographically secure API key. The unhashed raw key is returned ONLY ONCE in the response. Requires `api.keys.manage` permission.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateApiKeyRequest' } } }
        },
        responses: {
          '201': { description: 'API key created. Store the raw key securely as it cannot be shown again.' }
        }
      }
    },
    '/api-keys/{id}/revoke': {
      post: {
        summary: 'Revoke API Key',
        description: 'Immediately deactivates an API key. Once revoked, the key will fail all future authentication attempts. Requires `api.keys.manage` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Key revoked successfully' }
        }
      }
    },
    '/api-keys/{id}/regenerate': {
      post: {
        summary: 'Regenerate API Key',
        description: 'Revokes the existing key and generates a brand new secret with the same permissions and name. Returns the raw secret once. Requires `api.keys.manage` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'New key generated and returned once.' }
        }
      }
    },
    '/api-keys/{id}': {
      delete: {
        summary: 'Delete API Key',
        description: 'Permanently removes an API key from the database. Requires `api.keys.manage` permission.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Key deleted successfully' }
        }
      }
    },
    '/logs': {
      get: {
        summary: 'Query API Activity Logs',
        description: 'Returns paginated and filterable HTTP request logs. Excludes all authorization secrets, passwords, and private tokens. Requires `api.keys.read` or `api.keys.manage`.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'endpoint', in: 'query', schema: { type: 'string' }, description: 'Filter by endpoint path' },
          { name: 'statusGroup', in: 'query', schema: { type: 'string', enum: ['all', '2xx', '4xx', '5xx'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'Logs retrieved' }
        }
      }
    }
  }
};
