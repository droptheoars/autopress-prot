# AutoPress-Prot - Euronext to Webflow Press Release Automation

Automatically scrapes press releases from Euronext and publishes them to your Webflow CMS. Runs completely free using GitHub Actions.

## 🚀 Features

- **Automated Scraping**: Monitors Euronext press releases every 3 minutes during business hours
- **Configurable Schedule**: Easily adjust hours (default 7 AM - 6 PM) and intervals
- **Duplicate Prevention**: Tracks processed releases to avoid duplicates
- **Clean Content**: Preserves original formatting when transferring to Webflow
- **Zero Cost**: Runs entirely on GitHub Actions free tier
- **Robust Error Handling**: Retry logic and comprehensive logging

## 📋 Prerequisites

1. **GitHub Account** (free)
2. **Webflow Account** with:
   - Site access
   - CMS collection for press releases
   - API token

## 🛠 Setup Instructions

### 1. Webflow CMS Setup

Create a collection in Webflow with these fields:
- **Title** (Plain text) - for press release title
- **Content** (Rich text) - for main press release content  
- **Publish Date** (Date/Time) - for release date
- **Source URL** (Plain text) - for original Euronext URL
- **Press Release ID** (Plain text) - for duplicate prevention

### 2. Get Webflow API Credentials

1. Go to your Webflow project settings
2. Navigate to **Integrations** → **API Access**
3. Generate an API token
4. Note your Site ID and Collection ID

### 3. GitHub Repository Setup

1. **Create a new GitHub repository**
2. **Clone this project** to your repository
3. **Add GitHub Secrets** (Settings → Secrets and variables → Actions):
   - `WEBFLOW_API_TOKEN`: Your Webflow API token
   - `WEBFLOW_SITE_ID`: Your Webflow site ID
   - `WEBFLOW_COLLECTION_ID`: Your collection ID

### 4. Configuration

Edit `config/schedule.json` to customize:

```json
{
  "schedule": {
    "startHour": 7,        // Start monitoring at 7 AM
    "endHour": 18,         // Stop monitoring at 6 PM
    "intervalMinutes": 3,  // Check every 3 minutes
    "timezone": "Europe/Amsterdam"
  }
}
```

### 5. Deploy

1. Push your code to GitHub
2. The automation will start running automatically
3. Check the **Actions** tab for execution logs

## 🔧 Usage

### Automatic Operation
- Runs every 3 minutes during configured hours (Monday-Friday)
- Automatically stops outside business hours
- Publishes new press releases to Webflow immediately

### Manual Testing
Trigger manually from GitHub Actions:
1. Go to **Actions** tab
2. Select **Euronext Press Release Scraper**
3. Click **Run workflow**
4. Enable **test mode** for limited results

### Local Development
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Add your Webflow credentials to .env
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
Modify `src/scraper.js` to adjust content selectors if Euronext changes their website structure.

### Webflow Fields
Update `src/webflow.js` to match your CMS collection field names.

## 🔍 Troubleshooting

### Common Issues

**Authentication Errors**
- Verify Webflow API token is correct
- Check Site ID and Collection ID
- Ensure GitHub secrets are properly set

**No Content Found**
- Euronext may have changed their website structure
- Check scraper selectors in `src/scraper.js`

**Rate Limiting**
- Default delays are conservative
- Increase delays in configuration if needed

**Schedule Not Working**
- GitHub Actions uses UTC time
- Verify timezone settings in configuration

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
│   ├── scraper.js            # Euronext website scraping logic
│   ├── webflow.js            # Webflow CMS integration
│   └── utils.js              # Helper functions and utilities
├── data/
│   └── processed.json        # Tracks processed releases
├── .github/workflows/
│   └── scraper.yml           # GitHub Actions workflow
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🆘 Support

1. Check GitHub Actions logs for detailed error information
2. Review the troubleshooting section above
3. Test locally using development mode
4. Verify Webflow API credentials and collection setup

## 📝 License

MIT License - Feel free to modify and distribute.