# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-31

### Added
- Initial public release
- **19 MCP tools** for Mixpanel analytics queries:
  - 6 Event Analytics tools (top events, aggregation, properties)
  - 2 User Profile tools (activity, profile queries)
  - 2 Retention & Engagement tools (retention reports, frequency analysis)
  - 4 Segmentation tools (segmentation, bucketing, averages, sums)
  - 3 Funnels & Cohorts tools (funnel reports, funnel listing, cohort listing)
  - 2 Reports tools (Insights reports, custom JQL)
- Configuration management via environment variables
- Support for both EU and US Mixpanel clusters
- Comprehensive error handling and validation
- TypeScript with strict type checking
- Zod schema validation for all tool parameters
- JSDoc documentation for all functions and tools
- Support for Claude Desktop and Claude Code
- Test suite for verifying setup and configuration
- Detailed ARCHITECTURE.md documentation
- MIT License

### Features
- Query Mixpanel analytics data via natural language through Claude
- Event analytics including top events, trends, and property analysis
- User profile queries and event activity tracking
- Retention and engagement metrics
- Advanced segmentation and filtering capabilities
- Funnel analysis and cohort management
- Custom JQL query support for advanced analytics
- Proper credential management with environment variables
- Comprehensive error messages and troubleshooting guidance

### Security
- No hardcoded secrets or credentials
- Secure environment variable handling
- Base64 encoding for authentication headers
- HTTPS for all API communications
- Proper gitignore configuration for sensitive files

---

## Future Releases

Planned improvements and features:
- Additional Mixpanel API endpoints as they become available
- Enhanced caching for frequently accessed data
- Custom analytics transformations
- Export functionality for query results
- Webhook support for real-time alerts
- Additional authentication methods
