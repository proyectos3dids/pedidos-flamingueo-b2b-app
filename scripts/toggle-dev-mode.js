#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to toggle between development and production modes
 * Usage: node scripts/toggle-dev-mode.js [dev|prod] [ngrok-url]
 */

const args = process.argv.slice(2);
const mode = args[0];
const ngrokUrl = args[1];

if (!mode || !['dev', 'prod'].includes(mode)) {
  console.log('❌ Usage: node scripts/toggle-dev-mode.js [dev|prod] [ngrok-url]');
  console.log('   Example: node scripts/toggle-dev-mode.js dev https://abc123.ngrok.io');
  console.log('   Example: node scripts/toggle-dev-mode.js prod');
  process.exit(1);
}

if (mode === 'dev' && !ngrokUrl) {
  console.log('❌ ngrok URL is required for development mode');
  console.log('   Example: node scripts/toggle-dev-mode.js dev https://abc123.ngrok.io');
  process.exit(1);
}

// Paths
const extensionConfigPath = path.join(__dirname, '../crear-pedido-final/extensions/pos-recargo-equivalencia/src/config.js');
const envPath = path.join(__dirname, '../.env');

// Update extension config
try {
  let configContent = fs.readFileSync(extensionConfigPath, 'utf8');
  
  if (mode === 'dev') {
    // Set to development mode
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      'const IS_DEVELOPMENT = true;'
    );
    
    // Update ngrok URL if provided
    if (ngrokUrl) {
      configContent = configContent.replace(
        /development: '[^']*'/,
        `development: '${ngrokUrl}'`
      );
    }
    
    console.log('🔧 Switched to DEVELOPMENT mode');
    console.log(`   Using ngrok URL: ${ngrokUrl}`);
  } else {
    // Set to production mode
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      'const IS_DEVELOPMENT = false;'
    );
    
    console.log('🚀 Switched to PRODUCTION mode');
    console.log('   Using Render URL: https://pedido-flamingueo-b2b.onrender.com');
  }
  
  fs.writeFileSync(extensionConfigPath, configContent);
  console.log('✅ Extension configuration updated');
  
} catch (error) {
  console.error('❌ Error updating extension config:', error.message);
  process.exit(1);
}

// Update .env file if it exists
try {
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update DEV_MODE
    if (envContent.includes('DEV_MODE=')) {
      envContent = envContent.replace(
        /DEV_MODE=(true|false)/,
        `DEV_MODE=${mode === 'dev'}`
      );
    } else {
      envContent += `\nDEV_MODE=${mode === 'dev'}\n`;
    }
    
    // Update DEV_API_URL if in dev mode and ngrok URL provided
    if (mode === 'dev' && ngrokUrl) {
      if (envContent.includes('DEV_API_URL=')) {
        envContent = envContent.replace(
          /DEV_API_URL=.*/,
          `DEV_API_URL=${ngrokUrl}`
        );
      } else {
        envContent += `DEV_API_URL=${ngrokUrl}\n`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated');
  } else {
    console.log('⚠️  .env file not found, skipping .env update');
  }
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
}

console.log('\n🎉 Configuration updated successfully!');
console.log('💡 Remember to restart your development server for changes to take effect.');