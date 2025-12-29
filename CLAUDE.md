# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Docusaurus 3.5.2 documentation site for Apertis (formerly Stima API), a platform providing API access to various AI models. Production URL: https://docs.stima.tech

## Common Commands

```bash
# Development
npm start                # Start dev server
npm run start:en         # Start with English locale only

# Build
npm run build            # Build production site
npm run build:en         # Build with English locale only
npm run clear            # Clear Docusaurus cache

# Serve built site
npm run serve            # Serve on port 3070, host 0.0.0.0
npm run serve:en         # Serve with English locale only

# Content management
npm run write-translations    # Extract i18n messages
npm run write-heading-ids     # Add heading IDs to markdown
```

## Architecture

### Critical: Route Configuration
- **Docs served at root** (`routeBasePath: ''` in docusaurus.config.js:54)
- `/docs/intro.md` → `https://docs.stima.tech/intro` (NOT `/docs/intro`)

### Content Organization
- `docs/` - All documentation markdown (MDX supported)
- `sidebars.js` - Manually configured sidebar navigation (source of truth for doc structure)
- `src/pages/` - Custom pages (homepage, 404)
- `src/css/` - Theme customization and hover effects

### Sidebar Structure (sidebars.js)
Categories: Getting Started, Authentication, Billing & Quotas, Integrations (nested), API Capabilities (nested), Configuration, API Reference, Security, Help & Support, Additional Resources

### Search
- Uses `@easyops-cn/docusaurus-search-local` (not Algolia)
- Bilingual support (en/zh), custom settings for Chinese text search
- Stop words and stemmer removed for better Chinese handling

### Styling
- Light mode primary: #293A4B
- Dark mode primary: #48a38f
- Custom hover effects in `src/css/hover-highlight.css`

## Brand/Language Context

**Active transition in progress:**
- "Stima API" → "Apertis"
- "StimaChat" → "Web Chat Service"
- UI labels in docusaurus.config.js are in Chinese (Traditional)
- Documentation content is primarily English with some Chinese

When editing:
- Check for both "Stima" and "Apertis" references
- Maintain consistency with the English documentation standard

## Configuration Notes

- Node.js >=18.0 required
- Edit URLs still point to Docusaurus template (should be updated to actual repo)
- Build output: `/build`
- Dev cache: `.docusaurus/`
