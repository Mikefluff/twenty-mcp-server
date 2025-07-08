# Twenty MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with seamless integration to Twenty CRM. Features 100% dynamic schema discovery with zero hardcode - automatically adapts to your custom fields and objects.

## Overview

This server enables AI assistants to interact with Twenty CRM through the Model Context Protocol, providing real-time access to customer data, analytics, and complete CRUD operations with dynamic schema discovery and intelligent search capabilities.

## Features

### 🚀 **Dual Transport Support**
- **stdio mode**: Direct MCP integration with AI assistants
- **HTTP mode**: Web interface with session management

### 🔧 **Complete CRM Toolkit**
- **Smart Search**: Find companies and people with wildcard support (`*`)
- **Advanced Filtering**: Complex searches with GraphQL filters (isNotNull, gte, ilike, etc.)
- **Full CRUD Operations**: Create, Read, Update, Delete companies and contacts
- **Data Management**: Complete lifecycle management for CRM records
- **Opportunity Management**: Access deals and sales pipeline
- **Analytics**: Get CRM insights and metrics

### 🎯 **Production Features**
- **100% Dynamic Schema**: Zero hardcode - automatically adapts to ANY Twenty CRM schema
- **Smart Type Detection**: Automatically identifies scalar vs complex fields
- **GraphQL + REST**: Intelligent API selection with fallback
- **Real-time Integration**: Live Twenty CRM connection
- **Type Safety**: Full TypeScript implementation with flexible interfaces
- **Error Handling**: Robust error recovery and logging

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

### Installation & Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd twenty-mcp-server
   npm install
   ```

2. **Start Twenty CRM:**
   ```bash
   # Smart start (only starts what's needed)
   npm run twenty:quick
   ```

3. **Create workspace:**
   - Open http://localhost:3000
   - Create workspace and user account
   - Generate API key in Settings > API

4. **Configure MCP server:**
   ```bash
   # Setup environment file
   npm run twenty:setup
   # Edit .env file with your API key
   ```

5. **Test integration:**
   ```bash
   # Test API discovery
   npm run discover

   # Start MCP server (choose one):
   npm run dev          # stdio mode
   npm run dev:http     # HTTP mode with web interface
   ```

6. **Access web interface** (HTTP mode only):
   - Open http://localhost:3002
   - MCP endpoint: http://localhost:3002/mcp
   - Health check: http://localhost:3002/health

## MCP Tools

### Search Tools
- **`advanced_search_people`** - Advanced search with flexible filters, conditions, and field selection
- **`advanced_search_companies`** - Advanced company search with complex filters and field selection

### Creation Tools  
- **`create_company`** - Create new company records
- **`create_person`** - Create new contact records
- **`create_person_with_company`** - Smart person creation with automatic company lookup/creation

### Management Tools
- **`update_company`** - Update existing company information
- **`delete_company`** - Delete company records
- **`update_person`** - Update existing contact information  
- **`delete_person`** - Delete contact records

### Analytics Tools
- **`get_opportunities`** - Retrieve deals and sales pipeline
- **`get_crm_analytics`** - Get CRM metrics and insights

### Schema Tools
- **`get_schema_info`** - Get dynamic schema information for CRM objects and fields
- **`test_dynamic_query`** - Test and preview dynamically generated GraphQL queries

### Usage Examples

#### Search Examples
```javascript
// Find all companies  
advanced_search_companies({ filters: {}, limit: 50 })

// Find specific company by name
advanced_search_companies({ 
  filters: { name: { ilike: "%Acme Corp%" } }, 
  limit: 10 
})

// Find all people
advanced_search_people({ filters: {}, limit: 50 })

// Find by email
advanced_search_people({
  filters: { emails: { primaryEmail: { ilike: "%john@example.com%" } } },
  limit: 10
})
```

#### Creation Examples
```javascript
// Create company
create_company({
  name: "Acme Corp",
  domainName: "acme.com"
})

// Create person (basic)
create_person({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com"
})

// Smart person creation with company auto-lookup
create_person_with_company({
  firstName: "Петр",
  lastName: "Петров",
  email: "petrov@roga.ru",
  jobTitle: "Исполнительный директор",
  companyName: "Петров и Рога"  // Will find existing or create new
})
```

#### Management Examples
```javascript
// Update company information
update_company({ 
  id: "company-123", 
  name: "New Company Name",
  domainName: "newdomain.com",
  employees: 150
})

// Update person details
update_person({
  id: "person-456",
  firstName: "John",
  lastName: "Smith", 
  email: "john.smith@example.com",
  phone: "+1-555-0123"
})

// Delete records
delete_company({ id: "company-123" })
delete_person({ id: "person-456" })
```

#### Schema Discovery Examples
```javascript
// Get all available objects
get_schema_info()

// Get detailed schema for specific object
get_schema_info({ objectName: "Company" })
get_schema_info({ objectName: "Person" })

// Force refresh schema cache
get_schema_info({ refresh: true })

// Test dynamic query generation
test_dynamic_query({ objectName: "Person" })
test_dynamic_query({ objectName: "Company" })
```

#### Advanced Search with Field Selection

Advanced search supports custom field selection to limit output and improve performance:

- Use `fields` parameter to specify which fields to include in results
- Without `fields`, returns all available fields from schema  
- Supports nested fields like `linkedinLink`, `emails`, `phones`
- Perfect for API integrations that need specific data only

```javascript
// Find people with LinkedIn profiles (CORRECT SYNTAX)
advanced_search_people({ 
  filters: { 
    linkedinLink: { 
      primaryLinkUrl: { neq: "" } 
    } 
  }
})

// Find engineers with custom field selection
advanced_search_people({
  filters: {
    jobTitle: { ilike: "%engineer%" }
  },
  fields: ["firstName", "lastName", "jobTitle", "linkedinLink", "email"]
})

// Find companies with specific fields only
advanced_search_companies({
  filters: {
    employees: { gte: 100 }
  },
  fields: ["name", "domainName", "employees", "city"],
  limit: 20
})

// Find people in specific cities with LinkedIn data
advanced_search_people({
  filters: {
    and: [
      { jobTitle: { ilike: "%engineer%" } },
      { city: { in: ["San Francisco", "New York", "Seattle"] } },
      { linkedinLink: { primaryLinkUrl: { neq: "" } } }
    ]
  },
  fields: ["firstName", "lastName", "jobTitle", "city", "linkedinLink"]
})

// Find people without email addresses
advanced_search_people({
  filters: { emails: { primaryEmail: { eq: "" } } }
})

// Find people with specific LinkedIn URL patterns
advanced_search_people({
  filters: {
    linkedinLink: {
      primaryLinkUrl: { ilike: "%linkedin.com/in/%" }
    }
  },
  fields: ["firstName", "lastName", "linkedinLink", "jobTitle"]
})

// Find people WITHOUT LinkedIn profiles
advanced_search_people({
  filters: {
    linkedinLink: {
      primaryLinkUrl: { eq: "" }
    }
  }
})

// Get minimal contact info for large searches
advanced_search_people({
  filters: { city: { eq: "San Francisco" } },
  fields: ["firstName", "lastName", "email"],
  limit: 100
}
```

## Configuration

### Environment Variables

Create `.env` file with:

```bash
# Twenty CRM Configuration
TWENTY_API_URL=http://localhost:3000
TWENTY_API_KEY=your_api_key_here

# MCP Server Configuration  
MCP_SERVER_PORT=3002
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### Transport Modes

#### stdio Mode (Default)
```bash
npm run dev
```
Use with MCP-compatible AI assistants that support stdio transport.

#### HTTP Mode  
```bash
npm run dev:http
# or
npm run start:http
```
Provides web interface at http://localhost:3002 with:
- Interactive MCP session management
- Health monitoring endpoint
- Russian language UI support

## Development

### Development Scripts

#### MCP Server
- `npm run dev` - Start in stdio mode
- `npm run dev:http` - Start with HTTP interface
- `npm run build` - Build TypeScript project
- `npm run start` - Start production stdio server  
- `npm run start:http` - Start production HTTP server
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run discover` - Test Twenty API connection

#### Twenty CRM Management
- `npm run twenty:quick` - Smart start Twenty CRM (recommended)
- `npm run twenty:status` - Check Twenty status
- `npm run twenty:setup` - Configure MCP environment
- `npm run twenty:logs` - View Twenty logs
- `npm run twenty:stop` - Stop Twenty services

### Project Structure

```
src/
├── server.ts              # Main MCP server with dual transport
├── twenty-client/         # Twenty CRM API integration
│   ├── index.ts          # Main client with GraphQL + REST
│   ├── graphql-client.ts # GraphQL implementation
│   └── rest-client.ts    # REST API fallback
├── tools/                # MCP tools implementation
│   ├── index.ts         # Tool definitions and handlers
│   └── api-discovery.ts # API testing utilities
├── types/                # TypeScript type definitions
└── utils/                # Configuration and logging
    ├── config.ts        # Environment configuration
    └── logger.ts        # Structured logging
```

## Deployment

### Docker

```bash
# Build image
docker build -t twenty-mcp-server .

# Run stdio mode
docker run -d --env-file .env twenty-mcp-server

# Run HTTP mode  
docker run -d --env-file .env -p 3002:3002 twenty-mcp-server npm run start:http
```

### Docker Compose

```bash
# Start with Twenty CRM
docker-compose up -d

# View logs
docker-compose logs -f twenty-mcp-server
```

## API Integration

### Dynamic Schema Discovery

The server automatically discovers your Twenty CRM schema and adapts to custom fields:

```typescript
// Schema is discovered at runtime
const schemaInfo = await twentyClient.schema.getSchema();
const companyFields = await twentyClient.schema.getObjectFields('Company');

// GraphQL queries are built dynamically based on actual schema
const fieldsString = await schemaManager.buildGraphQLQuery('Company', 'query');
```

### GraphQL Primary, REST Fallback

The server intelligently uses Twenty's GraphQL API with automatic REST fallback:

```typescript
// Dynamic query generation based on actual schema
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
        // All fields from schema automatically included
        id name emails phones createdAt
        // + any custom fields you've added
      }
    }
  }
}
```

### Flexible Data Handling

- **Dynamic Fields**: Automatically includes all schema fields
- **Custom Objects**: Works with any custom objects you create
- **Wildcard Search**: Use `*` to search all records
- **Advanced Filters**: GraphQL-powered complex searches
- **Type Safety**: Flexible interfaces that adapt to your schema

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using port 3002
lsof -i :3002

# Change port in .env
MCP_SERVER_PORT=3003
```

#### Twenty CRM Issues
```bash
# Check Twenty status
npm run twenty:status

# View logs
npm run twenty:logs  

# Fresh restart
npm run twenty:stop && npm run twenty:quick
```

#### GraphQL Errors
- The server automatically falls back to REST API
- Check Twenty CRM is running on http://localhost:3000
- Verify API key in `.env` file

#### MCP Connection Issues
```bash
# Test basic connectivity
npm run discover

# Check server health (HTTP mode)
curl http://localhost:3002/health
```

## Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get running in 5 minutes
- **[Script Reference](./SCRIPT_REFERENCE.md)** - Complete script documentation  
- **[Twenty Scripts Guide](./scripts/README.md)** - Twenty CRM management
- **[Development Log](./docs/development-log.md)** - Implementation details

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new tools and features
- Update documentation for API changes
- Use conventional commit messages

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: GitHub Issues for bugs and feature requests
- **Documentation**: See docs/ directory for detailed guides  
- **API Reference**: Generated after running `npm run discover`

---

**Made with ❤️ for the Twenty CRM community**