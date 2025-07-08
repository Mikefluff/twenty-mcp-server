/**
 * Schema Manager for Twenty CRM
 * Dynamically discovers and caches schema information using GraphQL introspection
 */

import { GraphQLClient } from 'graphql-request';
import { logger } from '../utils/logger.js';

export interface FieldDefinition {
  name: string;
  type: string;
  isNullable: boolean;
  isArray: boolean;
  description?: string;
}

export interface ObjectDefinition {
  name: string;
  fields: FieldDefinition[];
  description?: string;
}

export interface SchemaInfo {
  objects: Map<string, ObjectDefinition>;
  lastUpdated: Date;
  version?: string;
}

export class SchemaManager {
  private graphqlClient: GraphQLClient;
  private cache: SchemaInfo | null = null;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor(graphqlClient: GraphQLClient) {
    this.graphqlClient = graphqlClient;
  }

  async getSchema(force: boolean = false): Promise<SchemaInfo> {
    if (!force && this.cache && this.isCacheValid()) {
      logger.debug('Using cached schema');
      return this.cache;
    }

    logger.info('Fetching schema from Twenty CRM...');
    
    try {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
              description
              fields {
                name
                description
                type {
                  name
                  kind
                  ofType {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result: any = await this.graphqlClient.request(introspectionQuery);
      
      if (!result || !result.__schema) {
        throw new Error('Invalid introspection response: missing __schema');
      }
      
      const schema = result.__schema;
      
      if (!schema.types || !Array.isArray(schema.types)) {
        throw new Error('Invalid introspection response: missing types array');
      }

      const objects = new Map<string, ObjectDefinition>();
      
      // Process all types from schema
      for (const type of schema.types) {
        if (type && type.kind === 'OBJECT' && type.fields && !type.name.startsWith('__')) {
          const fields: FieldDefinition[] = type.fields
            .filter((field: any) => field && field.type) // Filter out null/undefined fields
            .map((field: any) => ({
              name: field.name,
              type: this.extractTypeName(field.type),
              isNullable: field.type ? field.type.kind !== 'NON_NULL' : true,
              isArray: this.isArrayType(field.type),
              description: field.description
            }));

          objects.set(type.name, {
            name: type.name,
            fields,
            description: type.description
          });
        }
      }

      this.cache = {
        objects,
        lastUpdated: new Date(),
        version: schema.version
      };

      logger.info(`Schema loaded: ${objects.size} objects discovered`);
      return this.cache;
    } catch (error) {
      logger.error('Failed to fetch schema:', error);
      throw new Error(`Schema introspection failed: ${error}`);
    }
  }

  async getObjectFields(objectName: string): Promise<FieldDefinition[]> {
    try {
      const schema = await this.getSchema();
      const object = schema.objects.get(objectName);
      if (!object) {
        logger.warn(`Object ${objectName} not found in schema`);
        return [];
      }
      return object.fields || [];
    } catch (error) {
      logger.error(`Failed to get fields for ${objectName}:`, error);
      return [];
    }
  }

  async buildGraphQLQuery(objectName: string, operation: 'query' | 'mutation', fieldSubset?: string[]): Promise<string> {
    try {
      const fields = await this.getObjectFields(objectName);
      const selectedFields = fieldSubset ? 
        fields.filter(f => fieldSubset.includes(f.name)) : 
        fields.filter(f => f.name && !f.name.startsWith('__')); // Exclude system fields

      const fieldStrings = await Promise.all(
        selectedFields.map(async (field) => this.buildFieldString(field, objectName))
      );

      return fieldStrings.filter(field => field).join('\n        ');
    } catch (error) {
      logger.warn(`Failed to build GraphQL query for ${objectName}:`, error);
      // Return basic fields as fallback
      return 'id\n        createdAt\n        updatedAt';
    }
  }

  private async buildFieldString(field: FieldDefinition, parentObject: string): Promise<string> {
    if (!field.name) return '';

    // Determine if this field is a scalar type or needs subfields
    const isScalar = this.isScalarType(field.type);
    const isConnection = field.type.endsWith('Connection');
    const isKnownComplexType = this.isKnownComplexType(field.type);

    // Handle scalar types (strings, numbers, booleans, etc.)
    if (isScalar) {
      return field.name;
    }

    // Skip connection types as they're too complex for simple queries
    if (isConnection) {
      return '';
    }

    // Handle known complex types with predefined subfields
    if (isKnownComplexType) {
      const subfields = this.getSubfieldsForType(field.type, field.name);
      if (subfields) {
        return `${field.name} { ${subfields} }`;
      }
    }

    // For unknown object types, try to get their fields dynamically
    if (field.type && !this.isScalarType(field.type)) {
      try {
        const objectFields = await this.getObjectFields(field.type);
        if (objectFields.length > 0) {
          // Get only scalar fields from the nested object
          const scalarFields = objectFields
            .filter(f => f.name && this.isScalarType(f.type))
            .slice(0, 5) // Limit to prevent huge queries
            .map(f => f.name);
          
          if (scalarFields.length > 0) {
            return `${field.name} { ${scalarFields.join(' ')} }`;
          }
        }
      } catch (error) {
        logger.debug(`Could not get fields for nested type ${field.type}`);
      }
    }

    // Skip complex fields we can't handle
    return '';
  }

  private isScalarType(typeName: string): boolean {
    const scalarTypes = [
      'String', 'Int', 'Float', 'Boolean', 'ID', 'Date', 'DateTime', 
      'Upload', 'JSON', 'UUID', 'Unknown'
    ];
    return scalarTypes.includes(typeName);
  }

  private isKnownComplexType(typeName: string): boolean {
    // Removed hardcoded types - rely on dynamic field discovery instead
    return false;
  }

  private getSubfieldsForType(typeName: string, fieldName: string): string | null {
    // Removed all hardcoded subfields - rely on dynamic field discovery instead
    return null;
  }

  async getAvailableObjects(): Promise<string[]> {
    const schema = await this.getSchema();
    return Array.from(schema.objects.keys())
      .filter(name => !name.startsWith('__'))
      .sort();
  }

  private isCacheValid(): boolean {
    if (!this.cache) return false;
    const now = new Date();
    return (now.getTime() - this.cache.lastUpdated.getTime()) < this.cacheExpiry;
  }

  private extractTypeName(type: any): string {
    if (!type) return 'Unknown';
    
    if (type.kind === 'NON_NULL' && type.ofType) {
      return this.extractTypeName(type.ofType);
    }
    
    if (type.kind === 'LIST' && type.ofType) {
      return this.extractTypeName(type.ofType);
    }
    
    // Handle different GraphQL type kinds
    switch (type.kind) {
      case 'SCALAR':
        return type.name || 'Unknown';
      case 'OBJECT':
        return type.name || 'Object';
      case 'INTERFACE':
        return type.name || 'Interface';
      case 'UNION':
        return type.name || 'Union';
      case 'ENUM':
        return type.name || 'Enum';
      case 'INPUT_OBJECT':
        return type.name || 'InputObject';
      default:
        return type.name || 'Unknown';
    }
  }

  private isArrayType(type: any): boolean {
    if (!type) return false;
    
    if (type.kind === 'LIST') return true;
    if (type.kind === 'NON_NULL' && type.ofType) {
      return this.isArrayType(type.ofType);
    }
    return false;
  }

  clearCache(): void {
    this.cache = null;
    logger.debug('Schema cache cleared');
  }
} 