/**
 * Twenty CRM API Client
 * Provides intelligent integration with Twenty's GraphQL and REST APIs
 */

import axios, { AxiosInstance } from 'axios';
import { GraphQLClient } from 'graphql-request';
import { logger } from '../utils/logger.js';
import { SchemaManager } from './schema-manager.js';

export interface TwentyClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

// Flexible base record interface
export interface BaseRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any; // Allow any additional fields
}

// More flexible interfaces that extend base record
export interface Company extends BaseRecord {
  name: string;
  domainName?: string;
  address?: string;
  employees?: number;
  linkedinLink?: {
    url?: string;
    label?: string;
  };
  xLink?: {
    url?: string;
    label?: string;
  };
  // Any additional custom fields from schema
}

export interface Person extends BaseRecord {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyId?: string;
  jobTitle?: string;
  city?: string;
  avatarUrl?: string;
  position?: string;
  instagram?: string;
  linkedinLink?: {
    url?: string;
    label?: string;
  };
  xLink?: {
    url?: string;
    label?: string;
  };
  name?: {
    firstName?: string;
    lastName?: string;
  };
  emails?: {
    primaryEmail?: string;
  };
  phones?: {
    primaryPhoneNumber?: string;
  };
  // Any additional custom fields from schema
}

export interface Opportunity extends BaseRecord {
  name: string;
  stage: string;
  amount?: number;
  closeDate?: string;
  // Any additional custom fields from schema
}

export class TwentyClient {
  private config: TwentyClientConfig;
  private restClient: AxiosInstance;
  private graphqlClient: GraphQLClient;
  private schemaManager: SchemaManager;

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

    // Initialize Schema Manager
    this.schemaManager = new SchemaManager(this.graphqlClient);

    logger.debug('Twenty client initialized', {
      apiUrl: this.config.apiUrl,
      timeout: this.config.timeout,
    });
  }

  // Expose schema manager for external use
  get schema(): SchemaManager {
    return this.schemaManager;
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



  async advancedSearchPeople(filters: any, limit: number = 10, fields?: string[]): Promise<Person[]> {
    logger.debug(`Advanced search people with filters:`, filters);
    logger.debug(`Filter type: ${typeof filters}, keys: ${Object.keys(filters || {})}`);
    
    // Auto-fix common filter mistakes for Links fields
    const correctedFilters = this.fixLinksFilters(filters, 'people');
    const filtersChanged = JSON.stringify(correctedFilters) !== JSON.stringify(filters);
    
    logger.debug(`Filters changed: ${filtersChanged}`);
    if (filtersChanged) {
      logger.warn(`🔧 AUTO-CORRECTED FILTERS:`);
      logger.warn(`   Original: ${JSON.stringify(filters, null, 2)}`);
      logger.warn(`   Corrected: ${JSON.stringify(correctedFilters, null, 2)}`);
      logger.warn(`💡 TIP: Use proper syntax: {linkedinLink: {primaryLinkUrl: {neq: ""}}}`);
      logger.warn(`   ℹ️  For strings: neq:"" = not empty, eq:"" = empty`);
    } else {
      logger.debug(`No auto-correction needed for filters`);
    }
    
    try {
      
      // Build dynamic field selection based on schema or provided fields
      let fieldsString: string;
      if (fields && fields.length > 0) {
        fieldsString = await this.schemaManager.buildGraphQLQuery('Person', 'query', fields);
      } else {
        fieldsString = await this.schemaManager.buildGraphQLQuery('Person', 'query');
      }
      
      const graphqlQuery = `
        query AdvancedSearchPeople($filter: PersonFilterInput, $limit: Int!) {
          people(filter: $filter, first: $limit) {
            edges {
              node {
                ${fieldsString}
              }
            }
          }
        }
      `;

      const result: any = await this.graphqlClient.request(graphqlQuery, {
        filter: correctedFilters,
        limit
      });

      return result.people?.edges?.map((edge: any) => {
        // Transform the result to match our interface while preserving all fields
        const node = edge.node;
        return {
          id: node.id,
          firstName: node.name?.firstName || '',
          lastName: node.name?.lastName || '',
          email: node.emails?.primaryEmail || undefined,
          phone: node.phones?.primaryPhoneNumber || undefined,
          createdAt: node.createdAt,
          // Include additional safe fields
          jobTitle: node.jobTitle,
          city: node.city,
          avatarUrl: node.avatarUrl,
          position: node.position,
          instagram: node.instagram,
          companyId: node.companyId,
          updatedAt: node.updatedAt,
          deletedAt: node.deletedAt,
          linkedinLink: node.linkedinLink,
          xLink: node.xLink,
          // Include all other fields dynamically (for any custom fields)
          ...node
        };
      }) || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Give helpful error message for LinkedIn filter issues
      if (errorMessage.includes('LinksFilterInput') && errorMessage.includes('isNotNull')) {
        const helpfulError = `❌ LinkedIn Filter Error: Use {linkedinLink: {primaryLinkUrl: {isNotNull: true}}} instead of {linkedinLink: {isNotNull: true}}

🔧 CORRECT SYNTAX:
{
  "filters": {
    "linkedinLink": {
      "primaryLinkUrl": {"isNotNull": true}
    }
  }
}

Original error: ${errorMessage}`;
        throw new Error(helpfulError);
      }
      
      logger.warn('GraphQL advanced search failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.get('/rest/people', { 
          params: { 
            filter: JSON.stringify(correctedFilters), 
            limit 
          } 
        });
        return response.data?.data || [];
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to advanced search people: ${error}`);
      }
    }
  }

  async advancedSearchCompanies(filters: any, limit: number = 10, fields?: string[]): Promise<Company[]> {
    logger.debug(`Advanced search companies with filters:`, filters);
    
    // Auto-fix common filter mistakes for Links fields
    const correctedFilters = this.fixLinksFilters(filters, 'companies');
    if (JSON.stringify(correctedFilters) !== JSON.stringify(filters)) {
      logger.warn(`🔧 AUTO-CORRECTED FILTERS:`);
      logger.warn(`   Original: ${JSON.stringify(filters, null, 2)}`);
      logger.warn(`   Corrected: ${JSON.stringify(correctedFilters, null, 2)}`);
      logger.warn(`💡 TIP: Use proper syntax: {linkedinLink: {primaryLinkUrl: {neq: ""}}}`);
      logger.warn(`   ℹ️  For strings: neq:"" = not empty, eq:"" = empty`);
    }
    
    try {
      
      // Build dynamic field selection based on schema or provided fields
      let fieldsString: string;
      if (fields && fields.length > 0) {
        fieldsString = await this.schemaManager.buildGraphQLQuery('Company', 'query', fields);
      } else {
        fieldsString = await this.schemaManager.buildGraphQLQuery('Company', 'query');
      }
      
      const graphqlQuery = `
        query AdvancedSearchCompanies($filter: CompanyFilterInput, $limit: Int!) {
          companies(filter: $filter, first: $limit) {
            edges {
              node {
                ${fieldsString}
              }
            }
          }
        }
      `;

      const result: any = await this.graphqlClient.request(graphqlQuery, {
        filter: correctedFilters,
        limit
      });

      return result.companies?.edges?.map((edge: any) => {
        // Transform the result to match our interface while preserving all fields
        const node = edge.node;
        return {
          id: node.id,
          name: node.name || '',
          domainName: node.domainName || undefined,
          employees: node.employees || undefined,
          createdAt: node.createdAt,
          // Include additional safe fields
          address: node.address,
          updatedAt: node.updatedAt,
          deletedAt: node.deletedAt,
          linkedinLink: node.linkedinLink,
          xLink: node.xLink,
          // Include all other fields dynamically (for any custom fields)
          ...node
        };
      }) || [];
    } catch (error) {
      logger.warn('GraphQL advanced search failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.get('/rest/companies', { 
          params: { 
            filter: JSON.stringify(correctedFilters), 
            limit 
          } 
        });
        return response.data?.data || [];
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to advanced search companies: ${error}`);
      }
    }
  }

  async createCompany(data: Omit<Company, 'id'>): Promise<Company> {
    logger.info(`Creating company: ${data.name}`);
    logger.debug(`Company data:`, data);
    
    try {
      // Use GraphQL mutation
      const mutation = `
        mutation CreateCompany($data: CompanyCreateInput!) {
          createCompany(data: $data) {
            id
            name
            domainName
            employees
            createdAt
          }
        }
      `;

      logger.debug(`GraphQL mutation:`, mutation);
      logger.debug(`GraphQL variables:`, { data });

      const result: any = await this.graphqlClient.request(mutation, { data });

      logger.debug(`GraphQL result:`, result);
      logger.info(`Company created with ID: ${result.data?.createCompany?.id}`);
      
      if (!result.data?.createCompany) {
        throw new Error('No createCompany in response data');
      }
      
      return result.data.createCompany;
    } catch (error) {
      logger.warn('GraphQL create failed, falling back to REST:', error);
      
      try {
        logger.debug(`REST fallback - posting to /rest/companies:`, data);
        const response = await this.restClient.post('/rest/companies', data);
        logger.debug(`REST response:`, response.data);
        
        // REST API also wraps data like GraphQL: { data: { createCompany: {...} } }
        const companyData = response.data?.data?.createCompany;
        logger.info(`Company created with ID: ${companyData?.id}`);
        
        if (!companyData) {
          throw new Error('No createCompany data in REST response');
        }
        
        return companyData;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to create company: ${error}`);
      }
    }
  }

  async createPerson(data: Omit<Person, 'id'>): Promise<Person> {
    logger.info(`Creating person: ${data.firstName} ${data.lastName}`);
    logger.debug(`Person data:`, data);
    
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
            jobTitle
            companyId
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

      if (data.jobTitle) {
        input.jobTitle = data.jobTitle;
      }

      logger.debug(`GraphQL input:`, input);
      const result: any = await this.graphqlClient.request(mutation, { input });
      logger.debug(`GraphQL result:`, result);

      // GraphQL client returns data directly, not wrapped in { data: ... }
      const person = {
        id: result.createPerson.id,
        firstName: result.createPerson.name?.firstName || '',
        lastName: result.createPerson.name?.lastName || '',
        email: result.createPerson.emails?.primaryEmail || undefined,
        phone: result.createPerson.phones?.primaryPhoneNumber || undefined,
        jobTitle: result.createPerson.jobTitle || undefined,
        companyId: result.createPerson.companyId || undefined,
        createdAt: result.createPerson.createdAt
      };

      logger.info(`Person created with ID: ${person.id}`);
      return person;
    } catch (error) {
      logger.warn('GraphQL create failed, falling back to REST:', error);
      
      try {
        // REST API expects the same nested structure as GraphQL
        const restData: any = {
          name: {
            firstName: data.firstName,
            lastName: data.lastName
          }
        };
        
        if (data.email) {
          restData.emails = { primaryEmail: data.email };
        }
        
        if (data.phone) {
          restData.phones = { primaryPhoneNumber: data.phone };
        }
        
        if (data.companyId) {
          restData.companyId = data.companyId;
        }

        if (data.jobTitle) {
          restData.jobTitle = data.jobTitle;
        }

        logger.debug(`REST fallback - posting to /rest/people:`, restData);
        const response = await this.restClient.post('/rest/people', restData);
        logger.debug(`REST response:`, response.data);
        
        // REST API also wraps data like GraphQL: { data: { createPerson: {...} } }
        const personData = response.data?.data?.createPerson;
        logger.debug(`Extracted person data:`, personData);
        
        if (!personData) {
          logger.error(`No createPerson data in REST response. Full response:`, response.data);
          throw new Error('No createPerson data in REST response');
        }

        // Convert to our standard format
        const person = {
          id: personData.id,
          firstName: personData.name?.firstName || '',
          lastName: personData.name?.lastName || '',
          email: personData.emails?.primaryEmail || undefined,
          phone: personData.phones?.primaryPhoneNumber || undefined,
          jobTitle: personData.jobTitle || undefined,
          companyId: personData.companyId || undefined,
          createdAt: personData.createdAt
        };

        logger.info(`Person created with ID: ${person.id}`);
        return person;
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

  async updateCompany(id: string, data: Partial<Omit<Company, 'id'>>): Promise<Company> {
    logger.info(`Updating company: ${id}`);
    
    try {
      // Use GraphQL mutation
      const mutation = `
        mutation UpdateCompany($id: UUID!, $input: CompanyUpdateInput!) {
          updateCompany(id: $id, data: $input) {
            id
            name
            domainName
            employees
            createdAt
          }
        }
      `;

      const result: any = await this.graphqlClient.request(mutation, {
        id,
        input: data
      });

      // GraphQL client returns data directly, not wrapped in { data: ... }
      logger.info(`Company updated with ID: ${result.updateCompany.id}`);
      return result.updateCompany;
    } catch (error) {
      logger.warn('GraphQL update failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.patch(`/rest/companies/${id}`, data);
        logger.info(`Company updated with ID: ${response.data.id}`);
        return response.data;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to update company: ${error}`);
      }
    }
  }

  async deleteCompany(id: string): Promise<boolean> {
    logger.info(`Deleting company: ${id}`);
    
    try {
      // Use GraphQL mutation
      const mutation = `
        mutation DeleteCompany($id: UUID!) {
          deleteCompany(id: $id) {
            id
          }
        }
      `;

      await this.graphqlClient.request(mutation, { id });
      logger.info(`Company deleted with ID: ${id}`);
      return true;
    } catch (error) {
      logger.warn('GraphQL delete failed, falling back to REST:', error);
      
      try {
        await this.restClient.delete(`/rest/companies/${id}`);
        logger.info(`Company deleted with ID: ${id}`);
        return true;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to delete company: ${error}`);
      }
    }
  }

  async updatePerson(id: string, data: Partial<Omit<Person, 'id'>>): Promise<Person> {
    logger.info(`Updating person: ${id}`);
    
    try {
      const mutation = `
        mutation UpdatePerson($id: UUID!, $input: PersonUpdateInput!) {
          updatePerson(id: $id, data: $input) {
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
            jobTitle
            companyId
            createdAt
          }
        }
      `;

      const input: any = {};
      
      if (data.firstName || data.lastName) {
        input.name = {};
        if (data.firstName) input.name.firstName = data.firstName;
        if (data.lastName) input.name.lastName = data.lastName;
      }
      
      if (data.email) {
        input.emails = { primaryEmail: data.email };
      }
      
      if (data.phone) {
        input.phones = { primaryPhoneNumber: data.phone };
      }
      
      if (data.companyId) {
        input.companyId = data.companyId;
      }

      if (data.jobTitle) {
        input.jobTitle = data.jobTitle;
      }

      const result: any = await this.graphqlClient.request(mutation, { id, input });

      // GraphQL client returns data directly, not wrapped in { data: ... }
      const person = {
        id: result.updatePerson.id,
        firstName: result.updatePerson.name?.firstName || '',
        lastName: result.updatePerson.name?.lastName || '',
        email: result.updatePerson.emails?.primaryEmail || undefined,
        phone: result.updatePerson.phones?.primaryPhoneNumber || undefined,
        jobTitle: result.updatePerson.jobTitle || undefined,
        companyId: result.updatePerson.companyId || undefined,
        createdAt: result.updatePerson.createdAt
      };

      logger.info(`Person updated with ID: ${person.id}`);
      return person;
    } catch (error) {
      logger.warn('GraphQL update failed, falling back to REST:', error);
      
      try {
        const response = await this.restClient.patch(`/rest/people/${id}`, data);
        logger.info(`Person updated with ID: ${response.data.id}`);
        return response.data;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to update person: ${error}`);
      }
    }
  }

  async deletePerson(id: string): Promise<boolean> {
    logger.info(`Deleting person: ${id}`);
    
    try {
      // Use GraphQL mutation
      const mutation = `
        mutation DeletePerson($id: UUID!) {
          deletePerson(id: $id) {
            id
          }
        }
      `;

      await this.graphqlClient.request(mutation, { id });
      logger.info(`Person deleted with ID: ${id}`);
      return true;
    } catch (error) {
      logger.warn('GraphQL delete failed, falling back to REST:', error);
      
      try {
        await this.restClient.delete(`/rest/people/${id}`);
        logger.info(`Person deleted with ID: ${id}`);
        return true;
      } catch (restError) {
        logger.error('REST fallback also failed:', restError);
        throw new Error(`Failed to delete person: ${error}`);
      }
    }
  }

  // Helper method to auto-fix common filter mistakes for Links fields
  private fixLinksFilters(filters: any, objectType: 'people' | 'companies'): any {
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
          // If user used old syntax: {linkedinLink: {ilike: "pattern"}}
          else if (linkFilter.ilike !== undefined) {
            fixed[key] = {
              primaryLinkUrl: { ilike: linkFilter.ilike }
            };
          }
          // If user used old syntax: {linkedinLink: {eq: "value"}}
          else if (linkFilter.eq !== undefined) {
            fixed[key] = {
              primaryLinkUrl: { eq: linkFilter.eq }
            };
          }
          // Otherwise keep the filter as is (probably already correct)
          else {
            fixed[key] = linkFilter;
          }
        }
        // Recursively fix nested objects (like 'and', 'or' conditions)
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
}

export * from './graphql-client.js';
export * from './rest-client.js';