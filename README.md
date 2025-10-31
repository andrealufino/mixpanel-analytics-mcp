# Mixpanel Analytics MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

Query your Mixpanel analytics data directly from Claude. Access events, retention, funnels, cohorts, and more through natural language conversations.

**Note:** This is an unofficial project and is not affiliated with Mixpanel.

## About This Project

This project was created as a personal tool by an iOS/macOS developer to query Mixpanel analytics through Claude. While my primary expertise lies in Apple platform development, I built this MCP server to streamline my own workflow and am sharing it in case others find it useful. The project was developed and tested with AI assistance.

## Features

Unlock powerful Mixpanel analytics capabilities through Claude with 19 specialized tools:

### 📊 Event Analytics (6 tools)
- **getTodayTopEvents** - Discover today's most active events
- **getTopEvents** - Identify trending events over the last 31 days
- **aggregateEventCounts** - Analyze event volume trends across days, weeks, or months
- **aggregatedEventPropertyValues** - Track how specific properties evolve over time
- **topEventProperties** - Discover which properties are most commonly tracked
- **topEventPropertyValues** - Understand value distributions for any event property

### 👥 User Profiles (2 tools)
- **profileEventActivity** - Examine individual user journeys and behavior patterns
- **queryProfiles** - Search and filter user profiles by custom criteria

### 📈 Retention & Engagement (2 tools)
- **queryRetentionReport** - Measure user stickiness with birth and compounded cohort analysis
- **queryFrequencyReport** - Analyze how often users perform specific actions

### 🎯 Segmentation (4 tools)
- **querySegmentationReport** - Break down events by user properties and attributes
- **querySegmentationBucket** - Create histograms of numeric property distributions
- **querySegmentationAverage** - Calculate average metrics across time periods
- **querySegmentationSum** - Aggregate revenue, costs, and other numeric totals

### 🔗 Funnels & Cohorts (3 tools)
- **queryFunnelReport** - Analyze conversion rates and identify drop-off points
- **listSavedFunnels** - Discover available funnels in your project
- **listSavedCohorts** - Browse user segments and cohorts

### 📋 Reports & Advanced (2 tools)
- **queryInsightsReport** - Access your saved Insights reports
- **customJql** - Run custom JQL (JSON Query Language) scripts for complex analyses

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- [Mixpanel Service Account](https://developer.mixpanel.com/reference/service-accounts) credentials (username and password)
- Your Mixpanel Project ID
- Claude Desktop or Claude Code (for using the MCP)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/andrealufino/mixpanel-analytics-mcp.git
   cd mixpanel-analytics-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mixpanel": {
      "command": "node",
      "args": ["/absolute/path/to/mixpanel-mcp/build/index.js"],
      "env": {
        "SERVICE_ACCOUNT_USER_NAME": "your_username",
        "SERVICE_ACCOUNT_PASSWORD": "your_password",
        "DEFAULT_PROJECT_ID": "your_project_id",
        "MIXPANEL_API_BASE_URL": "https://eu.mixpanel.com/api"
      }
    }
  }
}
```

### Claude Code

Add to your MCP settings (`.claudeconfig` or via Settings UI):

```json
{
  "mcpServers": {
    "mixpanel": {
      "command": "node",
      "args": ["/absolute/path/to/mixpanel-mcp/build/index.js"],
      "env": {
        "SERVICE_ACCOUNT_USER_NAME": "your_username",
        "SERVICE_ACCOUNT_PASSWORD": "your_password",
        "DEFAULT_PROJECT_ID": "your_project_id",
        "MIXPANEL_API_BASE_URL": "https://eu.mixpanel.com/api"
      }
    }
  }
}
```

**Note:** For US cluster, use `https://mixpanel.com/api` instead.

## Usage

Once configured, ask Claude natural language questions about your Mixpanel data:

### Event Analytics Examples
- "What are the top events from today?"
- "Show me the trend of 'purchase' events over the last 7 days"
- "What properties are tracked with the 'sign_up' event?"
- "Which values does the 'plan_type' property have, and which are most common?"

### User & Retention Examples
- "Show me the event history for user ID 12345"
- "What's the retention rate for users who signed up on Jan 15?"
- "Analyze weekly retention for our premium users"
- "How often do users perform the 'purchase' action?"

### Segmentation & Funnel Examples
- "Break down the 'login' event by country"
- "What's the average order value across different plan types?"
- "Show me the funnel conversion for our sign-up flow"
- "Which cohorts have the best retention?"

### Advanced Examples
- "Run a custom JQL query to find the average time between signup and first purchase"
- "Compare retention between users in different regions"
- "What's the correlation between feature usage and retention?"

## Troubleshooting

### Configuration Issues

**Error: "Mixpanel service account credentials not configured"**
- Ensure all environment variables are set: `SERVICE_ACCOUNT_USER_NAME`, `SERVICE_ACCOUNT_PASSWORD`, `DEFAULT_PROJECT_ID`
- Check that credentials are valid in your Mixpanel workspace
- Verify the service account exists: [Mixpanel Service Accounts](https://developer.mixpanel.com/reference/service-accounts)

**Error: "API request failed with status 401"**
- Your credentials may be expired or incorrect
- Verify your service account credentials in the Mixpanel UI
- Try regenerating your service account password

**Error: "API request failed with status 400"**
- Check your date formats (must be `yyyy-mm-dd`)
- Verify event names and property names exist in your project
- Check that required parameters are provided

**Wrong API endpoint/cluster**
- For EU: Set `MIXPANEL_API_BASE_URL=https://eu.mixpanel.com/api`
- For US: Set `MIXPANEL_API_BASE_URL=https://mixpanel.com/api`

### Claude Integration Issues

**Tools not appearing in Claude**
- Rebuild the project: `npm run build`
- Restart Claude Desktop/Code
- Check the MCP server logs for startup errors

**Slow responses**
- Large date ranges may take longer - try narrowing the timeframe
- Complex JQL queries may need optimization
- Check your Mixpanel quota usage

## Development

### Building Locally

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the test suite
node test-mcp.js
```

### Project Structure

```
mixpanel-analytics-mcp/
├── src/
│   └── index.ts          # Main MCP server and tool implementations
├── build/                # Compiled JavaScript (generated)
├── package.json          # Project metadata and dependencies
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variable template
├── README.md             # This file
├── ARCHITECTURE.md       # Detailed architecture documentation
└── LICENSE               # MIT License
```

### Testing

Run the included test suite to verify the setup:

```bash
node test-mcp.js
```

This validates:
- Build artifacts are present and executable
- Configuration structure is correct
- TypeScript compilation succeeded
- All dependencies are installed
- Server structure is complete

### Adding New Tools

To add new Mixpanel API endpoints as tools:

1. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the extension guide
2. Add the tool definition to `src/index.ts`
3. Use the `MixpanelClient` class for API calls
4. Define Zod schemas for parameters
5. Run `npm run build` to compile
6. Test with the test suite

### Code Style

The project uses:
- **TypeScript** with strict type checking enabled
- **Zod** for runtime schema validation
- **JSDoc** comments for documentation
- Organized tool groupings with MARK comments

## Documentation

### Main References
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture, design patterns, and extension guide
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[MCP Protocol](https://modelcontextprotocol.io/)** - Learn about the Model Context Protocol
- **[Mixpanel API Docs](https://developer.mixpanel.com/reference/api)** - Full Mixpanel API reference

## License

MIT - See [LICENSE](./LICENSE) for details

---

Made with ❤️ by [Andrea Mario Lufino](https://github.com/andrealufino)
