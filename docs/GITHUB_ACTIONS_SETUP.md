# GitHub Actions Scraping Setup

## Overview
eClinic scraping has been moved from Vercel API endpoint to GitHub Actions for better reliability and performance. The workflow runs automatically on a schedule and can also be triggered manually.

## Schedule
- **Default**: Every day at 6:00 AM UTC (1:00 PM WIB/1:00 AM EST)
- **Modifiable**: Edit the `cron` expression in `.github/workflows/scrap-eclinic.yml`

Cron format: `minute hour day month day-of-week`
- `0 6 * * *` = 06:00 UTC every day
- `0 1 * * *` = 01:00 UTC every day (7 PM EST previous day)
- `0 0 * * 1` = 00:00 UTC every Monday

## Setup Instructions

### 1. Add Repository Secrets
Go to **Settings → Secrets and variables → Actions** and add:

```
ECLINIC_USERNAME = your_eclinic_username
ECLINIC_PASSWORD = your_eclinic_password
DATABASE_URL = your_database_connection_string
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/... (optional for notifications)
```

### 2. Database URL Format
```
postgresql://username:password@hostname:port/database?sslmode=require
```

### 3. How It Works

**Optimization Features:**
1. **Block Resources**: Images, CSS, fonts are blocked to reduce load and speed up scraping
2. **Headless Mode**: Always true in CI/CD environment
3. **Caching**: 
   - npm dependencies cached per commit hash
   - Playwright browsers cached separately
   - Significantly speeds up workflow execution

**Workflow Steps:**
1. Checkout code
2. Setup Node.js
3. Restore/Save node_modules cache
4. Install dependencies (only if cache miss)
5. Install Playwright browsers
6. Cache Playwright browsers
7. Run `npm run scrap:github`
8. Send Slack notification (success/failure)

## Manual Trigger

Trigger the workflow manually:
1. Go to **Actions** tab
2. Select **Scrap eClinic Data** workflow
3. Click **Run workflow** button
4. Optionally select a branch

## Monitoring

### GitHub Actions Console
View logs in **Actions → Scrap eClinic Data → Latest Run**

### Slack Notifications (Optional)
If configured with `SLACK_WEBHOOK_URL`, you'll receive:
- ✅ Success notification with timestamp
- ❌ Failure notification with link to logs

### Key Log Messages
```
🚀 Starting scrape: ... from ... to ...
📍 Navigating to login page...
🔐 Logging in...
📊 Opening daily income report...
📅 Setting date range...
📊 Scraped X rows
💾 Saving to database...
✅ Data saved successfully
```

## Troubleshooting

### Workflow Fails to Run
- Check if secrets are correctly set
- Verify DATABASE_URL is accessible from GitHub Actions IP
- Check if ECLINIC_USERNAME/PASSWORD are correct

### Timeout Errors
- Increase timeout values in `scrap-github.ts`
- Check if eClinic website is down or slow
- Increase `timeout-minutes` in workflow

### Data Not Saved
- Verify DATABASE_URL is correct
- Check if clinic name matches exactly
- Review GitHub Actions logs for errors

### Playwright Browser Issues
- Cache will auto-clear after 5 days
- Can manually delete cache in Actions settings
- Browsers will be reinstalled on next run

## Environment Variables in Workflow

| Variable | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Secret | Database connection |
| `ECLINIC_USERNAME` | Secret | eClinic login user |
| `ECLINIC_PASSWORD` | Secret | eClinic password |
| `SLACK_WEBHOOK_URL` | Secret | Slack notifications |

## Comparing with API Endpoint

| Aspect | GitHub Actions | API Endpoint |
|---|---|---|
| **Running In** | CI/CD (Always runs) | Vercel (Serverless) |
| **Cost** | GitHub free tier (2000 min/mo) | Vercel (depends on usage) |
| **Dependencies** | Can install system packages | Limited (no apt-get) |
| **Scheduling** | Built-in cron | Manual webhook calls |
| **Playwright** | ✅ Full support | ❌ Not available |
| **Reliability** | High (runs consistently) | Medium (browser not available) |

## Advanced Configuration

### Change Time Zone
GitHub Actions runs in UTC. To convert to WIB:
- UTC 6:00 AM = WIB 1:00 PM (UTC+7)
- UTC 0:00 AM = WIB 7:00 AM (UTC+7)

For EST:
- UTC 6:00 AM = EST 1:00 AM (UTC-5)

### Add Multiple Clinics
Modify `scrap-github.ts` main function to loop through multiple clinics:
```typescript
const clinics = ['CLINIC1', 'CLINIC2', 'CLINIC3']
for (const clinic of clinics) {
  config.clinic_name = clinic
  await scrapeEclinic(config)
}
```

### Disable Notifications
Remove the Slack notification steps from `.github/workflows/scrap-eclinic.yml`

### Change Cron Schedule
Edit `.github/workflows/scrap-eclinic.yml`:
```yaml
on:
  schedule:
    - cron: '0 1 * * *'  # Change this line
```

## Performance Metrics

Typical run times (on GitHub Actions standard runner):
- Setup & install: ~1-2 minutes
- Playwright browsers (first run): ~3-4 minutes  
- Playwright browsers (cached): ~10-15 seconds
- Scraping: ~2-5 minutes
- Database save: ~30 seconds
- **Total**: 3-10 minutes depending on cache

## Cost Analysis (GitHub Free Tier)

- **Free minutes per month**: 2,000 minutes
- **Per run**: ~5 minutes average
- **Runs per month**: ~432 (6 per day)
- **Minutes used**: ~2,160 minutes ❌ Exceeds free tier

**Recommendation**: Increase schedule interval to every 2-3 days or keep only 1 run per day.

## Next Steps

1. ✅ Add secrets to GitHub repository
2. ✅ Verify workflow file exists (`.github/workflows/scrap-eclinic.yml`)
3. ✅ Go to Actions tab and confirm workflow shows
4. ✅ Optionally manually trigger first run
5. ✅ Monitor logs and set up Slack notifications
6. ✅ Adjust schedule based on your needs
