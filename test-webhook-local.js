const axios = require('axios');
const crypto = require('crypto');

// Configuración del webhook
const WEBHOOK_URL = 'http://localhost:3000/api/webhook/order-paid';
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || ''; // Opcional para desarrollo

// Función para generar signature de Shopify (si tienes el secret)
function generateShopifySignature(data, secret) {
  if (!secret) return 'fake-signature-for-dev';
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data, 'utf8');
  return hmac.digest('base64');
}

// Payload personalizable del webhook
function createOrderPayload(customData = {}) {
  const defaultOrder = {
    "id": customData.id || 820982911946154508,
    "admin_graphql_api_id": `gid://shopify/Order/${customData.id || 820982911946154508}`,
    "app_id": null,
    "browser_ip": null,
    "buyer_accepts_marketing": true,
    "cancel_reason": customData.cancel_reason || null,
    "cancelled_at": customData.cancelled_at || null,
    "cart_token": null,
    "checkout_id": null,
    "checkout_token": null,
    "client_details": null,
    "closed_at": null,
    "confirmation_number": null,
    "confirmed": customData.confirmed || true,
    "contact_email": customData.contact_email || "test@example.com",
    "created_at": customData.created_at || new Date().toISOString(),
    "currency": customData.currency || "EUR",
    "current_shipping_price_set": {
      "shop_money": {
        "amount": "10.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "10.00",
        "currency_code": "EUR"
      }
    },
    "current_subtotal_price": customData.subtotal || "71.08",
    "current_subtotal_price_set": {
      "shop_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      }
    },
    "current_total_additional_fees_set": null,
    "current_total_discounts": "0.00",
    "current_total_discounts_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "current_total_duties_set": null,
    "current_total_price": customData.total || "71.08",
    "current_total_price_set": {
      "shop_money": {
        "amount": customData.total || "71.08",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": customData.total || "71.08",
        "currency_code": "EUR"
      }
    },
    "current_total_tax": "0.00",
    "current_total_tax_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "customer_locale": "es",
    "device_id": null,
    "discount_codes": [],
    "duties_included": false,
    "email": customData.email || "test@example.com",
    "estimated_taxes": false,
    "financial_status": customData.financial_status || "paid",
    "fulfillment_status": null,
    "landing_site": null,
    "landing_site_ref": null,
    "location_id": null,
    "merchant_business_entity_id": "30402871621",
    "merchant_of_record_app_id": null,
    "name": customData.name || "#TEST-001",
    "note": null,
    "note_attributes": [],
    "number": customData.number || 1001,
    "order_number": customData.order_number || 2001,
    "order_status_url": "https://b2bflamingueo.com/96667894085/orders/test123/authenticate?key=testkey",
    "original_total_additional_fees_set": null,
    "original_total_duties_set": null,
    "payment_gateway_names": [
      "visa",
      "bogus"
    ],
    "phone": null,
    "po_number": null,
    "presentment_currency": "EUR",
    "processed_at": customData.processed_at || new Date().toISOString(),
    "reference": null,
    "referring_site": null,
    "source_identifier": null,
    "source_name": "web",
    "source_url": null,
    "subtotal_price": customData.subtotal || "71.08",
    "subtotal_price_set": {
      "shop_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      }
    },
    "tags": customData.tags || "test-order",
    "tax_exempt": false,
    "tax_lines": [],
    "taxes_included": false,
    "test": customData.test !== undefined ? customData.test : true,
    "token": "test123token",
    "total_cash_rounding_payment_adjustment_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "total_cash_rounding_refund_adjustment_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "total_discounts": "0.00",
    "total_discounts_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "total_line_items_price": customData.subtotal || "71.08",
    "total_line_items_price_set": {
      "shop_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": customData.subtotal || "71.08",
        "currency_code": "EUR"
      }
    },
    "total_outstanding": customData.total || "71.08",
    "total_price": customData.total || "71.08",
    "total_price_set": {
      "shop_money": {
        "amount": customData.total || "71.08",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": customData.total || "71.08",
        "currency_code": "EUR"
      }
    },
    "total_shipping_price_set": {
      "shop_money": {
        "amount": "10.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "10.00",
        "currency_code": "EUR"
      }
    },
    "total_tax": "0.00",
    "total_tax_set": {
      "shop_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      },
      "presentment_money": {
        "amount": "0.00",
        "currency_code": "EUR"
      }
    },
    "total_tip_received": "0.00",
    "total_weight": 0,
    "updated_at": customData.updated_at || new Date().toISOString(),
    "user_id": null,
    "billing_address": {
      "first_name": customData.billing_first_name || "Test",
      "address1": "123 Test Street",
      "phone": "555-555-TEST",
      "city": "Test City",
      "zip": "12345",
      "province": "Test Province",
      "country": "Spain",
      "last_name": customData.billing_last_name || "User",
      "address2": null,
      "company": "Test Company",
      "latitude": null,
      "longitude": null,
      "name": `${customData.billing_first_name || "Test"} ${customData.billing_last_name || "User"}`,
      "country_code": "ES",
      "province_code": "TP"
    },
    "customer": {
      "id": customData.customer_id || 115310627314723954,
      "created_at": null,
      "updated_at": null,
      "first_name": customData.customer_first_name || "Test",
      "last_name": customData.customer_last_name || "Customer",
      "state": "enabled",
      "note": null,
      "verified_email": true,
      "multipass_identifier": null,
      "tax_exempt": false,
      "email": customData.customer_email || "test-customer@example.com",
      "phone": null,
      "currency": "EUR",
      "tax_exemptions": [],
      "admin_graphql_api_id": `gid://shopify/Customer/${customData.customer_id || 115310627314723954}`,
      "default_address": {
        "id": 715243470612851234,
        "customer_id": customData.customer_id || 115310627314723954,
        "first_name": customData.customer_first_name || "Test",
        "last_name": customData.customer_last_name || "Customer",
        "company": null,
        "address1": "123 Customer St.",
        "address2": null,
        "city": "Customer City",
        "province": "Customer Province",
        "country": "Spain",
        "zip": "54321",
        "phone": "123-123-1234",
        "name": `${customData.customer_first_name || "Test"} ${customData.customer_last_name || "Customer"}`,
        "province_code": "CP",
        "country_code": "ES",
        "country_name": "Spain",
        "default": true
      }
    },
    "discount_applications": [],
    "fulfillments": [],
    "line_items": customData.line_items || [
      {
        "id": 866550311766439020,
        "admin_graphql_api_id": "gid://shopify/LineItem/866550311766439020",
        "attributed_staffs": [],
        "current_quantity": 1,
        "fulfillable_quantity": 1,
        "fulfillment_service": "manual",
        "fulfillment_status": null,
        "gift_card": false,
        "grams": 0,
        "name": "Producto de Prueba",
        "price": "25.00",
        "price_set": {
          "shop_money": {
            "amount": "25.00",
            "currency_code": "EUR"
          },
          "presentment_money": {
            "amount": "25.00",
            "currency_code": "EUR"
          }
        },
        "product_exists": true,
        "product_id": 123456789,
        "properties": [],
        "quantity": 1,
        "requires_shipping": true,
        "sales_line_item_group_id": null,
        "sku": "TEST-001",
        "taxable": true,
        "title": "Producto de Prueba",
        "total_discount": "0.00",
        "total_discount_set": {
          "shop_money": {
            "amount": "0.00",
            "currency_code": "EUR"
          },
          "presentment_money": {
            "amount": "0.00",
            "currency_code": "EUR"
          }
        },
        "variant_id": 987654321,
        "variant_inventory_management": "shopify",
        "variant_title": null,
        "vendor": null,
        "tax_lines": [],
        "duties": [],
        "discount_allocations": []
      }
    ],
    "payment_terms": null,
    "refunds": [],
    "shipping_address": {
      "first_name": customData.shipping_first_name || "Test",
      "address1": "123 Shipping Street",
      "phone": "555-555-SHIP",
      "city": "Shipping City",
      "zip": "67890",
      "province": "Shipping Province",
      "country": "Spain",
      "last_name": customData.shipping_last_name || "Recipient",
      "address2": null,
      "company": "Shipping Company",
      "latitude": null,
      "longitude": null,
      "name": `${customData.shipping_first_name || "Test"} ${customData.shipping_last_name || "Recipient"}`,
      "country_code": "ES",
      "province_code": "SP"
    },
    "shipping_lines": [
      {
        "id": 271878346596884123,
        "carrier_identifier": null,
        "code": null,
        "current_discounted_price_set": {
          "shop_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          },
          "presentment_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          }
        },
        "discounted_price": "10.00",
        "discounted_price_set": {
          "shop_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          },
          "presentment_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          }
        },
        "is_removed": false,
        "phone": null,
        "price": "10.00",
        "price_set": {
          "shop_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          },
          "presentment_money": {
            "amount": "10.00",
            "currency_code": "EUR"
          }
        },
        "requested_fulfillment_service_id": null,
        "source": "shopify",
        "title": "Envío Estándar",
        "tax_lines": [],
        "discount_allocations": []
      }
    ],
    "returns": [],
    "line_item_groups": []
  };

  return defaultOrder;
}

// Función principal para enviar el webhook
async function sendWebhook(customData = {}) {
  try {
    console.log('🚀 Enviando webhook de prueba...');
    console.log('📍 URL:', WEBHOOK_URL);
    
    // Crear el payload
    const orderData = createOrderPayload(customData);
    const payload = JSON.stringify(orderData);
    
    // Generar signature
    const signature = generateShopifySignature(payload, WEBHOOK_SECRET);
    
    // Headers que envía Shopify
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': signature,
      'X-Shopify-Shop-Domain': 'flamingueo-b2b-dev.myshopify.com',
      'X-Shopify-Topic': 'orders/paid',
      'X-Shopify-API-Version': '2023-10',
      'User-Agent': 'Shopify/1.0 (+https://shopify.com)'
    };
    
    console.log('📦 Datos del pedido:');
    console.log(`   - ID: ${orderData.id}`);
    console.log(`   - Nombre: ${orderData.name}`);
    console.log(`   - Email: ${orderData.email}`);
    console.log(`   - Total: ${orderData.total_price} ${orderData.currency}`);
    console.log(`   - Cliente ID: ${orderData.customer.id}`);
    console.log(`   - Cliente Email: ${orderData.customer.email}`);
    console.log(`   - Estado financiero: ${orderData.financial_status}`);
    console.log(`   - Es prueba: ${orderData.test}`);
    
    // Enviar la petición
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: headers,
      timeout: 30000
    });
    
    console.log('✅ Webhook enviado exitosamente!');
    console.log(`📊 Status: ${response.status}`);
    console.log('📋 Respuesta:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error enviando webhook:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else if (error.request) {
      console.error('   No se recibió respuesta del servidor');
      console.error('   ¿Está el servidor corriendo en http://localhost:3000?');
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    throw error;
  }
}

// Ejemplos de uso
async function runTests() {
  console.log('🧪 Ejecutando pruebas de webhook...\n');
  
  try {
    // Prueba 1: Pedido básico
    console.log('=== PRUEBA 1: Pedido básico ===');
    await sendWebhook({
      id: 1001,
      name: '#TEST-001',
      email: 'test1@example.com',
      customer_id: 123456789,
      customer_email: 'customer1@example.com',
      total: '50.00',
      subtotal: '40.00',
      financial_status: 'paid'
    });
    
    console.log('\n⏳ Esperando 2 segundos...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Prueba 2: Pedido con cliente diferente
    console.log('=== PRUEBA 2: Pedido con cliente diferente ===');
    await sendWebhook({
      id: 1002,
      name: '#TEST-002',
      email: 'test2@example.com',
      customer_id: 987654321,
      customer_email: 'customer2@example.com',
      customer_first_name: 'María',
      customer_last_name: 'García',
      total: '75.50',
      subtotal: '65.50',
      financial_status: 'paid'
    });
    
    console.log('\n✅ Todas las pruebas completadas!');
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.message);
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Ejecutar pruebas por defecto
    runTests();
  } else {
    // Permitir personalización desde línea de comandos
    const customData = {};
    
    // Parsear argumentos simples
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      
      if (value) {
        // Convertir números
        if (!isNaN(value)) {
          customData[key] = Number(value);
        } else {
          customData[key] = value;
        }
      }
    }
    
    console.log('🎯 Enviando webhook personalizado:', customData);
    sendWebhook(customData);
  }
}

module.exports = {
  sendWebhook,
  createOrderPayload,
  generateShopifySignature
};