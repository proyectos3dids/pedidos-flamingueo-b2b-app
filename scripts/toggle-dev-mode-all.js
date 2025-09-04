#!/usr/bin/env node

/**
 * Script para cambiar entre modo desarrollo y producción para todas las extensiones
 * Uso: 
 *   - Modo desarrollo: node scripts/toggle-dev-mode-all.js dev https://your-ngrok-url.ngrok-free.app
 *   - Modo producción: node scripts/toggle-dev-mode-all.js prod
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Rutas de archivos
const ENV_PATH = path.resolve(__dirname, '../.env');
const CONFIG_PATHS = {
  recargoEquivalencia: path.resolve(__dirname, '../crear-pedido-final/extensions/a-adir-recargo-equivalencia/src/config.js'),
  crearPedido: path.resolve(__dirname, '../crear-pedido-final/extensions/crear-pedido-final/src/config.js'),
  posRecargo: path.resolve(__dirname, '../crear-pedido-final/extensions/pos-recargo-equivalencia/src/config.js')
};

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);
const mode = args[0]?.toLowerCase();
let inputNgrokUrl = args[1];

// Intentar leer la URL de desarrollo del archivo .env si existe
let envDevUrl = '';
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  const match = envContent.match(/DEV_API_URL=([^\n\r]+)/);
  if (match && match[1]) {
    envDevUrl = match[1].trim();
    console.log(`📝 URL de desarrollo encontrada en .env: ${envDevUrl}`);
  } else {
    console.log('⚠️ No se encontró DEV_API_URL en el archivo .env');
  }
}

// Usar la URL proporcionada como argumento, o la del .env, o el valor por defecto
const devUrl = inputNgrokUrl || envDevUrl || 'http://localhost:3000';
console.log(`🔗 Usando URL de desarrollo: ${devUrl}`);

// Validar argumentos
if (!mode || (mode !== 'dev' && mode !== 'prod')) {
  console.error('❌ Error: Debes especificar el modo (dev o prod)');
  console.log('Uso:');
  console.log('  - Modo desarrollo: node scripts/toggle-dev-mode-all.js dev https://your-ngrok-url.ngrok-free.app');
  console.log('  - Modo producción: node scripts/toggle-dev-mode-all.js prod');
  process.exit(1);
}

if (mode === 'dev' && !devUrl) {
  console.log('❌ La URL de ngrok es necesaria para el modo desarrollo');
  console.log('   No se encontró URL en .env ni se proporcionó como argumento');
  console.log('   Ejemplo: node scripts/toggle-dev-mode-all.js dev https://your-ngrok-url.ngrok-free.app');
  process.exit(1);
}

// Función para actualizar el archivo de configuración de a-adir-recargo-equivalencia
function updateRecargoEquivalenciaConfig(isDev, apiUrl) {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(CONFIG_PATHS.recargoEquivalencia)) {
      console.log(`⚠️ Archivo de configuración no encontrado: ${CONFIG_PATHS.recargoEquivalencia}`);
      return;
    }
    
    // Leer el archivo de configuración
    let configContent = fs.readFileSync(CONFIG_PATHS.recargoEquivalencia, 'utf8');
    
    // Actualizar la bandera IS_DEVELOPMENT
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      `const IS_DEVELOPMENT = ${isDev};`
    );
    
    // Si estamos en modo desarrollo, actualizar la URL de desarrollo
    if (isDev) {
      // Usar una expresión regular más precisa para capturar la línea completa
      const devApiUrlRegex = /const DEV_API_URL = ['|"]([^'"]*)['|"];/;
      if (devApiUrlRegex.test(configContent)) {
        configContent = configContent.replace(
          devApiUrlRegex,
          `const DEV_API_URL = '${apiUrl}';`
        );
      } else {
        console.warn('⚠️ No se pudo encontrar la línea DEV_API_URL en el archivo de configuración');
      }
    }
    
    // Guardar los cambios
    fs.writeFileSync(CONFIG_PATHS.recargoEquivalencia, configContent);
    console.log(`✅ Archivo de configuración actualizado: ${CONFIG_PATHS.recargoEquivalencia}`);
    console.log(`   - Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`   - API URL: ${isDev ? apiUrl : 'https://pedido-flamingueo-b2b.onrender.com'}`);
  } catch (error) {
    console.error(`❌ Error al actualizar el archivo de configuración: ${error.message}`);
  }
}

// Función para actualizar el archivo de configuración de crear-pedido-final
function updateCrearPedidoConfig(isDev, apiUrl) {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(CONFIG_PATHS.crearPedido)) {
      console.log(`⚠️ Archivo de configuración no encontrado: ${CONFIG_PATHS.crearPedido}`);
      return;
    }
    
    // Leer el archivo de configuración
    let configContent = fs.readFileSync(CONFIG_PATHS.crearPedido, 'utf8');
    
    // Cambiar a modo desarrollo/producción
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      `const IS_DEVELOPMENT = ${isDev};`
    );
    
    // Actualizar URL de ngrok si estamos en modo desarrollo
    if (isDev && apiUrl) {
      configContent = configContent.replace(
        /development: '[^']*'/,
        `development: '${apiUrl}'`
      );
    }
    
    // Guardar los cambios
    fs.writeFileSync(CONFIG_PATHS.crearPedido, configContent);
    console.log(`✅ Archivo de configuración actualizado: ${CONFIG_PATHS.crearPedido}`);
    console.log(`   - Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`   - API URL: ${isDev ? apiUrl : 'https://pedido-flamingueo-b2b.onrender.com'}`);
  } catch (error) {
    console.error(`❌ Error al actualizar la configuración de crear-pedido-final: ${error.message}`);
  }
}

// Función para actualizar el archivo de configuración de pos-recargo-equivalencia
function updatePosRecargoConfig(isDev, apiUrl) {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(CONFIG_PATHS.posRecargo)) {
      console.log(`⚠️ Archivo de configuración no encontrado: ${CONFIG_PATHS.posRecargo}`);
      return;
    }
    
    // Leer el archivo de configuración
    let configContent = fs.readFileSync(CONFIG_PATHS.posRecargo, 'utf8');
    
    // Cambiar a modo desarrollo/producción
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      `const IS_DEVELOPMENT = ${isDev};`
    );
    
    // Actualizar URL de ngrok si estamos en modo desarrollo
    if (isDev && apiUrl) {
      configContent = configContent.replace(
        /development: '[^']*'/,
        `development: '${apiUrl}'`
      );
    }
    
    // Guardar los cambios
    fs.writeFileSync(CONFIG_PATHS.posRecargo, configContent);
    console.log(`✅ Archivo de configuración actualizado: ${CONFIG_PATHS.posRecargo}`);
    console.log(`   - Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`   - API URL: ${isDev ? apiUrl : 'https://pedido-flamingueo-b2b.onrender.com'}`);
  } catch (error) {
    console.error(`❌ Error al actualizar la configuración de pos-recargo-equivalencia: ${error.message}`);
  }
}

// Función para actualizar el archivo .env
function updateEnvFile(isDev, apiUrl) {
  try {
    // Verificar si el archivo .env existe
    if (!fs.existsSync(ENV_PATH)) {
      console.log('⚠️ Archivo .env no encontrado. Creando uno nuevo...');
      fs.writeFileSync(ENV_PATH, '');
    }
    
    // Leer el archivo .env
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');
    
    // Actualizar o agregar la variable DEV_MODE
    if (envContent.includes('DEV_MODE=')) {
      envContent = envContent.replace(
        /DEV_MODE=(true|false)/,
        `DEV_MODE=${isDev}`
      );
    } else {
      envContent += `\nDEV_MODE=${isDev}`;
    }
    
    // Actualizar o agregar la variable DEV_API_URL si estamos en modo desarrollo
    if (isDev) {
      if (envContent.includes('DEV_API_URL=')) {
        // Usar una expresión regular más precisa para capturar toda la línea
        envContent = envContent.replace(
          /DEV_API_URL=([^\n]*)/,
          `DEV_API_URL=${apiUrl}`
        );
      } else {
        envContent += `\nDEV_API_URL=${apiUrl}`;
      }
    }
    
    // Guardar los cambios
    fs.writeFileSync(ENV_PATH, envContent);
    console.log(`✅ Archivo .env actualizado: ${ENV_PATH}`);
  } catch (error) {
    console.error(`❌ Error al actualizar el archivo .env: ${error.message}`);
  }
}

// Ejecutar según el modo seleccionado
console.log(`\n🔄 Cambiando todas las extensiones a modo ${mode === 'dev' ? 'DESARROLLO' : 'PRODUCCIÓN'}...\n`);

// Actualizar configuraciones
if (mode === 'dev') {
  updateRecargoEquivalenciaConfig(true, devUrl);
  updateCrearPedidoConfig(true, devUrl);
  updatePosRecargoConfig(true, devUrl);
  updateEnvFile(true, devUrl);
  console.log('\n✅ Modo DESARROLLO activado correctamente en todas las extensiones.');
} else if (mode === 'prod') {
  updateRecargoEquivalenciaConfig(false);
  updateCrearPedidoConfig(false);
  updatePosRecargoConfig(false);
  updateEnvFile(false);
  console.log('\n✅ Modo PRODUCCIÓN activado correctamente en todas las extensiones.');
}

console.log('\n🎉 ¡Configuración actualizada con éxito!');
console.log('💡 Recuerda reiniciar tu servidor de desarrollo para que los cambios surtan efecto.');