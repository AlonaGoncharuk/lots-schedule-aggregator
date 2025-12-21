// Cleanup after all tests
afterAll(async () => {
  // Clear any intervals from logger
  try {
    const logger = require('./utils/logger');
    if (logger.clearInterval) {
      logger.clearInterval();
    }
  } catch (err) {
    // Ignore if logger not available
  }
  
  // Close any open server connections
  try {
    const { server } = require('./server');
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
  } catch (err) {
    // Ignore if server not available
  }
  
  // Give Jest time to clean up
  await new Promise(resolve => setTimeout(resolve, 100));
});

