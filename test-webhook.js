const axios = require('axios');
const crypto = require('crypto');

// Configuración del test
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook/order-paid';
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'test-secret';

// Función para generar signature de Shopify
function generateShopifySignature(body, secret) {
  if (!secret) return null;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  return hmac.digest('base64');
}

// Mock data - Cliente CON tag "RE"
const mockOrderWithRETag = {
  id: 12345678901,
  name: "#TEST-001",
  currency: "EUR",
  customer: {
    id: 987654321,
    email: "cliente-re@test.com",
    first_name: "Cliente",
    last_name: "Con RE",
    tags: "cliente-vip, RE, descuento-especial"
  },
  line_items: [
    {
      id: 111111111,
      title: "Producto Test 1",
      quantity: 2,
      price: "25.00"
    },
    {
      id: 222222222,
      title: "Producto Test 2", 
      quantity: 1,
      price: "30.00"
    }
  ],
  subtotal_price: "80.00",
  total_price: "80.00"
};

// Mock data - Cliente SIN tag "RE"
const mockOrderWithoutRETag = {
  id: 12345678902,
  name: "#TEST-002",
  currency: "EUR",
  customer: {
    id: 987654322,
    email: "cliente-normal@test.com",
    first_name: "Cliente",
    last_name: "Sin RE",
    tags: "cliente-vip, descuento-normal"
  },
  line_items: [
    {
      id: 333333333,
      title: "Producto Test 3",
      quantity: 1,
      price: "50.00"
    }
  ],
  subtotal_price: "50.00",
  total_price: "50.00"
};

// Mock data - Cliente con tag "RE" pero pedido ya tiene recargo
const mockOrderWithRecargoExisting = {
  id: 12345678903,
  name: "#TEST-003",
  currency: "EUR",
  customer: {
    id: 987654323,
    email: "cliente-re-recargo@test.com",
    first_name: "Cliente",
    last_name: "Con RE y Recargo",
    tags: "RE"
  },
  line_items: [
    {
      id: 444444444,
      title: "Producto Test 4",
      quantity: 1,
      price: "100.00"
    },
    {
      id: 555555555,
      title: "Recargo de Equivalencia (5.2%)",
      quantity: 1,
      price: "5.20"
    }
  ],
  subtotal_price: "100.00",
  total_price: "105.20"
};

// Función para enviar webhook de prueba
async function sendTestWebhook(orderData, testName) {
  try {
    console.log(`\n🧪 === PRUEBA: ${testName} ===`);
    console.log(`📦 Pedido: ${orderData.name}`);
    console.log(`👤 Cliente: ${orderData.customer.first_name} ${orderData.customer.last_name}`);
    console.log(`🏷️  Tags: "${orderData.customer.tags}"`);
    console.log(`💰 Subtotal: €${orderData.subtotal_price}`);
    
    const body = JSON.stringify(orderData);
    const signature = generateShopifySignature(body, WEBHOOK_SECRET);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': 'orders/paid',
      'X-Shopify-Shop-Domain': 'test-shop.myshopify.com'
    };
    
    if (signature) {
      headers['X-Shopify-Hmac-Sha256'] = signature;
      console.log(`🔐 Signature generada: ${signature.substring(0, 20)}...`);
    } else {
      console.log(`⚠️  Sin signature (SHOPIFY_WEBHOOK_SECRET no configurado)`);
    }
    
    console.log(`🚀 Enviando webhook a: ${WEBHOOK_URL}`);
    
    const response = await axios.post(WEBHOOK_URL, body, { headers });
    
    console.log(`✅ Respuesta: ${response.status} ${response.statusText}`);
    console.log(`📄 Datos:`, JSON.stringify(response.data, null, 2));
    
    return response;
    
  } catch (error) {
    console.log(`❌ Error:`, error.response?.data || error.message);
    return error.response;
  }
}

// Función principal para ejecutar todas las pruebas
async function runAllTests() {
  console.log('🎯 INICIANDO PRUEBAS DEL WEBHOOK');
  console.log('================================');
  
  // Verificar que el servidor esté ejecutándose
  try {
    await axios.get('http://localhost:3000/health');
    console.log('✅ Servidor local detectado en puerto 3000');
  } catch (error) {
    console.log('❌ Error: El servidor no está ejecutándose en puerto 3000');
    console.log('💡 Ejecuta "npm start" en otra terminal primero');
    return;
  }
  
  // Prueba 1: Cliente CON tag "RE" - Debería añadir recargo
  await sendTestWebhook(mockOrderWithRETag, 'Cliente CON tag "RE"');
  
  // Esperar un poco entre pruebas
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Prueba 2: Cliente SIN tag "RE" - No debería procesar
  await sendTestWebhook(mockOrderWithoutRETag, 'Cliente SIN tag "RE"');
  
  // Esperar un poco entre pruebas
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Prueba 3: Cliente con tag "RE" pero ya tiene recargo - No debería duplicar
  await sendTestWebhook(mockOrderWithRecargoExisting, 'Cliente con recargo existente');
  
  console.log('\n🏁 PRUEBAS COMPLETADAS');
  console.log('======================');
  console.log('💡 Revisa los logs del servidor para ver el procesamiento detallado');
}

// Función para prueba individual
async function runSingleTest(testType) {
  const tests = {
    'with-re': { data: mockOrderWithRETag, name: 'Cliente CON tag "RE"' },
    'without-re': { data: mockOrderWithoutRETag, name: 'Cliente SIN tag "RE"' },
    'with-recargo': { data: mockOrderWithRecargoExisting, name: 'Cliente con recargo existente' }
  };
  
  const test = tests[testType];
  if (!test) {
    console.log('❌ Tipo de prueba inválido. Usa: with-re, without-re, with-recargo');
    return;
  }
  
  await sendTestWebhook(test.data, test.name);
}

// Ejecutar según argumentos de línea de comandos
const args = process.argv.slice(2);
if (args.length > 0) {
  runSingleTest(args[0]);
} else {
  runAllTests();
}

module.exports = {
  sendTestWebhook,
  mockOrderWithRETag,
  mockOrderWithoutRETag,
  mockOrderWithRecargoExisting
};