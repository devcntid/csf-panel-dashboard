# csfdashboard

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/dev-cntids-projects/v0-csfdashboard)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/d9BugSWzlu1)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/dev-cntids-projects/v0-csfdashboard](https://vercel.com/dev-cntids-projects/v0-csfdashboard)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/d9BugSWzlu1](https://v0.app/chat/d9BugSWzlu1)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Scraping with GitHub Actions

This project includes automated web scraping via GitHub Actions:

- **Workflow**: `.github/workflows/scrap-eclinic.yml`
- **Schedule**: Daily at 6:00 AM UTC
- **Script**: `scripts/scrap-github.ts`
- **Features**: Resource blocking, caching, optimized for CI/CD

**Setup Instructions**: See [GitHub Actions Setup Guide](./docs/GITHUB_ACTIONS_SETUP.md)

**Why GitHub Actions instead of Vercel API?**
- Playwright browsers fully supported
- Better resource isolation
- Automated scheduling
- Free tier: 2,000 minutes/month

For migration details, see [Migration Guide](./docs/MIGRATION_TO_GITHUB_ACTIONS.md)
