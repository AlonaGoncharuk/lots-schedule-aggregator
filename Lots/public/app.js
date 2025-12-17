const scheduleTableBody = document.querySelector('#scheduleTable tbody');
const summaryTableBody = document.querySelector('#summaryTable tbody');
const countryFilter = document.querySelector('#countryFilter');
const showFilter = document.querySelector('#showFilter');
const orchestraFilter = document.querySelector('#orchestraFilter');
const updateBtn = document.querySelector('#updateBtn');
const exportBtn = document.querySelector('#exportBtn');
const clearFiltersBtn = document.querySelector('#clearFilters');
const statusEl = document.querySelector('#status');
const loadingIndicator = document.querySelector('#loadingIndicator');

let allShows = [];
let countryColors = {};
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const colorPalette = [
  '#38bdf8', '#c084fc', '#fca5a5', '#fcd34d', '#34d399',
  '#60a5fa', '#a78bfa', '#f87171', '#fb923c', '#4ade80'
];

const getCountryColor = (country) => {
  if (!countryColors[country]) {
    const idx = Object.keys(countryColors).length % colorPalette.length;
    countryColors[country] = colorPalette[idx];
  }
  return countryColors[country];
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const showLoading = () => {
  loadingIndicator.style.display = 'flex';
};

const hideLoading = () => {
  loadingIndicator.style.display = 'none';
};

const renderCheckboxes = (containerEl, options, filterType) => {
  containerEl.innerHTML = '';
  options.forEach(opt => {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'filter-checkbox-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${filterType}-${opt.replace(/\s+/g, '-').toLowerCase()}`;
    checkbox.value = opt;
    
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = opt;
    
    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    
    checkbox.addEventListener('change', applyFilters);
    
    containerEl.appendChild(checkboxItem);
  });
};

const applyFilters = () => {
  const selectedCountries = Array.from(countryFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  const selectedShows = Array.from(showFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value.toLowerCase());
  const selectedOrchestras = Array.from(orchestraFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

  const filtered = allShows.filter(item => {
    const matchCountry = selectedCountries.length ? selectedCountries.includes(item.country) : true;
    // Compare show names case-insensitively
    const matchShow = selectedShows.length ? selectedShows.includes(item.show.toLowerCase()) : true;
    const matchOrchestra = selectedOrchestras.length ? selectedOrchestras.includes(item.orchestra) : true;
    return matchCountry && matchShow && matchOrchestra;
  });

  renderSchedule(filtered);
  renderSummary(filtered);
};

const renderSchedule = (shows) => {
  scheduleTableBody.innerHTML = '';
  shows.forEach(show => {
    const tr = document.createElement('tr');
    tr.style.backgroundColor = `${getCountryColor(show.country)}20`;
    tr.innerHTML = `
      <td>${show.dateLabel}</td>
      <td>${show.country}</td>
      <td>${show.city}</td>
      <td>${show.show}</td>
      <td>${show.orchestra}</td>
    `;
    scheduleTableBody.appendChild(tr);
  });
};

const renderSummary = (shows) => {
  summaryTableBody.innerHTML = '';
  const summary = {};

  shows.forEach(show => {
    const d = new Date(show.dateISO);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!summary[show.country]) summary[show.country] = { total: 0, months: {} };
    summary[show.country].total += 1;
    summary[show.country].months[month] = (summary[show.country].months[month] || 0) + 1;
  });

  Object.entries(summary).forEach(([country, data]) => {
    const months = Object.entries(data.months).sort();
    if (months.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${country}</td><td>-</td><td>0</td>`;
      summaryTableBody.appendChild(tr);
      return;
    }
    months.forEach(([month, count], idx) => {
      const tr = document.createElement('tr');
      tr.style.backgroundColor = `${getCountryColor(country)}20`;
      const monthLabelParts = month.split('-');
      const monthLabel = `${monthNames[Number(monthLabelParts[1]) - 1]} ${monthLabelParts[0]}`;
      tr.innerHTML = `
        <td>${idx === 0 ? country : ''}</td>
        <td>${monthLabel}</td>
        <td>${count}</td>
      `;
      summaryTableBody.appendChild(tr);
    });
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = `${getCountryColor(country)}30`;
    totalRow.innerHTML = `
      <td>${country}</td>
      <td>Total</td>
      <td>${data.total}</td>
    `;
    summaryTableBody.appendChild(totalRow);
  });
};

const populateFilters = (shows) => {
  const countries = Array.from(new Set(shows.map(s => s.country))).sort();
  
  // Normalize show names to ignore case differences
  // Group shows by normalized name and use the most common version
  const showMap = new Map();
  shows.forEach(show => {
    const normalized = show.show.toLowerCase().trim();
    if (!showMap.has(normalized)) {
      showMap.set(normalized, show.show);
    } else {
      // If we already have this normalized name, keep the one that appears more often
      // or prefer the one with better capitalization
      const existing = showMap.get(normalized);
      // Count occurrences to prefer the more common version
      const existingCount = shows.filter(s => s.show === existing).length;
      const currentCount = shows.filter(s => s.show === show.show).length;
      if (currentCount > existingCount) {
        showMap.set(normalized, show.show);
      }
    }
  });
  const showsList = Array.from(showMap.values()).sort();
  
  const orchestras = Array.from(new Set(shows.map(s => s.orchestra))).sort();
  renderCheckboxes(countryFilter, countries, 'country');
  renderCheckboxes(showFilter, showsList, 'show');
  renderCheckboxes(orchestraFilter, orchestras, 'orchestra');
};

const fetchData = async (retryCount = 0, forceRefresh = false) => {
  const startTime = Date.now();
  const maxRetries = 2;
  let willRetry = false; // Flag to track if we're about to retry
  setStatus('Updating... This may take 1-2 minutes...');
  updateBtn.disabled = true;
  exportBtn.disabled = true;
  showLoading();
  
  // Add a timeout for the fetch - longer timeout for mobile networks
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
  
  try {
    // Use absolute URL if on mobile to avoid relative path issues
    // Add refresh parameter to force new scrape when Update button is clicked
    const apiUrl = window.location.origin + '/api/schedule' + (forceRefresh ? '?refresh=true' : '');
    
    const res = await fetch(apiUrl, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      let errorDetails = '';
      const httpStatus = res.status;
      
      // Try to parse error response
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.details || errorMessage;
        errorDetails = errorData.details || '';
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          const text = await res.text();
          if (text) {
            errorDetails = text.substring(0, 200); // Limit length
          }
        } catch (e2) {
          // Ignore
        }
        
        // Provide specific messages for common status codes
        if (res.status === 503) {
          errorMessage = 'Service Unavailable - The server is temporarily overloaded or down';
        } else if (res.status === 504) {
          errorMessage = 'Gateway Timeout - The request took too long to process';
        } else if (res.status === 500) {
          errorMessage = 'Internal Server Error - The server encountered an error';
        }
      }
      
      const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
      const error = new Error(fullError);
      error.httpStatus = httpStatus; // Store status for retry logic
      throw error;
    }
    const data = await res.json();
    allShows = data.shows || [];
    countryColors = {};
    populateFilters(allShows);
    applyFilters();
    
    const loadTime = data.loadTime || ((Date.now() - startTime) / 1000).toFixed(1);
    if (allShows.length === 0) {
      setStatus(`No shows found (${loadTime}s). Check server console for details.`);
    } else {
      if (data.fromCache) {
        const cacheAge = data.cacheAge || 0;
        const cacheMinutes = Math.round(cacheAge / 60);
        setStatus(`Loaded ${allShows.length} shows from cache (${cacheMinutes}m old, ${loadTime}s)`);
      } else {
        setStatus(`Loaded ${allShows.length} shows in ${loadTime}s`);
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('Fetch error:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    
    // Check for network-related errors that should be retried
    const isNetworkError = err.name === 'TypeError' || 
                          err.name === 'NetworkError' || 
                          err.message.includes('Failed to fetch') ||
                          err.message.includes('network') ||
                          err.message.includes('Network request failed') ||
                          err.message.includes('Load failed');
    
    // Also retry on 503 (Service Unavailable) and 504 (Gateway Timeout) errors
    const isRetryableHttpError = err.httpStatus === 503 || err.httpStatus === 504;
    
    if ((isNetworkError || isRetryableHttpError) && retryCount < maxRetries) {
      willRetry = true; // Set flag to indicate we're retrying
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
      setStatus(`Network error. Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchData(retryCount + 1, forceRefresh);
    }
    
    if (err.name === 'AbortError') {
      setStatus(`Request timed out after ${loadTime}s. The server may still be processing. Please wait and try again.`);
      alert('The request took too long. This might be because there are many countries to scrape. Please check the server logs and try again in a moment.');
    } else if (isNetworkError) {
      // Detect if on mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const mobileMessage = isMobile 
        ? '\n\nYou\'re on a mobile device. Mobile networks can be unstable. Please:\n1. Check your internet connection\n2. Try again when you have a stronger signal\n3. If on WiFi, try switching to mobile data or vice versa\n4. Make sure you\'re not in a low-signal area'
        : '\n\nPlease check your internet connection and try again.';
      
      setStatus(`Network error: ${err.message} (${loadTime}s)`);
      alert(`Failed to load schedule due to network error: ${err.message}${mobileMessage}`);
    } else {
      setStatus(`Error: ${err.message} (${loadTime}s)`);
      alert(`Failed to load schedule: ${err.message}\n\nCheck the browser console and server logs for more details.`);
    }
  } finally {
    updateBtn.disabled = false;
    exportBtn.disabled = false;
    // Only hide loading if we're not retrying
    if (!willRetry) {
      hideLoading();
    }
  }
};

const exportToExcel = () => {
  if (allShows.length === 0) {
    alert('No data to export. Please update the schedule first.');
    return;
  }

  // Get filtered data (same as what's displayed)
  const selectedCountries = Array.from(countryFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  const selectedShows = Array.from(showFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value.toLowerCase());
  const selectedOrchestras = Array.from(orchestraFilter.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

  const filtered = allShows.filter(item => {
    const matchCountry = selectedCountries.length ? selectedCountries.includes(item.country) : true;
    const matchShow = selectedShows.length ? selectedShows.includes(item.show.toLowerCase()) : true;
    const matchOrchestra = selectedOrchestras.length ? selectedOrchestras.includes(item.orchestra) : true;
    return matchCountry && matchShow && matchOrchestra;
  });

  // Prepare Schedule data
  const scheduleData = filtered.map(show => ({
    'Date': show.dateLabel,
    'Country': show.country,
    'City': show.city,
    'Show': show.show,
    'Orchestra': show.orchestra
  }));

  // Prepare Summary data
  const summary = {};
  filtered.forEach(show => {
    const d = new Date(show.dateISO);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!summary[show.country]) summary[show.country] = { total: 0, months: {} };
    summary[show.country].total += 1;
    summary[show.country].months[month] = (summary[show.country].months[month] || 0) + 1;
  });

  const summaryData = [];
  Object.entries(summary).forEach(([country, data]) => {
    const months = Object.entries(data.months).sort();
    if (months.length === 0) {
      summaryData.push({
        'Country': country,
        'Month': '-',
        'Shows': 0
      });
    } else {
      months.forEach(([month, count]) => {
        const monthLabelParts = month.split('-');
        const monthLabel = `${monthNames[Number(monthLabelParts[1]) - 1]} ${monthLabelParts[0]}`;
        summaryData.push({
          'Country': country,
          'Month': monthLabel,
          'Shows': count
        });
      });
      summaryData.push({
        'Country': country,
        'Month': 'Total',
        'Shows': data.total
      });
    }
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create Schedule worksheet
  const scheduleWs = XLSX.utils.json_to_sheet(scheduleData);
  XLSX.utils.book_append_sheet(wb, scheduleWs, 'Schedule');

  // Create Summary worksheet
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `orchestra-schedules-${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
  setStatus(`Exported ${scheduleData.length} schedule entries and ${summaryData.length} summary rows to ${filename}`);
};

updateBtn.addEventListener('click', () => fetchData(0, true)); // Force refresh when Update button is clicked
exportBtn.addEventListener('click', exportToExcel);
clearFiltersBtn.addEventListener('click', () => {
  countryFilter.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  showFilter.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  orchestraFilter.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  applyFilters();
});

fetchData(); // Initial load uses cache if available

