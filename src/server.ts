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
            name: 'create_person_with_company',
            description: 'Create a new person/contact with automatic company lookup/creation',
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
                jobTitle: {
                  type: 'string',
                  description: 'Job title/position'
                },
                companyName: {
                  type: 'string',
                  description: 'Company name - will search for existing company or create new one'
                },
                companyDomain: {
                  type: 'string',
                  description: 'Company domain (optional, used if creating new company)'
                }
              },
              required: ['firstName', 'lastName', 'companyName']
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
          },
          {
            name: 'update_company',
            description: 'Update an existing company in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Company ID to update'
                },
                name: {
                  type: 'string',
                  description: 'New company name'
                },
                domainName: {
                  type: 'string',
                  description: 'New company domain name'
                },
                address: {
                  type: 'string',
                  description: 'New company address'
                },
                employees: {
                  type: 'number',
                  description: 'New number of employees'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'delete_company',
            description: 'Delete a company from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Company ID to delete'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'update_person',
            description: 'Update an existing person/contact in Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Person ID to update'
                },
                firstName: {
                  type: 'string',
                  description: 'New first name'
                },
                lastName: {
                  type: 'string',
                  description: 'New last name'
                },
                email: {
                  type: 'string',
                  description: 'New email address'
                },
                phone: {
                  type: 'string',
                  description: 'New phone number'
                },
                companyId: {
                  type: 'string',
                  description: 'New company ID this person belongs to'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'delete_person',
            description: 'Delete a person/contact from Twenty CRM',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Person ID to delete'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'get_schema_info',
            description: 'Get schema information for Twenty CRM objects and fields',
            inputSchema: {
              type: 'object',
              properties: {
                objectName: {
                  type: 'string',
                  description: 'Name of the object to get schema for (e.g., Company, Person). If not provided, returns all available objects.'
                },
                refresh: {
                  type: 'boolean',
                  description: 'Force refresh of schema cache',
                  default: false
                }
              }
            }
          },
          {
            name: 'advanced_search_people',
            description: 'Advanced search for people/contacts with flexible filters and field selection',
            inputSchema: {
              type: 'object',
              properties: {
                filters: {
                  type: 'object',
                  description: 'GraphQL filter object for complex searches. Examples: {"linkedinLink": {"primaryLinkUrl": {"neq": ""}}}, {"jobTitle": {"ilike": "%engineer%"}}, {"and": [{"city": {"equals": "NYC"}}, {"linkedinLink": {"primaryLinkUrl": {"neq": ""}}}]}'
                },
                fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of field names to include in results. Examples: ["firstName", "lastName", "email", "jobTitle", "linkedinLink", "city"]. If not specified, returns default fields.'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10
                }
              },
              required: ['filters']
            }
          },
          {
            name: 'advanced_search_companies',
            description: 'Advanced search for companies with flexible filters and field selection',
            inputSchema: {
              type: 'object',
              properties: {
                filters: {
                  type: 'object',
                  description: 'GraphQL filter object for complex searches. Examples: {"employees": {"gte": 100}}, {"linkedinLink": {"primaryLinkUrl": {"neq": ""}}}, {"and": [{"domainName": {"neq": ""}}, {"employees": {"gte": 50}}]}'
                },
                fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of field names to include in results. Examples: ["name", "domainName", "employees", "linkedinLink", "city"]. If not specified, returns default fields.'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10
                }
              },
              required: ['filters']
            }
          },
          {
            name: 'test_dynamic_query',
            description: 'Test dynamic GraphQL query generation for any object',
            inputSchema: {
              type: 'object',
              properties: {
                objectName: {
                  type: 'string',
                  description: 'Name of the object to test (e.g., Person, Company, Opportunity)',
                  default: 'Person'
                }
              }
            }
          },
          {
            name: 'debug_graphql_mutations',
            description: 'Debug GraphQL schema mutations to understand available create/update/delete operations',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
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

          case 'create_company':
            if (!args?.name) {
              throw new Error('Company name is required');
            }
            const companyData: any = { name: String(args.name) };
            if (args.domainName) companyData.domainName = String(args.domainName);
            if (args.address) companyData.address = String(args.address);
            
            const newCompany = await this.twentyClient.createCompany(companyData);
            
            if (!newCompany) {
              throw new Error('createCompany returned null/undefined');
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Company "${newCompany.name || 'UNKNOWN_NAME'}" created successfully with ID: ${newCompany.id || 'UNKNOWN_ID'}`
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

          case 'create_person_with_company':
            if (!args?.firstName || !args?.lastName || !args?.companyName) {
              throw new Error('First name, last name, and company name are required');
            }

            // Check for existing person with same email first
            if (args.email) {
              const existingPeople = await this.twentyClient.advancedSearchPeople({
                emails: { primaryEmail: { eq: String(args.email) } }
              }, 1);
              
              if (existingPeople.length > 0) {
                const existingPerson = existingPeople[0];
                if (existingPerson) {
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `⚠️ Person with email "${args.email}" already exists!\n` +
                              `👤 Existing: ${existingPerson.firstName || ''} ${existingPerson.lastName || ''}\n` +
                              `🆔 ID: ${existingPerson.id}\n` +
                              `📧 Email: ${existingPerson.email || args.email}\n\n` +
                              `💡 Use a different email or update the existing person instead.`
                      }
                    ]
                  };
                }
              }
            }

            const companyName = String(args.companyName);
            let companyId: string;
            let company: any;
            let isNewCompany = false;
            
            // 1. Search for existing company
            const existingCompanies = await this.twentyClient.advancedSearchCompanies({
              name: { ilike: `%${companyName}%` }
            }, 5);
            
            if (existingCompanies.length > 0) {
              // Use first matching company
              company = existingCompanies[0];
              companyId = company.id;
              console.log(`📋 Found existing company: "${company.name}" (ID: ${companyId})`);
            } else {
              // 2. Create new company if not found
              const newCompanyData: any = { name: companyName };
              if (args.companyDomain) newCompanyData.domainName = String(args.companyDomain);
              
              company = await this.twentyClient.createCompany(newCompanyData);
              companyId = company.id;
              isNewCompany = true;
              console.log(`🏢 Created new company: "${company.name}" (ID: ${companyId})`);
            }
            
            if (!company) {
              throw new Error('Failed to find or create company');
            }
            
            // 3. Create person with company link
            const smartPersonData: any = {
              firstName: String(args.firstName),
              lastName: String(args.lastName),
              companyId: companyId
            };
            if (args.email) smartPersonData.email = String(args.email);
            if (args.phone) smartPersonData.phone = String(args.phone);
            if (args.jobTitle) smartPersonData.jobTitle = String(args.jobTitle);
            
            console.log(`🔧 Creating person with data:`, smartPersonData);
            console.log(`🔧 TwentyClient available methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(this.twentyClient)));
            
            const smartNewPerson = await this.twentyClient.createPerson(smartPersonData);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Person "${smartNewPerson.firstName} ${smartNewPerson.lastName}" created successfully!\n` +
                        `👤 Person ID: ${smartNewPerson.id}\n` +
                        `🏢 Company: "${company.name}" (${isNewCompany ? 'newly created' : 'existing'})\n` +
                        `🔗 Company ID: ${companyId}` +
                        (args.jobTitle ? `\n💼 Job Title: ${args.jobTitle}` : '')
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

          case 'update_company':
            if (!args?.id) {
              throw new Error('Company ID is required');
            }
            const updateCompanyData: any = {};
            if (args.name) updateCompanyData.name = String(args.name);
            if (args.domainName) updateCompanyData.domainName = String(args.domainName);
            if (args.address) updateCompanyData.address = String(args.address);
            if (args.employees) updateCompanyData.employees = Number(args.employees);
            
            const updatedCompany = await this.twentyClient.updateCompany(String(args.id), updateCompanyData);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Company "${updatedCompany.name}" updated successfully (ID: ${updatedCompany.id})`
                }
              ]
            };

          case 'delete_company':
            if (!args?.id) {
              throw new Error('Company ID is required');
            }
            const deletedCompany = await this.twentyClient.deleteCompany(String(args.id));
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Company deleted successfully (ID: ${args.id})`
                }
              ]
            };

          case 'update_person':
            if (!args?.id) {
              throw new Error('Person ID is required');
            }
            const updatePersonData: any = {};
            if (args.firstName) updatePersonData.firstName = String(args.firstName);
            if (args.lastName) updatePersonData.lastName = String(args.lastName);
            if (args.email) updatePersonData.email = String(args.email);
            if (args.phone) updatePersonData.phone = String(args.phone);
            if (args.companyId) updatePersonData.companyId = String(args.companyId);
            
            const updatedPerson = await this.twentyClient.updatePerson(String(args.id), updatePersonData);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Person "${updatedPerson.firstName} ${updatedPerson.lastName}" updated successfully (ID: ${updatedPerson.id})`
                }
              ]
            };

          case 'delete_person':
            if (!args?.id) {
              throw new Error('Person ID is required');
            }
            const deletedPerson = await this.twentyClient.deletePerson(String(args.id));
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Person deleted successfully (ID: ${args.id})`
                }
              ]
            };

          case 'get_schema_info':
            const refresh = Boolean(args?.refresh);
            const objectName = args?.objectName ? String(args.objectName) : null;
            
            if (objectName) {
              // Get schema for specific object
              const fields = await this.twentyClient.schema.getObjectFields(objectName);
              
              if (fields.length === 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `⚠️ Object "${objectName}" not found in schema or has no fields.\n\nUse get_schema_info() without parameters to see all available objects.`
                    }
                  ]
                };
              }
              
              const fieldsInfo = fields.map(field => ({
                name: field.name,
                type: field.type,
                nullable: field.isNullable,
                array: field.isArray,
                description: field.description
              }));
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `📋 Schema for ${objectName}:\n\n` +
                          `Fields (${fieldsInfo.length}):\n` +
                          fieldsInfo.map(f => 
                            `• ${f.name}: ${f.type}${f.array ? '[]' : ''}${f.nullable ? '?' : ''} ${f.description ? `- ${f.description}` : ''}`
                          ).join('\n')
                  }
                ]
              };
            } else {
              // Get all available objects
              try {
                const objects = await this.twentyClient.schema.getAvailableObjects();
                const schemaInfo = await this.twentyClient.schema.getSchema(refresh);
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: `📋 Twenty CRM Schema Information:\n\n` +
                            `Total Objects: ${objects.length}\n` +
                            `Last Updated: ${schemaInfo.lastUpdated.toISOString()}\n\n` +
                            `Available Objects:\n` +
                            objects.map(obj => `• ${obj}`).join('\n') +
                            `\n\nUse get_schema_info with objectName parameter to get detailed field information for any object.`
                    }
                  ]
                };
              } catch (error) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `❌ Failed to get schema information: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your Twenty CRM connection and try again.`
                    }
                  ]
                };
              }
            }

          case 'advanced_search_people':
            if (!args?.filters) {
              throw new Error('Filters object is required');
            }
            
            // Auto-fix common LinkedIn/X link filter issues at MCP level
            const fixedFilters = this.fixLinksFiltersInMCP(args.filters, 'people');
            if (JSON.stringify(fixedFilters) !== JSON.stringify(args.filters)) {
              logger.warn(`🔧 MCP AUTO-CORRECTION: Fixed LinkedIn filter syntax`);
              logger.warn(`   Use: {linkedinLink: {primaryLinkUrl: {neq: ""}}}`);
              logger.warn(`   Not: {linkedinLink: {isNotNull: true}}`);
              logger.warn(`   ℹ️  For strings: neq:"" = not empty, eq:"" = empty`);
            }
            
            const advancedPeopleResults = await this.twentyClient.advancedSearchPeople(
              fixedFilters, 
              Number(args?.limit || 10),
              args?.fields as string[] | undefined
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `🔍 Found ${advancedPeopleResults.length} people:\n` +
                        advancedPeopleResults.map(p => {
                          const result = this.formatPersonResult(p, args?.fields as string[] | undefined);
                          return `• ${result}`;
                        }).join('\n')
                }
              ]
            };

          case 'advanced_search_companies':
            if (!args?.filters) {
              throw new Error('Filters object is required');
            }
            
            // Auto-fix common LinkedIn/X link filter issues at MCP level
            const fixedCompanyFilters = this.fixLinksFiltersInMCP(args.filters, 'companies');
            if (JSON.stringify(fixedCompanyFilters) !== JSON.stringify(args.filters)) {
              logger.warn(`🔧 MCP AUTO-CORRECTION: Fixed LinkedIn filter syntax for companies`);
              logger.warn(`   Use: {linkedinLink: {primaryLinkUrl: {neq: ""}}}`);
              logger.warn(`   Not: {linkedinLink: {isNotNull: true}}`);
              logger.warn(`   ℹ️  For strings: neq:"" = not empty, eq:"" = empty`);
            }
            
            const advancedCompanyResults = await this.twentyClient.advancedSearchCompanies(
              fixedCompanyFilters, 
              Number(args?.limit || 10),
              args?.fields as string[] | undefined
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `🔍 Found ${advancedCompanyResults.length} companies:\n` +
                        advancedCompanyResults.map(c => {
                          const result = this.formatCompanyResult(c, args?.fields as string[] | undefined);
                          return `• ${result}`;
                        }).join('\n')
                }
              ]
            };

          case 'test_dynamic_query':
            const testObjectName = String(args?.objectName || 'Person');
            
            try {
              // Get dynamic fields and build query
              const fields = await this.twentyClient.schema.getObjectFields(testObjectName);
              const queryFields = await this.twentyClient.schema.buildGraphQLQuery(testObjectName, 'query');
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `🧪 Dynamic Query Test for ${testObjectName}:\n\n` +
                          `📋 Total Fields Found: ${fields.length}\n\n` +
                          `🔍 Fields by Type:\n` +
                          fields.map(f => `• ${f.name}: ${f.type}${f.isArray ? '[]' : ''}${f.isNullable ? '?' : ''}`).join('\n') +
                          `\n\n🎯 Generated GraphQL Query Fields:\n` +
                          `\`\`\`graphql\n${queryFields}\n\`\`\`\n\n` +
                          `✅ This query is built 100% dynamically from your Twenty CRM schema!`
                  }
                ]
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ Failed to test dynamic query for ${testObjectName}: ${error instanceof Error ? error.message : 'Unknown error'}`
                  }
                ]
              };
            }

          case 'debug_graphql_mutations':
            try {
              // Get the full GraphQL schema
              const schema = await this.twentyClient.schema.getSchema();
              
              // Try to introspect mutations
              const introspectionQuery = `
                query IntrospectionQuery {
                  __schema {
                    mutationType {
                      name
                      fields {
                        name
                        description
                        args {
                          name
                          type {
                            name
                            kind
                          }
                        }
                        type {
                          name
                          kind
                        }
                      }
                    }
                  }
                }
              `;
              
              // Access GraphQL client through TwentyClient's private field (temporary for debugging)
              const introspectionResult: any = await (this.twentyClient as any).graphqlClient.request(introspectionQuery);
              
              const mutations = introspectionResult.__schema?.mutationType?.fields || [];
              const createMutations = mutations.filter((m: any) => m.name.toLowerCase().includes('create'));
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `🔍 GraphQL Mutations Debug:\n\n` +
                          `📋 Total Mutations: ${mutations.length}\n` +
                          `🎯 Create Mutations: ${createMutations.length}\n\n` +
                          `🔧 Available Create Mutations:\n` +
                          createMutations.map((m: any) => 
                            `• ${m.name} - ${m.description || 'No description'}\n` +
                            `  Args: ${m.args?.map((arg: any) => `${arg.name}: ${arg.type?.name || arg.type?.kind}`).join(', ') || 'None'}`
                          ).join('\n') +
                          `\n\n📝 All Mutations:\n` +
                          mutations.map((m: any) => `• ${m.name}`).join('\n')
                  }
                ]
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ Failed to debug GraphQL mutations: ${error instanceof Error ? error.message : 'Unknown error'}`
                  }
                ]
              };
            }

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

  // Helper method to auto-fix LinkedIn/X link filters at MCP level
  private fixLinksFiltersInMCP(filters: any, objectType: 'people' | 'companies'): any {
    if (!filters || typeof filters !== 'object') {
      return filters;
    }

    const fixObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      const fixed: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Fix LinkedIn and X Link filters
        if ((key === 'linkedinLink' || key === 'xLink') && value && typeof value === 'object') {
          const linkFilter = value as any;
          
          // If user used old syntax: {linkedinLink: {isNotNull: true}}
          if (linkFilter.isNotNull !== undefined) {
            if (linkFilter.isNotNull) {
              // For string fields, check if not empty instead of isNotNull
              fixed[key] = {
                primaryLinkUrl: { neq: "" }
              };
            } else {
              // Check if empty
              fixed[key] = {
                primaryLinkUrl: { eq: "" }
              };
            }
          }
          // If user used old syntax: {linkedinLink: {isNull: true}}
          else if (linkFilter.isNull !== undefined) {
            if (linkFilter.isNull) {
              // Check if empty/null
              fixed[key] = {
                primaryLinkUrl: { eq: "" }
              };
            } else {
              // Check if not empty
              fixed[key] = {
                primaryLinkUrl: { neq: "" }
              };
            }
          }
          // Other filter types
          else if (linkFilter.ilike !== undefined) {
            fixed[key] = {
              primaryLinkUrl: { ilike: linkFilter.ilike }
            };
          }
          else if (linkFilter.eq !== undefined) {
            fixed[key] = {
              primaryLinkUrl: { eq: linkFilter.eq }
            };
          }
          else if (linkFilter.neq !== undefined) {
            fixed[key] = {
              primaryLinkUrl: { neq: linkFilter.neq }
            };
          }
          // Keep as is if already correct
          else {
            fixed[key] = linkFilter;
          }
        }
        // Recursively fix nested objects
        else if (key === 'and' && Array.isArray(value)) {
          fixed[key] = value.map(item => fixObject(item));
        }
        else if (key === 'or' && Array.isArray(value)) {
          fixed[key] = value.map(item => fixObject(item));
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fixed[key] = fixObject(value);
        }
        else {
          fixed[key] = value;
        }
      }
      
      return fixed;
    };

    return fixObject(filters);
  }

  // Helper method to format person results based on requested fields
  private formatPersonResult(person: any, requestedFields?: string[]): string {
    if (!requestedFields || requestedFields.length === 0) {
      // Default formatting
      const name = `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'No name';
      const details = [];
      if (person.email) details.push(`📧 ${person.email}`);
      if (person.jobTitle) details.push(`💼 ${person.jobTitle}`);
      if (person.city) details.push(`📍 ${person.city}`);
      if (person.linkedinLink?.primaryLinkUrl) details.push(`🔗 LinkedIn: ${person.linkedinLink.primaryLinkUrl}`);
      return `${name}${details.length ? ' (' + details.join(', ') + ')' : ''}`;
    }

    // Custom formatting based on requested fields
    const values = [];
    
    // Handle name fields specially
    if (requestedFields.includes('firstName') || requestedFields.includes('lastName')) {
      const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
      if (name) values.push(`👤 ${name}`);
    }
    
    // Add other requested fields
    for (const field of requestedFields) {
      if (field === 'firstName' || field === 'lastName') continue; // Already handled
      
      const value = this.getNestedValue(person, field);
      if (value !== undefined && value !== null && value !== '') {
        const icon = this.getFieldIcon(field);
        values.push(`${icon} ${field}: ${this.formatFieldValue(value)}`);
      }
    }

    return values.length > 0 ? values.join(' | ') : 'No data for requested fields';
  }

  // Helper method to format company results based on requested fields
  private formatCompanyResult(company: any, requestedFields?: string[]): string {
    if (!requestedFields || requestedFields.length === 0) {
      // Default formatting
      const details = [];
      if (company.domainName) details.push(`🌐 ${company.domainName}`);
      if (company.employees) details.push(`👥 ${company.employees} employees`);
      if (company.city) details.push(`📍 ${company.city}`);
      if (company.linkedinLink?.primaryLinkUrl) details.push(`🔗 LinkedIn: ${company.linkedinLink.primaryLinkUrl}`);
      return `${company.name}${details.length ? ' (' + details.join(', ') + ')' : ''}`;
    }

    // Custom formatting based on requested fields
    const values = [];
    
    for (const field of requestedFields) {
      const value = this.getNestedValue(company, field);
      if (value !== undefined && value !== null && value !== '') {
        const icon = this.getFieldIcon(field);
        values.push(`${icon} ${field}: ${this.formatFieldValue(value)}`);
      }
    }

    return values.length > 0 ? values.join(' | ') : 'No data for requested fields';
  }

  // Helper to get nested object values
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  // Helper to get appropriate icon for field
  private getFieldIcon(field: string): string {
    const icons: { [key: string]: string } = {
      'email': '📧',
      'emails': '📧',
      'jobTitle': '💼',
      'city': '📍',
      'linkedinLink': '🔗',
      'xLink': '🔗',
      'phone': '📱',
      'phones': '📱',
      'domainName': '🌐',
      'employees': '👥',
      'name': '👤',
      'firstName': '👤',
      'lastName': '👤',
      'company': '🏢',
      'id': '🆔'
    };
    return icons[field] || '📄';
  }

  // Helper to format field value
  private formatFieldValue(value: any): string {
    if (typeof value === 'object' && value !== null) {
      if (value.primaryLinkUrl) return value.primaryLinkUrl;
      if (value.primaryEmail) return value.primaryEmail;
      if (value.primaryPhoneNumber) return value.primaryPhoneNumber;
      if (value.firstName && value.lastName) return `${value.firstName} ${value.lastName}`;
      return JSON.stringify(value);
    }
    return String(value);
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