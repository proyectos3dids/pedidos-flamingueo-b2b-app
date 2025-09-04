#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script para alternar entre modos desarrollo y producción para la extensión crear-pedido-final
 * Uso: node scripts/toggle-dev-mode-crear-pedido.js [dev|prod] [ngrok-url]
 */

const args = process.argv.slice(2);
const mode = args[0];
let inputNgrokUrl = args[1];

// Rutas
const extensionConfigPath = path.join(__dirname, '../crear-pedido-final/extensions/crear-pedido-final/src/config.js');
const envPath = path.join(__dirname, '../.env');

// Intentar leer la URL de desarrollo del archivo .env si existe
let envDevUrl = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DEV_API_URL=([^\n]+)/);
  if (match && match[1]) {
    envDevUrl = match[1];
    console.log(`📝 URL de desarrollo encontrada en .env: ${envDevUrl}`);
  }
}

// Usar la URL proporcionada como argumento o la del .env
const ngrokUrl = inputNgrokUrl || envDevUrl;

if (!mode || !['dev', 'prod'].includes(mode)) {
  console.log('❌ Uso: node scripts/toggle-dev-mode-crear-pedido.js [dev|prod] [ngrok-url]');
  console.log('   Ejemplo: node scripts/toggle-dev-mode-crear-pedido.js dev https://abc123.ngrok.io');
  console.log('   Ejemplo: node scripts/toggle-dev-mode-crear-pedido.js prod');
  process.exit(1);
}

if (mode === 'dev' && !ngrokUrl) {
  console.log('❌ La URL de ngrok es necesaria para el modo desarrollo');
  console.log('   No se encontró URL en .env ni se proporcionó como argumento');
  console.log('   Ejemplo: node scripts/toggle-dev-mode-crear-pedido.js dev https://abc123.ngrok.io');
  process.exit(1);
}

// Actualizar configuración de la extensión
try {
  let configContent = fs.readFileSync(extensionConfigPath, 'utf8');
  
  if (mode === 'dev') {
    // Cambiar a modo desarrollo
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      'const IS_DEVELOPMENT = true;'
    );
    
    // Actualizar URL de ngrok si se proporciona
    if (ngrokUrl) {
      configContent = configContent.replace(
        /development: '[^']*'/,
        `development: '${ngrokUrl}'`
      );
    }
    
    console.log('🔧 Cambiado a modo DESARROLLO');
    console.log(`   Usando URL de ngrok: ${ngrokUrl}`);
  } else {
    // Cambiar a modo producción
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      'const IS_DEVELOPMENT = false;'
    );
    
    console.log('🚀 Cambiado a modo PRODUCCIÓN');
    console.log('   Usando URL de Render: https://pedido-flamingueo-b2b.onrender.com');
  }
  
  fs.writeFileSync(extensionConfigPath, configContent);
  console.log('✅ Configuración de la extensión actualizada');
  
} catch (error) {
  console.error('❌ Error al actualizar la configuración de la extensión:', error.message);
  process.exit(1);
}

// Actualizar archivo .env si existe
try {
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Actualizar DEV_MODE
    if (envContent.includes('DEV_MODE=')) {
      envContent = envContent.replace(
        /DEV_MODE=(true|false)/,
        `DEV_MODE=${mode === 'dev'}`
      );
    } else {
      envContent += `\nDEV_MODE=${mode === 'dev'}\n`;
    }
    
    // Actualizar DEV_API_URL si estamos en modo dev y se proporciona URL de ngrok
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
    console.log('✅ Archivo .env actualizado');
  } else {
    console.log('⚠️  Archivo .env no encontrado, omitiendo actualización de .env');
  }
} catch (error) {
  console.error('❌ Error al actualizar el archivo .env:', error.message);
}

console.log('\n🎉 ¡Configuración actualizada con éxito!');
console.log('💡 Recuerda reiniciar tu servidor de desarrollo para que los cambios surtan efecto.');