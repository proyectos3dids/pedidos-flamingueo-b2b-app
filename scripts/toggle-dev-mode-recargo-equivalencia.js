#!/usr/bin/env node

/**
 * Script para cambiar entre modo desarrollo y producción para la extensión a-adir-recargo-equivalencia
 * Uso: 
 *   - Modo desarrollo: node toggle-dev-mode-recargo-equivalencia.js dev http://localhost:3000
 *   - Modo producción: node toggle-dev-mode-recargo-equivalencia.js prod
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Rutas de archivos
const CONFIG_PATH = path.resolve(__dirname, '../crear-pedido-final/extensions/a-adir-recargo-equivalencia/src/config.js');
const ENV_PATH = path.resolve(__dirname, '../.env');

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);
const mode = args[0]?.toLowerCase();

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
const devUrl = args[1] || envDevUrl || 'http://localhost:3000';
console.log(`🔗 Usando URL de desarrollo: ${devUrl}`);

// Validar argumentos
if (!mode || (mode !== 'dev' && mode !== 'prod')) {
  console.error('❌ Error: Debes especificar el modo (dev o prod)');
  console.log('Uso:');
  console.log('  - Modo desarrollo: node toggle-dev-mode-recargo-equivalencia.js dev http://localhost:3000');
  console.log('  - Modo producción: node toggle-dev-mode-recargo-equivalencia.js prod');
  process.exit(1);
}

// Función para actualizar el archivo de configuración
function updateConfigFile(isDev, apiUrl) {
  try {
    // Leer el archivo de configuración
    let configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    
    // Actualizar la bandera IS_DEVELOPMENT
    configContent = configContent.replace(
      /const IS_DEVELOPMENT = (true|false);/,
      `const IS_DEVELOPMENT = ${isDev};`
    );
    
    // Si estamos en modo desarrollo, actualizar la URL de desarrollo
    if (isDev) {
      // Usar una expresión regular más precisa para capturar la línea completa
      const devApiUrlRegex = /const DEV_API_URL = ['|"]([^'"]*)['"];/;
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
    fs.writeFileSync(CONFIG_PATH, configContent);
    console.log(`✅ Archivo de configuración actualizado: ${CONFIG_PATH}`);
    console.log(`   - Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`   - API URL: ${isDev ? apiUrl : 'https://pedido-flamingueo-b2b.onrender.com'}`);
  } catch (error) {
    console.error(`❌ Error al actualizar el archivo de configuración: ${error.message}`);
    process.exit(1);
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
    process.exit(1);
  }
}

// Ejecutar según el modo seleccionado
if (mode === 'dev') {
  console.log('🔧 Cambiando a modo DESARROLLO...');
  updateConfigFile(true, devUrl);
  updateEnvFile(true, devUrl);
  console.log('✅ Modo DESARROLLO activado correctamente.');
} else if (mode === 'prod') {
  console.log('🔧 Cambiando a modo PRODUCCIÓN...');
  updateConfigFile(false);
  updateEnvFile(false);
  console.log('✅ Modo PRODUCCIÓN activado correctamente.');
}

console.log('\n🔄 Recuerda reiniciar la aplicación para aplicar los cambios.');