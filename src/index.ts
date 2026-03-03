//
//  index.ts
//  Mixpanel MCP Server
//
//  Created by Andrea Mario Lufino on 31/10/25.
//  Copyright © 2025 Andrea Mario Lufino. All rights reserved.
//

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Imports
// ─────────────────────────────────────────────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { z } from "zod";


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Successful MCP tool response structure.
 */
interface ToolResponse extends Record<string, unknown> {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Zod schema for date strings in yyyy-mm-dd format.
 * Shared across all tools that accept date parameters.
 */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-mm-dd format");


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralized configuration class for Mixpanel MCP server.
 *
 * Handles credential management, API endpoint configuration, and validation.
 * Supports environment variables for secure credential handling.
 */
class Config {
  /**
   * Service account credentials for Mixpanel authentication.
   */
  static credentials = {
    username: process.env["SERVICE_ACCOUNT_USER_NAME"] || "",
    password: process.env["SERVICE_ACCOUNT_PASSWORD"] || "",
  };

  /**
   * Default Mixpanel project ID for queries.
   */
  static defaultProjectId = process.env["DEFAULT_PROJECT_ID"] || "";

  /**
   * Mixpanel API base URL.
   * Defaults to EU cluster (https://eu.mixpanel.com/api/).
   * Set MIXPANEL_API_BASE_URL environment variable for US cluster.
   */
  static apiBaseUrl =
    (process.env["MIXPANEL_API_BASE_URL"] || "https://eu.mixpanel.com/api").replace(/\/$/, "") + "/";

  /**
   * Validates configuration on initialization.
   * Exits if credentials are missing or incomplete.
   */
  static validate(): void {
    const args = process.argv.slice(2);

    if (args.length === 0 && !this.credentials.username && !this.credentials.password) {
      console.error(
        "Error: Mixpanel service account credentials not configured.\n" +
        "Provide credentials via environment variables:\n" +
        "  SERVICE_ACCOUNT_USER_NAME\n" +
        "  SERVICE_ACCOUNT_PASSWORD\n" +
        "  DEFAULT_PROJECT_ID\n" +
        "Or pass as command-line arguments."
      );
      process.exit(1);
    }

    if (!this.credentials.username || !this.credentials.password) {
      console.error(
        "Error: Both SERVICE_ACCOUNT_USER_NAME and SERVICE_ACCOUNT_PASSWORD must be provided.\n" +
        `Got username: ${this.credentials.username ? "yes" : "missing"}, ` +
        `password: ${this.credentials.password ? "yes" : "missing"}.`
      );
      process.exit(1);
    }

    if (!this.defaultProjectId) {
      console.warn(
        "Warning: DEFAULT_PROJECT_ID not set. " +
        "You will need to provide projectId for every tool call."
      );
    }
  }
}

// Parse command-line arguments as fallback for credentials
const args = process.argv.slice(2);
if (args.length > 0) {
  if (args[0]) {
    Config.credentials.username = args[0];
  }
  if (args[1]) {
    Config.credentials.password = args[1];
  }
  if (args[2]) {
    Config.defaultProjectId = args[2];
  }
}

// Validate configuration
Config.validate();


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - MixpanelClient Utility Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client for interacting with the Mixpanel API.
 *
 * Handles authentication, request construction, error handling, and response
 * formatting. Encapsulates common patterns used across all Mixpanel queries.
 */
class MixpanelClient {
  /**
   * Default request timeout in milliseconds.
   */
  static readonly REQUEST_TIMEOUT_MS = 30_000;

  /**
   * Cached Base64-encoded authorization header value.
   * Computed once on first use since credentials do not change at runtime.
   */
  private cachedAuth: string | undefined;

  /**
   * Returns the Base64-encoded authorization header, computing and caching on first call.
   *
   * @returns Base64-encoded authorization header value
   */
  private getAuthHeader(): string {
    if (this.cachedAuth === undefined) {
      const credentials = `${Config.credentials.username}:${Config.credentials.password}`;
      this.cachedAuth = Buffer.from(credentials).toString("base64");
    }
    return this.cachedAuth;
  }

  /**
   * Constructs a URL with query parameters appended.
   *
   * @param endpoint - API endpoint path (relative to base URL)
   * @param queryParams - URL query parameters
   * @returns Fully constructed URL
   */
  private buildUrl(
    endpoint: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): URL {
    const url = new URL(endpoint.replace(/^\//, ""), Config.apiBaseUrl);

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url;
  }

  /**
   * Executes a GET request to the Mixpanel API.
   *
   * @param endpoint - API endpoint path (relative to base URL)
   * @param queryParams - URL query parameters
   * @returns Parsed JSON response from API
   * @throws Error if the API request fails or times out
   */
  async get(
    endpoint: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<unknown> {
    const url = this.buildUrl(endpoint, queryParams);
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      MixpanelClient.REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${this.getAuthHeader()}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mixpanel API request failed with status ${response.status}: ${errorText}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Executes a POST request to the Mixpanel API.
   *
   * @param endpoint - API endpoint path (relative to base URL)
   * @param body - Form-encoded request body
   * @param queryParams - URL query parameters
   * @returns Parsed JSON response from API
   * @throws Error if the API request fails or times out
   */
  async post(
    endpoint: string,
    body: URLSearchParams,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<unknown> {
    const url = this.buildUrl(endpoint, queryParams);
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      MixpanelClient.REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${this.getAuthHeader()}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mixpanel API request failed with status ${response.status}: ${errorText}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles errors and returns standardized error response.
   *
   * @param error - The error that occurred
   * @param contextMessage - Context message for the error
   * @returns Standardized error response
   */
  handleError(error: unknown, contextMessage: string): ToolResponse {
    console.error(`${contextMessage}:`, error);
    let errorMessage: string;
    if (error instanceof Error && error.name === "AbortError") {
      errorMessage = `Request timed out after ${MixpanelClient.REQUEST_TIMEOUT_MS / 1000} seconds`;
    } else {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    return {
      content: [
        {
          type: "text",
          text: `${contextMessage}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Formats successful response data.
   *
   * @param data - Response data to format
   * @returns Formatted tool response
   */
  formatSuccess(data: unknown): ToolResponse {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
}

// Single instance of MixpanelClient used across all tools
const client = new MixpanelClient();


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a record of query parameters, filtering out undefined values.
 * Replaces repetitive conditional assignment blocks across all tools.
 *
 * @param mapping - Key-value pairs where values may be undefined
 * @returns Record containing only defined values
 */
function buildParams(
  mapping: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Builds URLSearchParams from a mapping, filtering out undefined values.
 * Used for POST request bodies.
 *
 * @param mapping - Key-value pairs where values may be undefined
 * @returns URLSearchParams containing only defined values
 */
function buildFormData(
  mapping: Record<string, string | number | boolean | undefined>
): URLSearchParams {
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      formData.append(key, String(value));
    }
  }
  return formData;
}

/**
 * Validates that either interval or both date range bounds are provided.
 *
 * @param interval - Number of time units
 * @param fromDate - Start date string
 * @param toDate - End date string
 * @throws Error if neither interval nor a complete date range is provided
 */
function validateIntervalOrDates(
  interval: number | undefined,
  fromDate: string | undefined,
  toDate: string | undefined
): void {
  if (interval === undefined && (!fromDate || !toDate)) {
    throw new Error(
      "You must specify either interval or both fromDate and toDate"
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Server Initialization
// ─────────────────────────────────────────────────────────────────────────────

const _require = createRequire(import.meta.url);
const pkg = _require("../package.json") as { version: string };

const server = new McpServer({
  name: "mixpanel",
  version: pkg.version,
});


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - Event Analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves today's top events from Mixpanel.
 * Useful for quickly identifying the most active events happening today,
 * spotting trends, and monitoring real-time user activity.
 */
server.tool(
  "getTodayTopEvents",
  "Get today's top events from Mixpanel. Useful for quickly identifying the most active events happening today, spotting trends, and monitoring real-time user activity.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    type: z
      .enum(["general", "average", "unique"])
      .describe(
        "The type of events to fetch: general, average, or unique. Defaults to general."
      )
      .optional(),
    limit: z
      .number()
      .describe("Maximum number of events to return. Defaults to 10.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    type = "general",
    limit = 10,
  }) => {
    try {
      const data = await client.get("/query/events/top", {
        project_id: projectId,
        type,
        limit,
      });
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching today's top events");
    }
  }
);

/**
 * Retrieves the most frequently occurring events over the last 31 days.
 * Useful for identifying user behavior patterns, spotting trends,
 * and understanding which features are most actively used.
 */
server.tool(
  "getTopEvents",
  "Get the most common events over the last 31 days. Useful for identifying key user actions, prioritizing feature development, and understanding overall platform usage patterns.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    type: z
      .enum(["general", "average", "unique"])
      .describe("The type of events to fetch: general, average, or unique")
      .optional(),
    limit: z.number().describe("Maximum number of events to return").optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    type = "general",
    limit = 10,
  }) => {
    try {
      const data = await client.get("/query/events/names", {
        project_id: projectId,
        type,
        limit,
      });
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching top events");
    }
  }
);

/**
 * Retrieves unique, general, or average event data over N days, weeks, or months.
 * Useful for trend analysis, comparing event performance over time,
 * and creating time-series visualizations.
 */
server.tool(
  "aggregateEventCounts",
  "Get unique, general, or average data for a set of events over N days, weeks, or months. Useful for trend analysis, comparing event performance over time, and creating time-series visualizations.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    event: z
      .string()
      .describe(
        'The event or events to query, as a JSON array string. Example: "[\\"play song\\", \\"log in\\"]"'
      ),
    type: z
      .enum(["general", "unique", "average"])
      .describe("The type of data: general, unique, or average")
      .optional(),
    unit: z
      .enum(["minute", "hour", "day", "week", "month"])
      .describe("Time granularity: minute, hour, day, week, or month"),
    interval: z
      .number()
      .describe("Number of units to return. Use either interval or dates.")
      .optional(),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive). Use with toDate.")
      .optional(),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive). Use with fromDate.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    event,
    type = "general",
    unit,
    interval,
    fromDate,
    toDate,
  }) => {
    try {
      validateIntervalOrDates(interval, fromDate, toDate);

      const params = buildParams({
        project_id: projectId,
        type,
        unit,
        event,
        interval,
        from_date: interval === undefined ? fromDate : undefined,
        to_date: interval === undefined ? toDate : undefined,
      });

      const data = await client.get("/query/events", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching event counts");
    }
  }
);

/**
 * Retrieves unique, general, or average data for a single event property over time.
 * Useful for analyzing how specific properties affect event performance,
 * segmenting users, and identifying valuable user attributes.
 */
server.tool(
  "aggregatedEventPropertyValues",
  "Get unique, general, or average data for a single event and property over days, weeks, or months. Useful for analyzing how specific properties affect event performance, segmenting users, and identifying valuable user attributes.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    name: z.string().describe("The property name to analyze"),
    values: z
      .string()
      .describe(
        'Specific property values as a JSON array string. Example: "[\\"female\\", \\"unknown\\"]"'
      )
      .optional(),
    type: z
      .enum(["general", "unique", "average"])
      .describe("Analysis type: general, unique, or average")
      .optional(),
    unit: z
      .enum(["minute", "hour", "day", "week", "month"])
      .describe("Time granularity"),
    interval: z
      .number()
      .describe("Number of units. Use either interval or dates.")
      .optional(),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format. Use with toDate.")
      .optional(),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format. Use with fromDate.")
      .optional(),
    limit: z
      .number()
      .describe("Maximum values to return. Default is 255.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    event,
    name,
    values,
    type = "general",
    unit,
    interval,
    fromDate,
    toDate,
    limit,
  }) => {
    try {
      validateIntervalOrDates(interval, fromDate, toDate);

      const params = buildParams({
        project_id: projectId,
        event,
        name,
        type,
        unit,
        values,
        limit,
        interval,
        from_date: interval === undefined ? fromDate : undefined,
        to_date: interval === undefined ? toDate : undefined,
      });

      const data = await client.get("/query/events/properties", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching aggregated event property values");
    }
  }
);

/**
 * Retrieves top property names for an event.
 * Useful for discovering which properties are most commonly associated with an event,
 * prioritizing analysis dimensions, and understanding event structure.
 */
server.tool(
  "topEventProperties",
  "Get the top property names for an event. Useful for discovering which properties are most commonly associated with an event, prioritizing which dimensions to analyze, and understanding event structure.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    limit: z
      .number()
      .describe("Maximum properties to return. Defaults to 10.")
      .optional(),
  },
  async ({ projectId = Config.defaultProjectId, workspaceId, event, limit }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        limit,
      });

      const data = await client.get("/query/events/properties/top", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching top event properties");
    }
  }
);

/**
 * Retrieves top values for a specific event property.
 * Useful for understanding value distributions, identifying most common categories,
 * and planning targeted analyses.
 */
server.tool(
  "topEventPropertyValues",
  "Get the top values for a property. Useful for understanding the distribution of values for a specific property, identifying the most common categories or segments, and planning further targeted analyses.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    name: z.string().describe("The property name"),
    limit: z
      .number()
      .describe("Maximum values to return. Defaults to 255.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    event,
    name,
    limit,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        name,
        limit,
      });

      const data = await client.get("/query/events/properties/values", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(
        error,
        "Error fetching top event property values"
      );
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - User Profiles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves event activity data for a user profile.
 * Useful for understanding individual user journeys,
 * troubleshooting user-specific issues, and analyzing behavior patterns.
 */
server.tool(
  "profileEventActivity",
  "Get data for a profile's event activity. Useful for understanding individual user journeys, troubleshooting user-specific issues, and analyzing behavior patterns of specific users.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    distinctIds: z
      .string()
      .describe(
        'JSON array of distinct IDs. Example: "[\\"12a34aa567eb8d-9ab1c26f345b67-89123c45-6aeaa7-89f12af345f678\\"]"'
      ),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    distinctIds,
    fromDate,
    toDate,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        distinct_ids: distinctIds,
        from_date: fromDate,
        to_date: toDate,
      });

      const data = await client.get("/query/stream/query", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching profile event activity");
    }
  }
);

/**
 * Queries Mixpanel user profiles with filtering options.
 * Useful for retrieving detailed user profiles, filtering by specific properties,
 * and analyzing user behavior across different dimensions.
 */
server.tool(
  "queryProfiles",
  "Query Mixpanel user profiles with filtering options. Useful for retrieving detailed user profiles, filtering by specific properties, and analyzing user behavior across different dimensions.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    distinctId: z
      .string()
      .describe("A unique identifier for a profile")
      .optional(),
    distinctIds: z
      .string()
      .describe('JSON array of distinct IDs. Example: "[\\"id1\\", \\"id2\\"]"')
      .optional(),
    dataGroupId: z
      .string()
      .describe("Group key ID for group profiles")
      .optional(),
    where: z
      .string()
      .describe("Filter expression using property syntax")
      .optional(),
    outputProperties: z
      .string()
      .describe(
        'JSON array of property names. Example: "[\\"$last_name\\", \\"$email\\"]"'
      )
      .optional(),
    sessionId: z
      .string()
      .describe("Session ID from previous query for pagination")
      .optional(),
    page: z.number().describe("Page number (starting at 0)").optional(),
    behaviors: z.number().describe("Number of behaviors to return").optional(),
    asOfTimestamp: z
      .number()
      .describe("Timestamp for behaviors parameter")
      .optional(),
    filterByCohort: z
      .string()
      .describe('Cohort filter. Example: "{\\"id\\": 12345}"')
      .optional(),
    includeAllUsers: z
      .boolean()
      .describe("Include all users when using cohort filter. Defaults to true.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    distinctId,
    distinctIds,
    dataGroupId,
    where,
    outputProperties,
    sessionId,
    page,
    behaviors,
    asOfTimestamp,
    filterByCohort,
    includeAllUsers,
  }) => {
    try {
      const formData = buildFormData({
        distinct_id: distinctId,
        distinct_ids: distinctIds,
        data_group_id: dataGroupId,
        where,
        output_properties: outputProperties,
        session_id: sessionId,
        page,
        behaviors,
        as_of_timestamp: asOfTimestamp,
        filter_by_cohort: filterByCohort,
        include_all_users: includeAllUsers,
      });

      const queryParams = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
      });

      const data = await client.post("/query/engage", formData, queryParams);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error querying profiles");
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - Retention & Engagement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves retention report data.
 * Useful for analyzing user engagement over time, measuring product stickiness,
 * and understanding how well the product retains users after specific actions.
 */
server.tool(
  "queryRetentionReport",
  "Get data from your Retention reports. Useful for analyzing user engagement over time, measuring product stickiness, and understanding how well your product retains users after specific actions. Only use params interval or unit, not both.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    retentionType: z
      .enum(["birth", "compounded"])
      .describe("Retention type: 'birth' (first time) or 'compounded' (recurring)")
      .optional(),
    bornEvent: z
      .string()
      .describe(
        "First event for birth cohort. Required if retentionType is 'birth'"
      )
      .optional(),
    event: z
      .string()
      .describe("Event to generate returning counts. If omitted, checks all events")
      .optional(),
    bornWhere: z
      .string()
      .describe("Filter expression for born events")
      .optional(),
    returnWhere: z
      .string()
      .describe("Filter expression for return events")
      .optional(),
    interval: z
      .number()
      .describe("Buckets per interval. DO NOT USE IF ALREADY PROVIDING UNIT.")
      .optional(),
    intervalCount: z
      .number()
      .describe("Number of intervals. DO NOT USE IF ALREADY PROVIDING UNIT.")
      .optional(),
    unit: z
      .enum(["day", "week", "month"])
      .describe("Interval unit. DO NOT USE IF ALREADY PROVIDING INTERVAL.")
      .optional(),
    on: z.string().describe("Property expression to segment by").optional(),
    limit: z
      .number()
      .describe("Top values to return. Only applies with 'on'.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    fromDate,
    toDate,
    retentionType,
    bornEvent,
    event,
    bornWhere,
    returnWhere,
    interval,
    intervalCount,
    unit,
    on,
    limit,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        from_date: fromDate,
        to_date: toDate,
        retention_type: retentionType,
        born_event: bornEvent,
        event,
        born_where: bornWhere,
        where: returnWhere,
        interval,
        interval_count: intervalCount,
        unit,
        on,
        limit,
      });

      const data = await client.get("/query/retention", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching retention data");
    }
  }
);

/**
 * Retrieves frequency report data.
 * Useful for analyzing how often users perform specific actions,
 * identifying behavior patterns, and tracking user engagement.
 */
server.tool(
  "queryFrequencyReport",
  "Get data for frequency of actions over time. Useful for analyzing how often users perform specific actions, identifying patterns of behavior, and tracking user engagement over time.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    unit: z
      .enum(["day", "week", "month"])
      .describe("Overall time period"),
    addictionUnit: z
      .enum(["hour", "day"])
      .describe("Granularity level"),
    event: z
      .string()
      .describe("Event to generate counts for")
      .optional(),
    where: z.string().describe("Filter expression for events").optional(),
    on: z
      .string()
      .describe("Property expression to segment by")
      .optional(),
    limit: z
      .number()
      .describe("Top values to return. Only applies with 'on'.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    fromDate,
    toDate,
    unit,
    addictionUnit,
    event,
    where,
    on,
    limit,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        from_date: fromDate,
        to_date: toDate,
        unit,
        addiction_unit: addictionUnit,
        event,
        where,
        on,
        limit,
      });

      const data = await client.get("/query/retention/addiction", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching frequency report");
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - Segmentation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves segmentation report data.
 * Useful for breaking down event data by user attributes,
 * comparing performance across segments, and identifying behavioral groups.
 */
server.tool(
  "querySegmentationReport",
  "Get data for an event, segmented and filtered by properties. Useful for breaking down event data by user attributes, comparing performance across segments, and identifying which user groups perform specific actions.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    on: z
      .string()
      .describe("Property expression to segment by")
      .optional(),
    unit: z
      .enum(["minute", "hour", "day", "month"])
      .describe("Time bucket size. Defaults to 'day'.")
      .optional(),
    interval: z
      .number()
      .describe("Number of days to bucket (alternative to 'unit')")
      .optional(),
    where: z
      .string()
      .describe("Filter expression for events")
      .optional(),
    limit: z
      .number()
      .describe("Maximum values to return. Defaults to 60.")
      .optional(),
    type: z
      .enum(["general", "unique", "average"])
      .describe("Analysis type: general, unique, or average")
      .optional(),
    format: z
      .enum(["csv"])
      .describe("Output format. Can be 'csv'.")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    event,
    fromDate,
    toDate,
    on,
    unit,
    interval,
    where,
    limit,
    type,
    format,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        from_date: fromDate,
        to_date: toDate,
        on,
        unit,
        interval,
        where,
        limit,
        type,
        format,
      });

      const data = await client.get("/query/segmentation", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error querying segmentation report");
    }
  }
);

/**
 * Retrieves segmentation data with numeric values placed into buckets.
 * Useful for analyzing distributions, creating histograms,
 * and understanding ranges of quantitative metrics.
 */
server.tool(
  "querySegmentationBucket",
  "Get data for an event, segmented and filtered by properties, with values placed into numeric buckets. Useful for analyzing distributions of numeric values, creating histograms, and understanding the range of quantitative metrics.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    on: z
      .string()
      .describe("Property expression (must be numeric)"),
    unit: z
      .enum(["hour", "day"])
      .describe("Time bucket size. Defaults to 'day'.")
      .optional(),
    where: z
      .string()
      .describe("Filter expression for events")
      .optional(),
    type: z
      .enum(["general", "unique", "average"])
      .describe("Analysis type: general, unique, or average")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    event,
    fromDate,
    toDate,
    on,
    unit,
    where,
    type,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        from_date: fromDate,
        to_date: toDate,
        on,
        unit,
        where,
        type,
      });

      const data = await client.get("/query/segmentation/numeric", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error querying segmentation bucket");
    }
  }
);

/**
 * Averages an expression for events per unit time.
 * Useful for calculating average values like purchase amounts and session durations,
 * and tracking how these averages change over time.
 */
server.tool(
  "querySegmentationAverage",
  "Averages an expression for events per unit time. Useful for calculating average values like purchase amounts, session durations, or any numeric metric, and tracking how these averages change over time.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    on: z
      .string()
      .describe("Expression to average (must return numeric value)"),
    unit: z
      .enum(["hour", "day"])
      .describe("Time bucket size. Defaults to 'day'.")
      .optional(),
    where: z
      .string()
      .describe("Filter expression for events")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    event,
    fromDate,
    toDate,
    on,
    unit,
    where,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        from_date: fromDate,
        to_date: toDate,
        on,
        unit,
        where,
      });

      const data = await client.get("/query/segmentation/average", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error querying segmentation average");
    }
  }
);

/**
 * Sums a numeric expression for events over time.
 * Useful for calculating revenue metrics, aggregating quantitative values,
 * and tracking cumulative totals.
 */
server.tool(
  "querySegmentationSum",
  "Sum a numeric expression for events over time. Useful for calculating revenue metrics, aggregating quantitative values, and tracking cumulative totals across different time periods.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    event: z
      .string()
      .describe("The event name (single event, not an array)"),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    on: z
      .string()
      .describe("Expression to sum (must return numeric value)"),
    unit: z
      .enum(["hour", "day"])
      .describe("Time bucket size. Defaults to 'day'.")
      .optional(),
    where: z
      .string()
      .describe("Filter expression for events")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    event,
    fromDate,
    toDate,
    on,
    unit,
    where,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        event,
        from_date: fromDate,
        to_date: toDate,
        on,
        unit,
        where,
      });

      const data = await client.get("/query/segmentation/sum", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error querying segmentation sum");
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - Funnels & Cohorts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves funnel report data by funnel ID.
 * Useful for analyzing user conversion paths, identifying drop-off points,
 * and optimizing multi-step processes.
 */
server.tool(
  "queryFunnelReport",
  "Get data for a funnel based on a funnel_id. Useful for analyzing user conversion paths, identifying drop-off points in user journeys, and optimizing multi-step processes. Funnel IDs should be retrieved using the listSavedFunnels tool.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    funnelId: z.string().describe("The funnel ID to query"),
    fromDate: dateSchema
      .describe("Start date in yyyy-mm-dd format (inclusive)"),
    toDate: dateSchema
      .describe("End date in yyyy-mm-dd format (inclusive)"),
    length: z
      .number()
      .describe("Time units for users to complete the funnel")
      .optional(),
    lengthUnit: z
      .enum(["day", "hour", "minute", "second"])
      .describe("Unit for length parameter")
      .optional(),
    interval: z
      .number()
      .describe("Number of days per bucket")
      .optional(),
    unit: z
      .enum(["day", "week", "month"])
      .describe("Alternate way to specify interval")
      .optional(),
  },
  async ({
    projectId = Config.defaultProjectId,
    workspaceId,
    funnelId,
    fromDate,
    toDate,
    length,
    lengthUnit,
    interval,
    unit,
  }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        funnel_id: funnelId,
        from_date: fromDate,
        to_date: toDate,
        length,
        length_unit: lengthUnit,
        interval,
        unit,
      });

      const data = await client.get("/query/funnels", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching funnel data");
    }
  }
);

/**
 * Retrieves names and IDs of saved funnels.
 * Useful for discovering available funnels and retrieving IDs for analysis.
 */
server.tool(
  "listSavedFunnels",
  "Get the names and IDs of your saved funnels. Useful for discovering available funnels for analysis and retrieving funnel IDs needed for the queryFunnelReport tool.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
  },
  async ({ projectId = Config.defaultProjectId, workspaceId }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
      });

      const data = await client.get("/query/funnels/list", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching funnels list");
    }
  }
);

/**
 * Retrieves all cohorts in a given project.
 * Useful for discovering user segments and planning targeted analyses.
 */
server.tool(
  "listSavedCohorts",
  "Get all cohorts in a given project. Useful for discovering user segments, planning targeted analyses, and retrieving cohort IDs for filtering in other reports.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
  },
  async ({ projectId = Config.defaultProjectId, workspaceId }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
      });

      const data = await client.get("/query/cohorts/list", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching cohorts list");
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Tool Registration - Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves data from saved Insights reports.
 * Useful for accessing saved analyses, sharing standardized metrics,
 * and retrieving complex pre-configured visualizations.
 */
server.tool(
  "queryInsightsReport",
  "Get data from your Insights reports. Useful for accessing saved analyses, sharing standardized metrics across teams, and retrieving complex pre-configured visualizations.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    bookmarkId: z.string().describe("The Insights report ID"),
  },
  async ({ projectId = Config.defaultProjectId, workspaceId, bookmarkId }) => {
    try {
      const params = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
        bookmark_id: bookmarkId,
      });

      const data = await client.get("/query/insights", params);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error fetching insights report");
    }
  }
);

/**
 * Executes a custom JQL (JSON Query Language) script.
 * Useful for complex custom analyses, advanced data transformations,
 * and queries that can't be handled by standard report types.
 */
server.tool(
  "customJql",
  "Run a custom JQL (JSON Query Language) script against your Mixpanel data. Useful for complex custom analyses, advanced data transformations, and queries that can't be handled by standard report types.",
  {
    projectId: z
      .string()
      .describe("The Mixpanel project ID. Optional since it has a default.")
      .optional(),
    workspaceId: z
      .string()
      .describe("The workspace ID if applicable")
      .optional(),
    script: z
      .string()
      .describe(
        "The JQL script to run (JavaScript code using Mixpanel's JQL functions)"
      ),
    params: z
      .string()
      .describe("JSON string of parameters (available as 'params' variable)")
      .optional(),
  },
  async ({ projectId = Config.defaultProjectId, workspaceId, script, params: jqlParams }) => {
    try {
      const formData = buildFormData({ script, params: jqlParams });
      const queryParams = buildParams({
        project_id: projectId,
        workspace_id: workspaceId,
      });

      const data = await client.post("/query/jql", formData, queryParams);
      return client.formatSuccess(data);
    } catch (error) {
      return client.handleError(error, "Error executing JQL query");
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts the MCP server and connects to stdio transport.
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MIXPANEL MCP SERVER RUNNING ON STDIO");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
