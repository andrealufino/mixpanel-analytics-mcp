# Mixpanel MCP Server

Query your Mixpanel analytics data directly from Claude. Access events, retention, funnels, cohorts, and more through natural language.

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`

## Setup

### Prerequisites

- [Mixpanel Service Account](https://developer.mixpanel.com/reference/service-accounts) credentials
- Your Mixpanel Project ID

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

Ask Claude questions like:
- "What are the top events from today?"
- "Show me weekly retention for the Feb 1 cohort"
- "What's the funnel conversion for sign-up flow?"

## Documentation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture and extension guide.

## License

MIT
