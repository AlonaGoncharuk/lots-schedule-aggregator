# Orchestra Schedules Aggregator

A web application that aggregates and displays concert schedules from multiple orchestra websites in a unified, filterable interface.

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
- **Load Time Display**: Shows how long it took to fetch and process the data

## Technology Stack

- **Backend**: Node.js with Express
- **Web Scraping**: Playwright (for JavaScript-rendered content)
- **HTML Parsing**: Cheerio
- **Frontend**: Vanilla JavaScript, HTML, CSS

## Prerequisites

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

## Quick Start (Without Git)

If you're not familiar with Git, follow these simple steps:

1. **Download & Unzip**  
   Download the project ZIP and extract it to your computer.

2. **Open the "Lots" Folder**  
   Open the folder you just extracted. Inside it, you will see a folder named `Lots`. Open that folder.

3. **Open Terminal Here**  
   You need to open a terminal (command prompt) window in the Lots folder. Here's how:
   
   - **Windows**: 
     - Open the Lots folder in File Explorer
     - Click on the address bar at the top (where you see the folder path)
     - Type `cmd` and press Enter
     - A black command prompt window will open, and you'll be in the Lots folder
   
   - **Mac**: 
     - Open Finder and navigate to the Lots folder
     - Right-click (or Control-click) on the Lots folder
     - Select "New Terminal at Folder" from the context menu
     - A terminal window will open, and you'll be in the Lots folder

4. **Install Dependencies**  
   In the terminal window that just opened, copy the command below, paste it into the terminal, and press Enter:
   ```bash
   npm install
   ```
   Wait for the installation to complete. This may take a few minutes.

5. **Install Browsers**  
   Copy the command below, paste it into the terminal, and press Enter:
   ```bash
   npx playwright install
   ```
   Wait for the installation to complete. This will download browser files needed for the application.

6. **Run the Server**  
   Copy the command below, paste it into the terminal, and press Enter:
   ```bash
   npm start
   ```
   You should see a message indicating the server is running. Keep this terminal window open while using the application.

7. **Open the Site**  
   Go to your browser and visit: [http://localhost:3000](http://localhost:3000)

## Installation (Using Git)

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

3. Click the **"Update"** button to fetch the latest schedules from both orchestra websites.

## How It Works

1. **Data Collection**: The server uses Playwright to load the orchestra websites and extract schedule data from HTML tables
2. **Data Normalization**: Dates are parsed from European format (DD.MM.YYYY) and normalized to a consistent format
3. **Column Detection**: The scraper identifies table columns by header names rather than fixed positions, making it robust to layout changes
4. **Data Merging**: Schedules from both orchestras are combined and sorted by date, then by country
5. **Frontend Display**: The browser displays the data in filterable tables with color coding and summary statistics

## Project Structure

```
Lots/
├── server.js           # Express server and scraping logic
├── package.json        # Dependencies and scripts
├── public/
│   ├── index.html      # Main HTML page
│   ├── app.js          # Frontend JavaScript
│   └── styles.css      # Styling
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/schedule` - Fetches and returns combined schedule data
  - Returns: `{ shows: [...], summary: {...}, loadTime: "X.X" }`

## Notes

- The scraping process may take 1-2 minutes as it needs to load multiple pages
- Dates are parsed in European format (DD.MM.YYYY)
- Show names are normalized to handle case differences (e.g., "The Music Of Hans Zimmer" and "The Music of Hans Zimmer" are treated as the same show)
- The application requires network access to fetch data from the source websites

## License

This project is for personal use to aggregate orchestra schedules.

