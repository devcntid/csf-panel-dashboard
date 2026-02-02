# Scrap Queue System Documentation

## Overview

Sistem queue untuk manual scraping requests dengan GitHub Actions. User dapat trigger scraping dari UI (`/dashboard/transaksi`), dan requests akan diproses otomatis melalui GitHub Actions setiap 30 menit.

## Architecture

```
User clicks "Scrap" button on /dashboard/transaksi
        ↓
POST /api/scrap/queue (add request to queue)
        ↓
scrap_queue table (pending request stored)
        ↓
GitHub Actions (every 30 min / manual trigger)
        ↓
/scripts/scrap-github-queue.ts (process queue items)
        ↓
Database updated with transaction data
```

## Setup Instructions

### 1. Create Queue Table

```bash
npm run scrap:queue:table
```

Ini akan membuat tabel `scrap_queue` dengan columns:
- `id` (PRIMARY KEY)
- `clinic_id` (FOREIGN KEY)
- `tgl_awal`, `tgl_akhir` (dates)
- `status` ('pending', 'processing', 'completed', 'failed')
- `requested_by` (who triggered the scrape)
- `github_run_id` (GitHub Actions run ID)
- `error_message` (if failed)
- Timestamps: `created_at`, `updated_at`, `started_at`, `completed_at`

### 2. Configure GitHub Secrets

Add these to your repository Settings → Secrets → Actions:

```
DATABASE_URL          # Your database connection string
ECLINIC_USERNAME      # Default eClinic username (for fallback)
ECLINIC_PASSWORD      # Default eClinic password (for fallback)
SLACK_WEBHOOK_URL     # (Optional) For notifications
GITHUB_ACTIONS_TOKEN  # (Optional) For authentication
```

### 3. Enable Workflows

- Go to Actions → Enable workflows if not already enabled
- Two workflows will be available:
  1. `scrap-eclinic.yml` - Scheduled daily scrape at 6:00 AM
  2. `scrap-from-queue.yml` - Process manual requests every 30 minutes

## How It Works

### Manual Scrap from UI

1. User selects clinic, date range on `/dashboard/transaksi`
2. Clicks "Scrap" button
3. Request sent to `POST /api/scrap/queue`
4. Response: "Request queued. Data will be updated via GitHub Actions"
5. Request stored in `scrap_queue` table with status 'pending'

### GitHub Actions Processing

Every 30 minutes (or on manual trigger):

1. Workflow runs `npm run scrap:github:queue`
2. Script queries database for `status = 'pending'` (limit 5)
3. For each request:
   - Updates status to 'processing'
   - Launches Playwright browser
   - Blocks resources (images, CSS, fonts) for speed
   - Logs in to eClinic with clinic credentials
   - Extracts transaction data
   - Inserts into database
   - Updates status to 'completed' or 'failed'
4. Sends Slack notification (if configured)

### Manual Trigger

You can manually trigger processing:

1. Go to GitHub → Actions → "Scrap from Queue"
2. Click "Run workflow"
3. Optionally set "limit" (default: 10)
4. Workflow executes immediately

## API Endpoints

### POST /api/scrap/queue

Add scrape request to queue.

**Request:**
```json
{
  "clinic_id": 1,
  "tgl_awal": "2026-02-01",
  "tgl_akhir": "2026-02-28",
  "requested_by": "username"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scrape request queued successfully",
  "queue_id": 123,
  "status": "pending"
}
```

### GET /api/scrap/queue

List pending/completed/failed requests.

**Query Parameters:**
- `status` - 'pending', 'completed', 'failed' (default: 'pending')
- `limit` - max results (default: 10)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "requests": [
    {
      "id": 123,
      "clinic_id": 1,
      "status": "pending",
      "created_at": "2026-02-02T10:30:00Z"
    }
  ]
}
```

### PATCH /api/scrap/process-queue

Update queue item status (called by GitHub Actions).

**Request:**
```json
{
  "queue_id": 123,
  "status": "completed",
  "error_message": null,
  "github_run_id": "123456789"
}
```

## Performance Optimizations

1. **Block Resources**: Images, CSS, fonts tidak diload → ~40-60% faster
2. **Headless Mode**: Always true for minimal resource usage
3. **Browser Caching**: Playwright browsers cached in GitHub Actions
4. **Sequential Processing**: Process 1 item at a time to avoid rate limiting
5. **Delay Between Requests**: 2-second delay between clinic scrapes

## Monitoring

### Check Queue Status

```bash
# List pending requests
curl "https://your-domain/api/scrap/queue?status=pending"

# List completed requests
curl "https://your-domain/api/scrap/queue?status=completed&limit=20"

# List failed requests
curl "https://your-domain/api/scrap/queue?status=failed"
```

### View GitHub Actions Logs

1. Go to GitHub → Actions
2. Click on workflow run
3. View "Process queue (scheduled/triggered)" step
4. Check logs for any errors

### Slack Notifications

If `SLACK_WEBHOOK_URL` is configured:
- ✅ Success notification when requests are processed
- ❌ Failure notification with link to logs

## Troubleshooting

### Queue items stuck in 'processing'

If a request remains in 'processing' status:
1. Check GitHub Actions logs for errors
2. Manually update status:
   ```sql
   UPDATE scrap_queue SET status = 'failed', error_message = 'Manual reset' WHERE id = {id};
   ```
3. Trigger workflow again

### Playwright browser not found

Error: `Executable doesn't exist at...`

Solution: Playwright browsers will be auto-installed in GitHub Actions. If manual run:
```bash
npx playwright install chromium
```

### Clinic credentials invalid

If many requests fail with auth error:
1. Verify eClinic credentials in GitHub Secrets
2. Check if eClinic website is accessible
3. Verify clinic data in database has correct `username`, `password`

### Rate limiting from eClinic

If getting "Too many requests":
1. Reduce `PROCESS_LIMIT` in workflow
2. Increase delay between requests in script
3. Spread requests across multiple time windows

## Migration from Direct API

If previously using direct `/api/scrap` POST:

**Old (Vercel, no longer works):**
```javascript
fetch('/api/scrap', {
  method: 'POST',
  body: JSON.stringify({ clinic_id, tgl_awal, tgl_akhir })
})
```

**New (Queue-based):**
```javascript
fetch('/api/scrap/queue', {
  method: 'POST',
  body: JSON.stringify({ clinic_id, tgl_awal, tgl_akhir, requested_by })
})
```

The UI component already uses the new approach automatically.

## Best Practices

1. **Set realistic limits**: Don't process more than 10-20 requests per workflow run
2. **Monitor queue size**: Keep pending queue under 50 items
3. **Handle failures**: Check failed items regularly and requeue if needed
4. **Rate limiting**: Add delays between clinic scrapes to avoid blocking
5. **Credentials**: Store clinic credentials securely in database, never in code

## Future Improvements

- [ ] Web UI for queue management (view pending, retry failed, etc.)
- [ ] Webhook notifications to Slack/Teams with scraping progress
- [ ] Parallel processing for multiple clinics
- [ ] Smart retry logic with exponential backoff
- [ ] Database cleanup for old completed requests
- [ ] Metrics/dashboard for scraping success rates
