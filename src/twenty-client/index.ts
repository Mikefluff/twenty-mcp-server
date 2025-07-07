/**
 * Twenty CRM API Client
 * Provides intelligent integration with Twenty's GraphQL and REST APIs
 */

import axios, { AxiosInstance } from 'axios';
import { GraphQLClient } from 'graphql-request';
import { logger } from '../utils/logger.js';

export interface TwentyClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface Company {
  id: string;
  name: string;
  domainName?: string;
  address?: string;
  employees?: number;
  createdAt?: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  createdAt?: string;
}

export interface Opportunity {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  createdAt?: string;
}

export class TwentyClient {
  private config: TwentyClientConfig;
  private restClient: AxiosInstance;
  private graphqlClient: GraphQLClient;

  constructor(config: TwentyClientConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    };

    // Initialize REST client
    this.restClient = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: this.config.timeout || 10000,
    });

    // Initialize GraphQL client
    this.graphqlClient = new GraphQLClient(`${config.apiUrl}/graphql`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    logger.debug('Twenty client initialized', {
      apiUrl: this.config.apiUrl,
      timeout: this.config.timeout,
    });
  }

  async validateConnection(): Promise<boolean> {
    logger.info('Validating connection to Twenty CRM...');

    try {
      // Test both REST and GraphQL connectivity
      const [restHealth, graphqlHealth] = await Promise.allSettled([
        this.restClient.get('/health'),
        this.graphqlClient.request(`
          query HealthCheck {
            __schema {
              queryType {
                name
              }
            }
          }
        `)
      ]);

      if (restHealth.status === 'fulfilled' || graphqlHealth.status === 'fulfilled') {
        logger.info('Twenty CRM connection validated successfully');
        return true;
      } else {
        throw new Error('Both REST and GraphQL endpoints failed');
      }
    } catch (error) {
      logger.error('Twenty CRM connection validation failed:', error);
      throw error;
    }
  }

  async searchCompanies(query: string, limit: number = 10): Promise<Company[]> {
    logger.debug(`Searching companies with query: ${query}, limit: ${limit}`);
    
    try {
      // Handle wildcard search - if query is "*" or empty, get all companies
      const isWildcardSearch = query === '*' || query.trim() === '';
      
      let graphqlQuery: string;
      let variables: any;
      
      if (isWildcardSearch) {
        // Get all companies without filters
        graphqlQuery = `
          query GetAllCompanies($limit: Int!) {
            companies(first: $limit) {
              edges {
                node {
                  id
                  name
                  domainName
                  employees
                  createdAt
                }
              }
            }
          }
        `;
        variables = { limit };
      } else {
        // Search with filters
        graphqlQuery = `
          query SearchCompanies($searchText: String!, $limit: Int!) {
            companies(filter: { 
              or: [
                { name: { ilike: $searchText } },
                { domainName: { ilike: $searchText } }
              ]
            }, first: $limit) {
              edges {
                node {
                  id
                  name
                  domainName
                  employees
                  createdAt
                }
              }
            }
          }
        `;
        variables = { searchText: `%${query}%`, limit };
      }

      const result: any = await this.graphqlClient.request(graphqlQuery, variables);

      return result.companies?.edges?.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name || '',
        domainName: edge.node.domainName || undefined,
        employees: edge.node.employees || undefined,
        createdAt: edge.node.createdAt
      })) || [];
    } catch (error) {
      logger.warn('GraphQL search failed, falling back to REST:', error);
      
      try {
        const params: any = { limit };
        
        // Only add filter if not a wildcard search
        if (query !== '*' && query.trim() !== '') {
          params.filter = JSON.stringify({
            or: [
              { name: { ilike: `%${query}%` } },
              { domainName: { ilike: `%${query}%` } }
            ]
          });
        }
        
        const response = await this.restClient.get('/rest/companies', { params });
        return response.data?.data || [];
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to search companies: ${error}`);
      }
    }
  }

  async searchPeople(query: string, limit: number = 10): Promise<Person[]> {
    logger.debug(`Searching people with query: ${query}, limit: ${limit}`);
    
    try {
      // Handle wildcard search - if query is "*" or empty, get all people
      const isWildcardSearch = query === '*' || query.trim() === '';
      
      let graphqlQuery: string;
      let variables: any;
      
      if (isWildcardSearch) {
        // Get all people without filters
        graphqlQuery = `
          query GetAllPeople($limit: Int!) {
            people(first: $limit) {
              edges {
                node {
                  id
                  name {
                    firstName
                    lastName
                  }
                  emails {
                    primaryEmail
                  }
                  phones {
                    primaryPhoneNumber
                  }
                  createdAt
                }
              }
            }
          }
        `;
        variables = { limit };
      } else {
        // Search with filters
        graphqlQuery = `
          query SearchPeople($searchText: String!, $limit: Int!) {
            people(filter: { 
              or: [
                { name: { firstName: { ilike: $searchText } } },
                { name: { lastName: { ilike: $searchText } } },
                { emails: { primaryEmail: { ilike: $searchText } } }
              ]
            }, first: $limit) {
              edges {
                node {
                  id
                  name {
                    firstName
                    lastName
                  }
                  emails {
                    primaryEmail
                  }
                  phones {
                    primaryPhoneNumber
                  }
                  createdAt
                }
              }
            }
          }
        `;
        variables = { searchText: `%${query}%`, limit };
      }

      const result: any = await this.graphqlClient.request(graphqlQuery, variables);

      return result.people?.edges?.map((edge: any) => ({
        id: edge.node.id,
        firstName: edge.node.name?.firstName || '',
        lastName: edge.node.name?.lastName || '',
        email: edge.node.emails?.primaryEmail || undefined,
        phone: edge.node.phones?.primaryPhoneNumber || undefined,
        createdAt: edge.node.createdAt
      })) || [];
    } catch (error) {
      logger.warn('GraphQL search failed, falling back to REST:', error);
      
      try {
        const params: any = { limit };
        
        // Only add filter if not a wildcard search
        if (query !== '*' && query.trim() !== '') {
          params.filter = JSON.stringify({
            or: [
              { name: { firstName: { ilike: `%${query}%` } } },
              { name: { lastName: { ilike: `%${query}%` } } },
              { emails: { primaryEmail: { ilike: `%${query}%` } } }
            ]
          });
        }
        
        const response = await this.restClient.get('/rest/people', { params });
        return response.data?.data || [];
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to search people: ${error}`);
      }
    }
  }

  async createCompany(data: Omit<Company, 'id'>): Promise<Company> {
    logger.info(`Creating company: ${data.name}`);
    
    try {
      // Use GraphQL mutation
      const mutation = `
        mutation CreateCompany($input: CompanyCreateInput!) {
          createCompany(data: $input) {
            id
            name
            domainName
            employees
            createdAt
          }
        }
      `;

      const result: any = await this.graphqlClient.request(mutation, {
        input: data
      });

      logger.info(`Company created with ID: ${result.createCompany.id}`);
      return result.createCompany;
    } catch (error) {
      logger.warn('GraphQL create failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.post('/rest/companies', data);
        logger.info(`Company created with ID: ${response.data.id}`);
        return response.data;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to create company: ${error}`);
      }
    }
  }

  async createPerson(data: Omit<Person, 'id'>): Promise<Person> {
    logger.info(`Creating person: ${data.firstName} ${data.lastName}`);
    
    try {
      const mutation = `
        mutation CreatePerson($input: PersonCreateInput!) {
          createPerson(data: $input) {
            id
            name {
              firstName
              lastName
            }
            emails {
              primaryEmail
            }
            phones {
              primaryPhoneNumber
            }
            createdAt
          }
        }
      `;

      const input: any = {
        name: {
          firstName: data.firstName,
          lastName: data.lastName
        }
      };
      
      if (data.email) {
        input.emails = { primaryEmail: data.email };
      }
      
      if (data.phone) {
        input.phones = { primaryPhoneNumber: data.phone };
      }
      
      if (data.companyId) {
        input.companyId = data.companyId;
      }

      const result: any = await this.graphqlClient.request(mutation, { input });

      const person = {
        id: result.createPerson.id,
        firstName: result.createPerson.name?.firstName || '',
        lastName: result.createPerson.name?.lastName || '',
        email: result.createPerson.emails?.primaryEmail || undefined,
        phone: result.createPerson.phones?.primaryPhoneNumber || undefined,
        createdAt: result.createPerson.createdAt
      };

      logger.info(`Person created with ID: ${person.id}`);
      return person;
    } catch (error) {
      logger.warn('GraphQL create failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.post('/rest/people', data);
        logger.info(`Person created with ID: ${response.data.id}`);
        return response.data;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to create person: ${error}`);
      }
    }
  }

  async getOpportunities(filters?: { stage?: string; limit?: number }): Promise<Opportunity[]> {
    logger.debug(`Getting opportunities with filters:`, filters);
    
    try {
      const graphqlQuery = `
        query GetOpportunities($filter: OpportunityFilterInput, $limit: Int!) {
          opportunities(filter: $filter, first: $limit) {
            edges {
              node {
                id
                name
                stage
                amount {
                  amountMicros
                  currencyCode
                }
                createdAt
              }
            }
          }
        }
      `;

      const filter = filters?.stage ? { stage: { equals: filters.stage } } : {};
      const result: any = await this.graphqlClient.request(graphqlQuery, {
        filter,
        limit: filters?.limit || 10
      });

      return result.opportunities?.edges?.map((edge: any) => ({
        ...edge.node,
        amount: edge.node.amount?.amountMicros ? edge.node.amount.amountMicros / 1000000 : undefined
      })) || [];
    } catch (error) {
      logger.warn('GraphQL query failed, falling back to REST:', error);
      
      try {
        const params: any = { limit: filters?.limit || 10 };
        if (filters?.stage) {
          params.filter = JSON.stringify({ stage: { equals: filters.stage } });
        }
        
        const response = await this.restClient.get('/rest/opportunities', { params });
        return response.data?.data || [];
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to get opportunities: ${error}`);
      }
    }
  }

  async getAnalytics(metric: string, timeframe: string): Promise<any> {
    logger.debug(`Getting analytics for metric: ${metric}, timeframe: ${timeframe}`);
    
    try {
      // Calculate date range based on timeframe
      const now = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const filter = {
        createdAt: {
          gte: startDate.toISOString()
        }
      };

      switch (metric) {
        case 'companies_count':
          const companiesQuery = `
            query CompaniesCount($filter: CompanyFilterInput!) {
              companies(filter: $filter) {
                totalCount
              }
            }
          `;
          const companiesResult: any = await this.graphqlClient.request(companiesQuery, { filter });
          return { 
            total: companiesResult.companies?.totalCount || 0,
            timeframe,
            metric 
          };

        case 'people_count':
          const peopleQuery = `
            query PeopleCount($filter: PersonFilterInput!) {
              people(filter: $filter) {
                totalCount
              }
            }
          `;
          const peopleResult: any = await this.graphqlClient.request(peopleQuery, { filter });
          return { 
            total: peopleResult.people?.totalCount || 0,
            timeframe,
            metric 
          };

        case 'opportunities_count':
          const oppsQuery = `
            query OpportunitiesCount($filter: OpportunityFilterInput!) {
              opportunities(filter: $filter) {
                totalCount
              }
            }
          `;
          const oppsResult: any = await this.graphqlClient.request(oppsQuery, { filter });
          return { 
            total: oppsResult.opportunities?.totalCount || 0,
            timeframe,
            metric 
          };

        case 'revenue_summary':
          const revenueQuery = `
            query RevenueSum($filter: OpportunityFilterInput!) {
              opportunities(filter: $filter) {
                edges {
                  node {
                    amount {
                      amountMicros
                    }
                  }
                }
              }
            }
          `;
          const revenueResult: any = await this.graphqlClient.request(revenueQuery, { filter });
          const totalRevenue = revenueResult.opportunities?.edges?.reduce((sum: number, edge: any) => {
            return sum + (edge.node.amount?.amountMicros || 0);
          }, 0) || 0;
          
          return {
            total: totalRevenue / 1000000, // Convert from micros
            timeframe,
            metric,
            currency: 'USD'
          };

        default:
          throw new Error(`Unknown metric: ${metric}`);
      }
    } catch (error) {
      logger.error('Analytics query failed:', error);
      throw new Error(`Failed to get analytics for ${metric}: ${error}`);
    }
  }
}

export * from './graphql-client.js';
export * from './rest-client.js';