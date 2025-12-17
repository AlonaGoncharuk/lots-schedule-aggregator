# Orchestra Schedules Aggregator

A web application that aggregates and displays concert schedules from multiple orchestra websites in a unified, filterable interface.

## Live Application

The application is deployed and publicly accessible at:
**https://lots-schedule-aggregator-353527988398.us-central1.run.app**

## Overview

This application scrapes tour schedules from two orchestra websites:
- **38 SAMURAI** (https://38samurai.com/)
- **Lords of the Sound** (https://lordsofthesound.com/)

The schedules are combined into a single table with the following features:
- Unified view of all concerts from both orchestras
- Filtering by country, show name, and orchestra
- Color-coded rows by country
- Summary statistics showing shows per month per country
- Live data fetching with an Update button
- Export to Excel functionality for downloading filtered data

## Features

- **Combined Schedule Table**: View all concerts in one place with columns for Date, Country, City, Show, and Orchestra
- **Smart Sorting**: Sorted by date, then by country (countries are grouped together even on the same date)
- **Color Coding**: Each country has a distinct background color for easy visual identification
- **Filtering**: Multi-select filters for:
  - Country
  - Show name (case-insensitive matching)
  - Orchestra
- **Summary Statistics**: Table showing:
  - Number of shows per month per country
  - Total shows per country
- **Live Updates**: Click the "Update" button to fetch the latest schedules from source websites
  - **Force Refresh**: The Update button always fetches fresh data, bypassing the cache
  - **Smart Caching**: Initial page load uses cached data (if available) for faster response
  - **Request Queuing**: Multiple simultaneous requests are intelligently queued and share results to prevent server overload
- **Export to Excel**: Download the filtered schedule and summary data as an Excel file (.xlsx) with two worksheets:
  - Schedule worksheet with all filtered concert entries
  - Summary worksheet with monthly breakdown by country
- **Load Time Display**: Shows how long it took to fetch and process the data
- **Loading Indicator**: Visual spinner and status message displayed while data is being fetched
- **Mobile Optimized**: 
  - Fully responsive design that works seamlessly on mobile phones, tablets, and desktop browsers
  - Automatic retry logic for network failures (up to 2 retries with exponential backoff)
  - Enhanced error handling for mobile network issues
  - Touch-friendly controls and optimized layouts

## Technology Stack

- **Backend**: Node.js with Express
- **Web Scraping**: Playwright (for JavaScript-rendered content)
- **HTML Parsing**: Cheerio
- **Frontend**: Vanilla JavaScript, HTML, CSS (responsive design)
- **Excel Export**: SheetJS (XLSX.js) for generating Excel files
- **Containerization**: Docker

## Prerequisites

### For Docker (Recommended)
- Docker Desktop or Docker Engine installed
- No need to install Node.js separately

### For Local Development (Without Docker)
- Node.js (v18 or higher)
- npm (comes with Node.js)

### Installing Prerequisites

#### macOS

**Option 1: Using Homebrew (Recommended)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (includes npm)
brew install node
```

**Option 2: Official Installer**
1. Visit [Node.js official website](https://nodejs.org/)
2. Download the macOS installer (.pkg file)
3. Run the installer and follow the setup wizard
4. Verify installation:
```bash
node --version
npm --version
```

#### Windows

**Option 1: Official Installer (Recommended)**
1. Visit [Node.js official website](https://nodejs.org/)
2. Download the Windows installer (.msi file) - choose the LTS version
3. Run the installer and follow the setup wizard
4. Make sure to check "Add to PATH" during installation
5. Verify installation by opening Command Prompt or PowerShell:
```cmd
node --version
npm --version
```

**Option 2: Using Chocolatey**
If you have Chocolatey package manager installed:
```cmd
choco install nodejs
```

**Option 3: Using Winget**
If you have Windows Package Manager (winget):
```cmd
winget install OpenJS.NodeJS.LTS
```

#### Verify Installation

After installing Node.js, verify that both Node.js and npm are installed correctly:

```bash
node --version   # Should show v18.x.x or higher
npm --version    # Should show 9.x.x or higher
```

If you see version numbers, you're ready to proceed with the installation steps below.

## Installation

1. Clone this repository:
```bash
git clone https://github.com/AlonaGoncharuk/lots-schedule-aggregator.git
cd Lots
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers (required for web scraping):
```bash
npx playwright install chromium
```

## Running the Application

### Option 1: Running with Docker (Recommended)

The application is dockerized and can be run easily with Docker:

1. **Build the Docker image:**
```bash
cd Lots
docker build -t lots-schedule-aggregator .
```

2. **Run the container:**
```bash
docker run -p 3000:8080 lots-schedule-aggregator
```

   Note: The container exposes port 8080 internally, but we map it to port 3000 on your host machine for consistency.

3. **Open your browser and navigate to:**
```
http://localhost:3000
```

### Option 2: Running Locally (Without Docker)

1. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

### Using the Application

3. Click the **"Update"** button to fetch the latest schedules from both orchestra websites.

4. Use the **"Export to Excel"** button to download the filtered data as an Excel file. The export includes both the schedule table and the summary statistics in separate worksheets.

## How It Works

1. **Data Collection**: The server uses Playwright to load the orchestra websites and extract schedule data from HTML tables
2. **Data Normalization**: Dates are parsed from European format (DD.MM.YYYY) and normalized to a consistent format
3. **Column Detection**: The scraper identifies table columns by header names rather than fixed positions, making it robust to layout changes
4. **Data Merging**: Schedules from both orchestras are combined and sorted by date, then by country
5. **Caching System**: 
   - Results are cached for 10 minutes to reduce server load
   - Initial page loads use cached data when available for faster response
   - Update button forces a fresh scrape, bypassing the cache
6. **Request Management**:
   - Queue system handles multiple simultaneous requests intelligently
   - Up to 2 concurrent scrapes allowed to prevent server overload
   - Simultaneous requests share the same scrape result instead of creating duplicates
   - Additional requests wait in queue and are processed as capacity becomes available
7. **Error Handling**:
   - Automatic retry logic for network failures (mobile-friendly)
   - Stale cache fallback if scraping fails
   - Detailed error messages for troubleshooting
8. **Frontend Display**: The browser displays the data in filterable tables with color coding and summary statistics, with a loading indicator during data fetching

## Project Structure

```
Lots/
├── server.js           # Express server and scraping logic
├── package.json        # Dependencies and scripts
├── Dockerfile          # Docker configuration for containerization
├── .dockerignore       # Files to exclude from Docker build
├── deploy.sh           # Deployment script for GCP Cloud Run
├── public/
│   ├── index.html      # Main HTML page
│   ├── app.js          # Frontend JavaScript
│   └── styles.css      # Styling (responsive design)
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/schedule` - Fetches and returns combined schedule data
  - Query Parameters:
    - `refresh=true` (optional) - Forces a fresh scrape, bypassing the cache
  - Returns: `{ shows: [...], summary: {...}, loadTime: "X.X" }`
  - Behavior:
    - Uses cached data if available and less than 10 minutes old (unless `refresh=true`)
    - Queues requests if server is at capacity (max 2 concurrent scrapes)
    - Shares in-progress scrape results with simultaneous requests
    - Returns stale cache as fallback if scraping fails

## Notes

- **Performance**:
  - The scraping process may take 1-2 minutes as it needs to load multiple pages
  - Initial page load uses cached data (if available) for faster response
  - Update button always fetches fresh data
  - Multiple simultaneous requests are handled efficiently through queuing and result sharing
- **Data Format**:
  - Dates are parsed in European format (DD.MM.YYYY)
  - Show names are normalized to handle case differences (e.g., "The Music Of Hans Zimmer" and "The Music of Hans Zimmer" are treated as the same show)
- **Network Requirements**:
  - The application requires network access to fetch data from the source websites
  - Mobile networks are supported with automatic retry logic for unstable connections
- **Concurrency**:
  - Server supports up to 2 concurrent scrapes to prevent overload
  - Additional requests are queued and processed as capacity becomes available
  - Simultaneous requests from multiple users share the same scrape result

## License

This project is for personal use to aggregate orchestra schedules.

