# Mixpanel MCP Server Architecture

## Overview

The Mixpanel MCP Server is a TypeScript-based Model Context Protocol (MCP) server that provides comprehensive access to the Mixpanel Analytics API. It enables MCP clients (such as Claude Desktop or Cursor) to query Mixpanel data through a set of well-organized, type-safe tools.

## Design Principles

The codebase is built on these core principles:

- **Class-Based Architecture**: Core functionality is encapsulated in well-defined classes (`Config`, `MixpanelClient`)
- **DRY (Don't Repeat Yourself)**: Eliminates code duplication through utility classes and shared methods
- **Type Safety**: Uses TypeScript and Zod for runtime schema validation
- **Clear Organization**: Code is organized into logical sections with clear separation of concerns
- **Comprehensive Documentation**: Every class, method, and tool includes JSDoc documentation
- **Secure Defaults**: Credentials are managed through environment variables with validation

## Project Structure

```
src/
└── index.ts                 Main server file containing all tools and infrastructure
build/
└── index.js                 Compiled JavaScript output

Configuration Files:
├── .env.example             Template for required environment variables
├── package.json             Project metadata and dependencies
├── tsconfig.json            TypeScript configuration
└── .gitignore               Git exclusion rules
```

## Core Architecture

### 1. Configuration Management (`Config` Class)

Centralized configuration class that handles all external settings:

```typescript
class Config {
  static credentials: { username: string; password: string }
  static defaultProjectId: string
  static apiBaseUrl: string
  static validate(): void
}
```

**Key Features:**
- Environment variable support with fallbacks
- Command-line argument support for backward compatibility
- Validation of credentials at startup
- Configurable API base URL (EU/US clusters)

**Usage:**
```typescript
Config.credentials.username    // Service account username
Config.defaultProjectId        // Default project ID
Config.apiBaseUrl             // Mixpanel API endpoint
```

### 2. API Client (`MixpanelClient` Class)

Encapsulates all HTTP communication with the Mixpanel API:

```typescript
class MixpanelClient {
  private createAuthHeaders(): string
  async get(endpoint: string, queryParams?: Record<string, any>): Promise<unknown>
  async post(endpoint: string, body: URLSearchParams, queryParams?: Record<string, any>): Promise<unknown>
  handleError(error: unknown, contextMessage: string): ToolResponse
  formatSuccess(data: unknown): ToolResponse
}
```

**Responsibilities:**
- Manages HTTP Basic authentication
- Constructs URLs with query parameters
- Handles GET and POST requests
- Provides standardized error handling
- Formats success responses consistently

**Benefits:**
- Single source of truth for API interaction logic
- Easier to maintain and test
- Consistent error handling across all tools
- Simplified parameter handling

### 3. Tool Organization

Tools are organized into logical categories by functionality:

#### Event Analytics Tools
- `getTodayTopEvents` - Today's top events
- `getTopEvents` - Most common events (last 31 days)
- `aggregateEventCounts` - Event data over time periods
- `aggregatedEventPropertyValues` - Event property data
- `topEventProperties` - Top property names for an event
- `topEventPropertyValues` - Top values for a property

#### User Profile Tools
- `profileEventActivity` - Event activity for individual users
- `queryProfiles` - Query user profiles with filtering

#### Retention & Engagement Tools
- `queryRetentionReport` - Retention analysis (birth/compounded)
- `queryFrequencyReport` - Action frequency over time

#### Segmentation Tools
- `querySegmentationReport` - Event data segmented by properties
- `querySegmentationBucket` - Numeric bucket segmentation
- `querySegmentationAverage` - Average values over time
- `querySegmentationSum` - Sum numeric expressions

#### Funnel & Cohort Tools
- `queryFunnelReport` - Funnel conversion data by funnel ID
- `listSavedFunnels` - List available funnels
- `listSavedCohorts` - List user cohorts

#### Report Tools
- `queryInsightsReport` - Saved Insights reports
- `customJql` - Custom JQL (JSON Query Language) queries

## Implementation Patterns

### Tool Definition Pattern

All tools follow a consistent structure:

```typescript
/**
 * JSDoc documentation of the tool's purpose and use cases.
 */
server.tool(
  "toolName",  // camelCase naming
  "Description and use cases",
  {
    // Zod schema for parameters
    paramName: z.string().describe("Parameter description")
  },
  async ({ paramName = defaultValue }) => {
    try {
      // Use MixpanelClient for API calls
      const data = await client.get("/endpoint", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Context message");
    }
  }
);
```

### Parameter Handling

Parameters are transformed from `snake_case` (MCP API format) to `camelCase` (TypeScript convention):

- `projectId` (instead of `project_id`)
- `fromDate` (instead of `from_date`)
- `workspaceId` (instead of `workspace_id`)

This transformation happens within each tool's implementation when constructing API calls.

### Error Handling

Standardized error handling across all tools:

1. **Try-Catch Pattern**: Every tool wraps logic in try-catch
2. **Error Formatting**: `MixpanelClient.handleError()` provides consistent formatting
3. **Context Messages**: Each error includes descriptive context
4. **Status Flag**: Error responses include `isError: true`

## API Integration

### Authentication

Uses HTTP Basic Authentication with Base64-encoded credentials:

```typescript
const credentials = `${username}:${password}`;
const encodedCredentials = Buffer.from(credentials).toString("base64");
headers.authorization = `Basic ${encodedCredentials}`;
```

### Request Construction

URLs are built using the `URL` API with query parameter handling:

```typescript
const url = new URL(endpoint, Config.apiBaseUrl);
if (queryParams) {
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });
}
```

### Response Handling

- Checks HTTP status with `response.ok`
- Parses JSON responses automatically
- Throws descriptive errors on failure
- Formats success responses consistently

## Configuration Options

### Environment Variables

```bash
SERVICE_ACCOUNT_USER_NAME    # Mixpanel service account username (required)
SERVICE_ACCOUNT_PASSWORD    # Mixpanel service account password (required)
DEFAULT_PROJECT_ID          # Default Mixpanel project ID (required)
MIXPANEL_API_BASE_URL       # API endpoint URL (default: https://eu.mixpanel.com/api)
```

### Cluster Configuration

**EU Cluster (Default):**
```bash
MIXPANEL_API_BASE_URL=https://eu.mixpanel.com/api
```

**US Cluster:**
```bash
MIXPANEL_API_BASE_URL=https://mixpanel.com/api
```

## Extending the Server

### Adding a New Tool

1. **Create the tool handler** in the appropriate section:

```typescript
server.tool(
  "newToolName",
  "Description and use cases",
  {
    // Parameter schema
  },
  async (params) => {
    try {
      const data = await client.get("/api/endpoint", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Descriptive error context");
    }
  }
);
```

2. **Follow naming conventions:**
   - Tool names: `camelCase` (e.g., `getTodayTopEvents`)
   - Parameters: `camelCase` (e.g., `projectId`, `fromDate`)
   - API query params: `snake_case` (in the params object passed to client)

3. **Add comprehensive documentation:**
   - JSDoc comment explaining the tool's purpose
   - Use cases and practical applications
   - Parameter descriptions in Zod schema

### Modifying API Interactions

All API communication flows through `MixpanelClient`. To change authentication, request format, or error handling, modify the relevant methods in the `MixpanelClient` class.

## Type Safety

### Zod Schemas

Parameters are validated using Zod schemas:

```typescript
{
  projectId: z.string().describe("...").optional(),
  limit: z.number().describe("...").optional(),
  type: z.enum(["general", "unique", "average"]).describe("...")
}
```

Benefits:
- Runtime validation of tool parameters
- Automatic type inference for parameters
- Clear, descriptive parameter documentation

### TypeScript Interfaces

```typescript
interface ToolResponse extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
```

## Code Organization

### Sections (MARK comments)

Code is organized into logical sections for easy navigation:

1. **Imports** - External dependencies
2. **Type Definitions** - Interfaces and types
3. **Configuration** - Config class
4. **MixpanelClient** - API client class
5. **Server Initialization** - MCP server setup
6. **Tool Registration** - Tools organized by category
7. **Main Entry Point** - Server startup function

### Naming Conventions

- **Classes**: `PascalCase` (e.g., `MixpanelClient`, `Config`)
- **Methods**: `camelCase` (e.g., `createAuthHeaders`, `handleError`)
- **Constants**: Defined as class static properties
- **Variables**: `camelCase` (e.g., `queryParams`, `projectId`)
- **Tool Names**: `camelCase` (e.g., `getTodayTopEvents`)

## Performance Considerations

- **Single Client Instance**: A single `MixpanelClient` instance is reused across all tools
- **Lazy Parameter Evaluation**: Parameters are only added to requests if defined
- **Minimal Dependencies**: Only core MCP SDK and Zod are dependencies
- **Efficient URL Construction**: Uses native URL API for parameter handling

## Security

- **Environment Variables**: Credentials are managed through environment variables, not hardcoded
- **HTTPS Only**: All API communication uses HTTPS
- **Credential Validation**: Server validates credentials on startup
- **No Credential Logging**: Error messages don't expose credentials
- **Basic Auth Over TLS**: Credentials are transmitted securely

## Testing and Validation

The server includes validation at startup:

```typescript
Config.validate()  // Ensures credentials are configured
```

Each tool includes:
- Parameter validation via Zod schemas
- API response validation via `response.ok`
- Error handling with descriptive messages
- Try-catch wrapping for safety

## Future Improvements

Potential enhancements:

1. **Batch Operations** - Support for querying multiple projects/funnels at once
2. **Caching Layer** - Cache common queries for improved performance
3. **Custom Hooks** - Allow users to customize request/response processing
4. **Webhooks Integration** - Support for real-time data feeds
5. **Test Suite** - Add comprehensive unit and integration tests
6. **CLI Interface** - Add command-line interface for local testing
