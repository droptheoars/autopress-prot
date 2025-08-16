# AutoPress-Prot - ENext to WF Press Release Automation

Automatically scrapes press releases from ENext press release distributor and publishes them to your WF CMS. Runs completely free using GitHub Actions.

## 🚀 Features

- **Automated Scraping**: Monitors ENext press releases every 2 minutes during extended hours (6 AM - 11:59 PM)
- **Configurable Schedule**: Runs 7 days a week with Norwegian timezone support
- **Smart Duplicate Prevention**: Handles same titles on different dates intelligently
- **Super Clean Content**: Advanced text processing with modal-based extraction
- **Professional Formatting**: Removes metadata and creates clean press release content
- **Zero Cost**: Runs entirely on GitHub Actions free tier
- **Robust Error Handling**: Retry logic and comprehensive logging

## 📋 Prerequisites

1. **GitHub Account** (free)
2. **WF Account** with:
   - Site access
   - CMS collection for press releases
   - API token

## 🛠 Setup Instructions

### 1. WF CMS Setup

Create a collection in WF with these fields:
- **name** (Plain text) - for press release title
- **pm-body-html** (Rich text) - for main press release content  
- **date-2** (Date/Time) - for release date
- **read-more-link** (Plain text) - for static ENext URL
- **slug** (Plain text) - auto-generated unique identifier

### 2. Get WF API Credentials

1. Go to your WF project settings
2. Navigate to **Integrations** → **API Access**
3. Generate an API token
4. Note your Site ID and Collection ID

### 3. GitHub Repository Setup

1. **Create a new GitHub repository**
2. **Clone this project** to your repository
3. **Add GitHub Secrets** (Settings → Secrets and variables → Actions):
   - `WEBFLOW_API_TOKEN`: Your WF API token
   - `WEBFLOW_SITE_ID`: Your WF site ID
   - `WEBFLOW_COLLECTION_ID`: Your collection ID

### 4. Configuration

Edit `config/schedule.json` to customize:

```json
{
  "schedule": {
    "startHour": 6,        // Start monitoring at 6 AM
    "endHour": 23,         // Stop monitoring at 11:59 PM
    "intervalMinutes": 2,  // Check every 2 minutes
    "timezone": "Europe/Oslo",
    "daysOfWeek": "Monday-Sunday"
  },
  "euronext": {
    "onlyAfterDate": "2025-06-27"
  }
}
```

### 5. Deploy

1. Push your code to GitHub
2. The automation will start running automatically
3. Check the **Actions** tab for execution logs

## 🔧 Usage

### Automatic Operation
- Runs every 2 minutes during extended hours (6 AM - 11:59 PM Norwegian time)
- Operates 7 days a week for maximum coverage
- Creates draft items in WF for review before publishing
- Only processes releases after June 27, 2025

### Manual Testing
Trigger manually from GitHub Actions:
1. Go to **Actions** tab
2. Select **ENext Press Release Scraper**
3. Click **Run workflow**
4. Enable **test mode** for limited results

### Local Development
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Add your WF credentials to .env
# Run in test mode
npm run dev -- --test
```

## 📊 Monitoring

- **Logs**: View in GitHub Actions runs
- **Status**: Check `data/processed.json` for statistics
- **Errors**: Automatic failure notifications
- **Health Check**: Run `npm start -- --health`

## ⚙️ Customization

### Change Schedule
Edit `config/schedule.json`:
- **Hours**: Modify `startHour` and `endHour`
- **Frequency**: Change `intervalMinutes`
- **Timezone**: Update `timezone`

### Content Extraction
Modify `src/scraper.js` to adjust content selectors if ENext changes their website structure.

### WF Fields
Update `src/webflow.js` to match your CMS collection field names.

## 🔍 Troubleshooting

### Common Issues

**Authentication Errors**
- Verify WF API token is correct
- Check Site ID and Collection ID
- Ensure GitHub secrets are properly set

**No Content Found**
- ENext may have changed their website structure
- Check scraper selectors in `src/scraper.js`

**Rate Limiting**
- Default delays are conservative
- Increase delays in configuration if needed

**Schedule Not Working**
- GitHub Actions scheduled workflows can take 1-24 hours to activate after setup
- This is normal GitHub behavior for new or modified schedules
- Manual runs will work immediately while waiting for automatic activation

### Debug Mode
```bash
# Run with detailed logging
node src/index.js --test
```

## 📄 File Structure

```
euronext-webflow-automation/
├── config/
│   └── schedule.json          # Configurable schedule settings
├── src/
│   ├── index.js              # Main application entry point
│   ├── scraper.js            # ENext website scraping logic
│   ├── webflow.js            # WF CMS integration
│   └── utils.js              # Helper functions and utilities
├── data/
│   └── processed.json        # Tracks processed releases
├── .github/workflows/
│   └── scraper.yml           # GitHub Actions workflow
├── verify-schedule.js        # Schedule verification tool
├── master-test.js            # Complete system test
└── README.md                 # This file
```

## 🆘 Support

1. Check GitHub Actions logs for detailed error information
2. Review the troubleshooting section above
3. Test locally using development mode
4. Verify WF API credentials and collection setup

## 📝 License

MIT License - Feel free to modify and distribute.