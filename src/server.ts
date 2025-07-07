#!/usr/bin/env node

/**
 * Twenty MCP Server
 * Main entry point for the MCP server that integrates with Twenty CRM
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { TwentyClient } from './twenty-client/index.js';

class TwentyMCPServer {
  private server: Server;
  private twentyClient: TwentyClient;

  constructor() {
    this.server = new Server(
      {
        name: 'twenty-crm-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.twentyClient = new TwentyClient({
      apiUrl: config.TWENTY_API_URL,
      apiKey: config.TWENTY_API_KEY,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Twenty MCP Server...');
    
    try {
      // Validate Twenty connection
      await this.twentyClient.validateConnection();
      
      // Register MCP tools, resources, and prompts
      this.registerTools();
      this.registerResources();
      this.registerPrompts();
      
      logger.info('Twenty MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Twenty MCP Server:', error);
      throw error;
    }
  }

  private registerTools(): void {
    // Register MCP tools for Twenty CRM
    logger.debug('Registering MCP tools...');
    
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_companies',
            description: 'Search for companies in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for company name or domain'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10
                }
              },
              required: ['query']
            }
          },
          {
            name: 'search_people',
            description: 'Search for people/contacts in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for person name or email'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10
                }
              },
              required: ['query']
            }
          },
          {
            name: 'create_company',
            description: 'Create a new company in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Company name'
                },
                domainName: {
                  type: 'string',
                  description: 'Company domain name'
                },
                address: {
                  type: 'string',
                  description: 'Company address'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'create_person',
            description: 'Create a new person/contact in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                firstName: {
                  type: 'string',
                  description: 'First name'
                },
                lastName: {
                  type: 'string',
                  description: 'Last name'
                },
                email: {
                  type: 'string',
                  description: 'Email address'
                },
                phone: {
                  type: 'string',
                  description: 'Phone number'
                },
                companyId: {
                  type: 'string',
                  description: 'ID of the company this person belongs to'
                }
              },
              required: ['firstName', 'lastName']
            }
          },
          {
            name: 'get_opportunities',
            description: 'Get opportunities/deals from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                stage: {
                  type: 'string',
                  description: 'Filter by opportunity stage'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10
                }
              }
            }
          },
          {
            name: 'get_crm_analytics',
            description: 'Get analytics and metrics from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                metric: {
                  type: 'string',
                  description: 'Type of metric to retrieve',
                  enum: ['companies_count', 'people_count', 'opportunities_count', 'revenue_summary']
                },
                timeframe: {
                  type: 'string',
                  description: 'Time frame for the analytics',
                  enum: ['week', 'month', 'quarter', 'year'],
                  default: 'month'
                }
              },
              required: ['metric']
            }
          }
        ]
      };
    });

    // Call a tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'search_companies':
            const companies = await this.twentyClient.searchCompanies(
              String(args?.query || ''), 
              Number(args?.limit || 10)
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${companies.length} companies:\n${companies.map(c => `• ${c.name} (${c.domainName || 'No domain'})`).join('\n')}`
                }
              ]
            };

          case 'search_people':
            const people = await this.twentyClient.searchPeople(
              String(args?.query || ''), 
              Number(args?.limit || 10)
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${people.length} people:\n${people.map(p => `• ${p.firstName} ${p.lastName} (${p.email || 'No email'})`).join('\n')}`
                }
              ]
            };

          case 'create_company':
            if (!args?.name) {
              throw new Error('Company name is required');
            }
            const companyData: any = { name: String(args.name) };
            if (args.domainName) companyData.domainName = String(args.domainName);
            if (args.address) companyData.address = String(args.address);
            
            const newCompany = await this.twentyClient.createCompany(companyData);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Company "${newCompany.name}" created successfully with ID: ${newCompany.id}`
                }
              ]
            };

          case 'create_person':
            if (!args?.firstName || !args?.lastName) {
              throw new Error('First name and last name are required');
            }
            const personData: any = {
              firstName: String(args.firstName),
              lastName: String(args.lastName)
            };
            if (args.email) personData.email = String(args.email);
            if (args.phone) personData.phone = String(args.phone);
            if (args.companyId) personData.companyId = String(args.companyId);
            
            const newPerson = await this.twentyClient.createPerson(personData);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Person "${newPerson.firstName} ${newPerson.lastName}" created successfully with ID: ${newPerson.id}`
                }
              ]
            };

          case 'get_opportunities':
            const opportunitiesFilter: any = { limit: Number(args?.limit || 10) };
            if (args?.stage) opportunitiesFilter.stage = String(args.stage);
            
            const opportunities = await this.twentyClient.getOpportunities(opportunitiesFilter);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${opportunities.length} opportunities:\n${opportunities.map(o => `• ${o.name} - ${o.stage} (${o.amount ? `$${o.amount}` : 'No amount'})`).join('\n')}`
                }
              ]
            };

          case 'get_crm_analytics':
            if (!args?.metric) {
              throw new Error('Metric type is required');
            }
            const analytics = await this.twentyClient.getAnalytics(
              String(args.metric), 
              String(args?.timeframe || 'month')
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `📊 ${args.metric} Analytics (${args?.timeframe || 'month'}):\n${JSON.stringify(analytics, null, 2)}`
                }
              ]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private registerResources(): void {
    // TODO: Register MCP resources
    logger.debug('Registering MCP resources...');
    
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'twenty://server/status',
            name: 'Server Status',
            description: 'Current status of the Twenty MCP server',
            mimeType: 'application/json'
          },
          {
            uri: 'twenty://crm/config',
            name: 'CRM Configuration',
            description: 'Twenty CRM configuration information',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Read a resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      switch (uri) {
        case 'twenty://server/status':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'running',
                  port: config.MCP_SERVER_PORT,
                  uptime: process.uptime(),
                  memory: process.memoryUsage(),
                  timestamp: new Date().toISOString()
                }, null, 2)
              }
            ]
          };
          
        case 'twenty://crm/config':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  apiUrl: config.TWENTY_API_URL,
                  hasApiKey: !!config.TWENTY_API_KEY,
                  logLevel: config.LOG_LEVEL,
                  cacheEnabled: config.CACHE_ENABLED
                }, null, 2)
              }
            ]
          };
          
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  private registerPrompts(): void {
    // TODO: Register MCP prompts
    logger.debug('Registering MCP prompts...');
    
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'crm_analysis',
            description: 'Analyze CRM data and provide insights',
            arguments: [
              {
                name: 'data_type',
                description: 'Type of CRM data to analyze',
                required: true
              },
              {
                name: 'period',
                description: 'Time period for analysis',
                required: false
              }
            ]
          }
        ]
      };
    });

    // Get a prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'crm_analysis':
          const dataType = args?.data_type || 'general';
          const period = args?.period || 'last_30_days';
          
          return {
            description: 'CRM Analysis Prompt',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please analyze the ${dataType} data from our Twenty CRM for the ${period} period. Provide insights on trends, patterns, and actionable recommendations.`
                }
              }
            ]
          };
          
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  async runStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Twenty MCP Server is running (stdio)');
  }

  async runHttp(): Promise<void> {
    const app = express();
    app.use(express.json());

    // Store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    // Serve static HTML page
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Twenty MCP Server</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              border-bottom: 2px solid #007acc;
              padding-bottom: 0.5rem;
            }
            .status {
              background: #e8f5e8;
              border: 1px solid #4caf50;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
            }
            .endpoint {
              background: #f0f7ff;
              border: 1px solid #007acc;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
            }
            code {
              background: #f4f4f4;
              padding: 0.2rem 0.4rem;
              border-radius: 3px;
              font-family: 'Monaco', 'Menlo', monospace;
            }
            .config {
              background: #fff8dc;
              border: 1px solid #daa520;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
            }
            ul { line-height: 1.6; }
            li { margin-bottom: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Twenty MCP Server</h1>
            
            <div class="status">
              ✅ <strong>Сервер работает!</strong><br>
              Порт: ${config.MCP_SERVER_PORT}<br>
              Twenty API: ${config.TWENTY_API_URL}
            </div>

            <h2>📡 Эндпоинты MCP</h2>
            
            <div class="endpoint">
              <strong>MCP Protocol:</strong><br>
              <code>POST http://localhost:${config.MCP_SERVER_PORT}/mcp</code><br>
              <small>Основной эндпоинт для MCP клиентов</small>
            </div>

            <h2>🔧 Подключение к Claude Desktop</h2>
            
            <div class="config">
              Добавьте в <code>claude_desktop_config.json</code>:
              <pre><code>{
  "mcpServers": {
    "twenty-crm": {
      "command": "node",
      "args": ["${process.cwd()}/dist/server.js", "--mode", "stdio"],
      "env": {
        "TWENTY_API_URL": "${config.TWENTY_API_URL}",
        "TWENTY_API_KEY": "your-api-key-here"
      }
    }
  }
}</code></pre>
            </div>

            <h2>🌐 HTTP Клиенты</h2>
            
            <div class="config">
              Для HTTP MCP клиентов используйте:
              <pre><code>const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:${config.MCP_SERVER_PORT}/mcp")
);</code></pre>
            </div>

            <h2>🛠️ Доступные инструменты MCP</h2>
            <ul>
              <li><strong>search_companies</strong> - Поиск компаний в CRM</li>
              <li><strong>search_people</strong> - Поиск контактов/людей</li>
              <li><strong>create_company</strong> - Создание новой компании</li>
              <li><strong>create_person</strong> - Создание нового контакта</li>
              <li><strong>get_opportunities</strong> - Получение сделок/возможностей</li>
              <li><strong>get_crm_analytics</strong> - Аналитика и метрики CRM</li>
            </ul>

            <h2>📚 Ресурсы</h2>
            <ul>
              <li><strong>Server Status:</strong> Статус MCP сервера</li>
              <li><strong>CRM Configuration:</strong> Конфигурация Twenty CRM</li>
            </ul>

            <h2>🤖 Промпты</h2>
            <ul>
              <li><strong>crm_analysis:</strong> Анализ CRM данных с AI</li>
            </ul>

            <h2>🔍 Дополнительная информация</h2>
            <ul>
              <li><strong>Логи:</strong> <code>npm run twenty:logs</code></li>
              <li><strong>Статус:</strong> <code>npm run twenty:status</code></li>
              <li><strong>API Discovery:</strong> <code>npm run discover</code></li>
            </ul>
          </div>
        </body>
        </html>
      `);
    });

    // MCP endpoint
    app.all('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId || req.method === 'POST') {
          // New session
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              transports[sessionId] = transport;
              logger.debug(`New MCP session initialized: ${sessionId}`);
            },
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
              logger.debug(`MCP session closed: ${transport.sessionId}`);
            }
          };

          // Create and connect new server instance for this session
          const serverInstance = new TwentyMCPServer();
          await serverInstance.initialize();
          await serverInstance.server.connect(transport);
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Invalid session',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'twenty-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Start HTTP server
    app.listen(config.MCP_SERVER_PORT, () => {
      logger.info(`Twenty MCP Server HTTP interface available at:`);
      logger.info(`  🌐 Web interface: http://localhost:${config.MCP_SERVER_PORT}`);
      logger.info(`  📡 MCP endpoint: http://localhost:${config.MCP_SERVER_PORT}/mcp`);
      logger.info(`  ❤️  Health check: http://localhost:${config.MCP_SERVER_PORT}/health`);
    });
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TwentyMCPServer();
  const mode = process.argv.includes('--mode=http') || process.argv.includes('http') ? 'http' : 'stdio';
  
  server
    .initialize()
    .then(() => {
      if (mode === 'http') {
        return server.runHttp();
      } else {
        return server.runStdio();
      }
    })
    .catch((error) => {
      logger.error('Server startup failed:', error);
      process.exit(1);
    });
}

export { TwentyMCPServer };