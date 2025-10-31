# Mixpanel MCP Server

A comprehensive Model Context Protocol (MCP) server for the Mixpanel Analytics API. Query events, retention data, funnels, cohorts, and more directly from your MCP client (Claude Desktop, Cursor, etc.).

## Overview

This MCP server provides 23 tools for interacting with Mixpanel data:

- **Event Analytics**: Top events, event counts, property analysis
- **User Profiles**: Profile queries and event activity tracking
- **Retention & Engagement**: Retention reports and frequency analysis
- **Segmentation**: Event segmentation by properties and time periods
- **Funnels & Cohorts**: Funnel analysis and cohort discovery
- **Custom Reports**: Saved Insights reports and custom JQL queries

Perfect for ad-hoc data exploration: "What's the weekly retention for users in the Feb 1 cohort?" or "Show me the top events from today."

## Prerequisites

1. A Mixpanel project with access to the Analytics API
2. A [Mixpanel Service Account](https://developer.mixpanel.com/reference/service-accounts)
   - Service Account username
   - Service Account password
3. Your Mixpanel Project ID (found in Project Settings)

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Configure credentials (see [Configuration](#configuration) section)
5. Add to your MCP client with the command below

## Configuration

### Using Environment Variables (Recommended)

Set these environment variables before running the server:

```bash
export SERVICE_ACCOUNT_USER_NAME=your_username
export SERVICE_ACCOUNT_PASSWORD=your_password
export DEFAULT_PROJECT_ID=your_project_id
export MIXPANEL_API_BASE_URL=https://eu.mixpanel.com/api  # or https://mixpanel.com/api for US
```

Create a `.env` file:

```bash
SERVICE_ACCOUNT_USER_NAME=your_username
SERVICE_ACCOUNT_PASSWORD=your_password
DEFAULT_PROJECT_ID=your_project_id
MIXPANEL_API_BASE_URL=https://eu.mixpanel.com/api
```

### Using Command-Line Arguments

Pass credentials as command-line arguments:

```bash
node /ABSOLUTE/PATH/TO/mixpanel-mcp/build/index.js YOUR_USERNAME YOUR_PASSWORD YOUR_PROJECT_ID
```

### Cluster Configuration

**European Cluster (Default):**
```bash
MIXPANEL_API_BASE_URL=https://eu.mixpanel.com/api
```

**US Cluster:**
```bash
MIXPANEL_API_BASE_URL=https://mixpanel.com/api
```

## Usage

### In Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mixpanel": {
      "command": "node",
      "args": ["/absolute/path/to/build/index.js"],
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

### In Cursor

1. Go to Settings → Cursor Settings → Features → MCP Servers
2. Click "+ Add"
3. Select Type: `command`
4. Set Command: `node`
5. Set Arguments: `["/absolute/path/to/build/index.js"]`
6. Add Environment Variables with your credentials

## Documentation

For detailed information about the architecture, design patterns, and how to extend the server, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Examples
- Ask about retention numbers

<img width="500" alt="IMG_3675" src="https://github.com/user-attachments/assets/5999958e-d4f6-4824-b226-50ad416ab064" />


- Ask for an overview of events

<img width="500" alt="IMG_9968" src="https://github.com/user-attachments/assets/c05cd932-5ca8-4a5b-a31c-7da2c4f2fa77" />