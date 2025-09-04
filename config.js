require('dotenv').config();

/**
 * Configuration for API URLs based on development mode
 */
const config = {
  // Check if we're in development mode
  isDevelopment: process.env.DEV_MODE === 'true',
  
  // API Base URL - switches between local ngrok and Render based on DEV_MODE
  getApiUrl: () => {
    if (process.env.DEV_MODE === 'true') {
      return process.env.DEV_API_URL || 'http://localhost:3000';
    }
    return process.env.PROD_API_URL || 'https://pedido-flamingueo-b2b.onrender.com';
  },
  
  // Shopify configuration
  shopify: {
    storeUrl: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  },
  
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Log current configuration on startup
console.log('🔧 Configuration loaded:');
console.log(`   Mode: ${config.isDevelopment ? 'Development' : 'Production'}`);
console.log(`   API URL: ${config.getApiUrl()}`);
console.log(`   Port: ${config.port}`);

module.exports = config;