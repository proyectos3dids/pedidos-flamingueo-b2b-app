const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Shopify API configuration
const isDevelopment = process.env.DEV_MODE === 'true';
const SHOPIFY_STORE_URL = isDevelopment ? process.env.SHOPIFY_DEV_STORE_URL : process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = isDevelopment ? process.env.SHOPIFY_DEV_ACCESS_TOKEN : process.env.SHOPIFY_ACCESS_TOKEN;

console.log(`🔐 Usando tienda Shopify: ${SHOPIFY_STORE_URL} (${isDevelopment ? 'Desarrollo' : 'Producción'})`);


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running - v2' });
});

// Test endpoint for extension connectivity
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    tunnel: 'https://itchy-beds-wave.loca.lt'
  });
});

// Test endpoint to verify order ID
app.post('/api/verify-order', async (req, res) => {
  
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ 
        error: 'Order ID is required',
        received: req.body
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing'
      });
    }

    // Convert numeric orderId to Shopify GID format if needed
    let shopifyOrderId = orderId;
    if (typeof orderId === 'number' || (typeof orderId === 'string' && !orderId.startsWith('gid://'))) {
      shopifyOrderId = `gid://shopify/Order/${orderId}`;
    }

    console.log('🔍 DEBUG - Processing order ID:', { 
      original: orderId, 
      originalType: typeof orderId,
      converted: shopifyOrderId,
      convertedType: typeof shopifyOrderId,
      isNumeric: typeof orderId === 'number',
      isStringNumeric: typeof orderId === 'string' && !isNaN(orderId),
      startsWithGid: typeof orderId === 'string' && orderId.startsWith('gid://'),
      requestBody: req.body
    });

    // GraphQL query to get complete order info with all price fields including removed items
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountAllocations {
                  allocatedAmountSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Retry mechanism for TLS connection issues
    let response;
    let retries = 3;
    
    while (retries > 0) {
      try {
        response = await axios.post(
          `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
          {
            query: query,
            variables: { id: shopifyOrderId }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            },
            timeout: 10000 // 10 second timeout
          }
        );
        break; // Success, exit retry loop
      } catch (networkError) {
        retries--;
        console.log(`🔄 Retry attempt ${4 - retries}/3 for order ${orderId}`);
        
        if (retries === 0) {
          throw networkError; // Re-throw if all retries failed
        }
        
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const { data, errors } = response.data;

    if (errors) {
      console.error('GraphQL errors:', errors);
      return res.status(400).json({ 
        error: 'GraphQL errors', 
        details: errors
      });
    }

    if (!data.order) {
      return res.status(404).json({ 
        error: 'Order not found',
        orderId: orderId
      });
    }

    // Calculate subtotal from line items (using discounted prices when available)
    let calculatedSubtotal = 0;
    const lineItems = data.order.lineItems.edges || [];
    let recargoExistente = false;
    
    console.log(`📋 Total line items encontrados: ${lineItems.length}`);
    
    lineItems.forEach((edge, index) => {
      const node = edge.node;
      const quantity = parseInt(node.quantity) || 0;
      
      console.log(`📦 Item ${index + 1}: "${node.title}" - Quantity: ${quantity}`);
      
      // Check if this is a recargo item (regardless of quantity for logging)
      if (node.title && (node.title.includes('Recargo de Equivalencia') || node.title.toLowerCase().includes('recargo'))) {
        console.log(`🔍 RECARGO DETECTADO: "${node.title}" - Quantity: ${quantity} - ${quantity > 0 ? 'ACTIVO' : 'ELIMINADO'}`);
      }
      
      // Only include items with quantity > 0 (active items) in subtotal calculation
      if (quantity > 0) {
        // Check if there's already a "Recargo de Equivalencia" item (only active items)
        if (node.title && (node.title.includes('Recargo de Equivalencia') || node.title.toLowerCase().includes('recargo'))) {
          console.log(`🚨 Recargo existente ACTIVO encontrado: ${node.title} (quantity: ${quantity})`);
          recargoExistente = true;
          return; // Skip from subtotal calculation
        }
        
        // Use discounted price if available, otherwise use original price
        const discountedPrice = parseFloat(node.discountedUnitPriceSet?.shopMoney?.amount || 0);
        const originalPrice = parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
        const price = discountedPrice > 0 ? discountedPrice : originalPrice;
        const lineTotal = price * quantity;
        
        console.log(`Line item activo: ${node.title} - Precio: €${price} x ${quantity} = €${lineTotal.toFixed(2)}`);
        calculatedSubtotal += lineTotal;
      } else {
        // Log removed items but don't consider them as existing surcharges
        if (node.title && (node.title.includes('Recargo de Equivalencia') || node.title.toLowerCase().includes('recargo'))) {
          console.log(`📋 Recargo ELIMINADO encontrado: ${node.title} (quantity: ${quantity}) - NO cuenta como existente`);
        } else {
          console.log(`Line item removido: ${node.title} (quantity: ${quantity}) - Excluido del subtotal`);
        }
      }
    });
    
    console.log(`Subtotal calculado para order ${data.order.name}: €${calculatedSubtotal.toFixed(2)}`);
    console.log(`Recargo existente: ${recargoExistente}`);

    // Return order info with calculated subtotal and recargo status
    res.json({
      success: true,
      order: {
        id: data.order.id,
        name: data.order.name,
        subtotal: calculatedSubtotal.toFixed(2),
        lineItemsCount: lineItems.length,
        recargoExistente: recargoExistente
      }
    });

  } catch (error) {
    console.error('❌ Error verificando order:', error.message);
    if (error.response) {
      console.error('Shopify API Error:', error.response.status, error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message
    });
  }
});

// Test endpoint to verify draft order ID
app.post('/api/verify-draft-order', async (req, res) => {
  
  try {
    let { draftOrderId } = req.body;
    
    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Draft order ID is required',
        received: req.body
      });
    }
    
    // Verificar si el ID ya tiene el formato gid://shopify/DraftOrder/
    if (!draftOrderId.startsWith('gid://shopify/DraftOrder/')) {
      console.log('Convirtiendo ID numérico a formato global:', draftOrderId);
      draftOrderId = `gid://shopify/DraftOrder/${draftOrderId}`;
    }
    
    console.log('ID del draft order a consultar:', draftOrderId);

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing'
      });
    }

    // GraphQL query to get complete draft order info with all price fields
    const query = `
      query getDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          status
          createdAt
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
                discountedUnitPrice
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                appliedDiscount {
                  amount
                  title
                  description
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: draftOrderId
    };

    // Making GraphQL query to get draft order details

    const response = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query,
        variables
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Shopify API Response received

    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      return res.status(400).json({
        error: 'GraphQL errors',
        details: response.data.errors
      });
    }

    if (response.data.data.userErrors && response.data.data.userErrors.length > 0) {
      console.error('User errors:', response.data.data.userErrors);
      return res.status(400).json({
        error: 'Shopify user errors',
        details: response.data.data.userErrors
      });
    }

    const draftOrder = response.data.data.draftOrder;
    
    // Log complete draft order data for debugging
    console.log('📋 Draft Order completo:', JSON.stringify(draftOrder, null, 2));
    
    if (!draftOrder) {
      return res.status(404).json({
        error: 'Draft order not found',
        draftOrderId: draftOrderId
      });
    }

    // Draft order found successfully
    
    res.json({
      success: true,
      message: 'Draft order found successfully!',
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        status: draftOrder.status,
        createdAt: draftOrder.createdAt,
        subtotal: draftOrder.subtotalPriceSet?.shopMoney?.amount || '0',
        currency: draftOrder.subtotalPriceSet?.shopMoney?.currencyCode || 'EUR',
        lineItemsCount: draftOrder.lineItems?.edges?.length || 0
      }
    });

  } catch (error) {
    console.error('Error verifying draft order:', error.message);
    console.error('Error details:', error.response?.data || error);
    
    res.status(500).json({
      error: 'Failed to verify draft order',
      details: error.message,
      shopifyError: error.response?.data
    });
  }
});

// Endpoint para completar un draft order (usado por la extensión POS)
app.post('/api/complete-draft-order', async (req, res) => {
  console.log('POS Extension - Complete draft order request:', req.body);
  
  const { draftOrderId } = req.body;
  
  if (!draftOrderId) {
    return res.status(400).json({ 
      success: false, 
      error: 'draftOrderId es requerido' 
    });
  }
  
  try {
    // Obtener plantillas de términos de pago disponibles
    const paymentTermsQuery = `
      query {
        paymentTermsTemplates {
          id
          name
          paymentTermsType
          dueInDays
        }
      }
    `;
    
    const paymentTermsResponse = await axios.post(
       `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      { query: paymentTermsQuery },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('Payment terms templates response:', JSON.stringify(paymentTermsResponse.data, null, 2));
    
    // Verificar si la respuesta tiene errores o datos válidos
    if (paymentTermsResponse.data.errors) {
      console.error('GraphQL errors in payment terms query:', paymentTermsResponse.data.errors);
      // Continuar sin términos de pago si hay errores
    }
    
    let net30Template = null;
    
    // Verificar que la estructura de datos sea válida antes de acceder
    if (paymentTermsResponse.data.data && 
        paymentTermsResponse.data.data.paymentTermsTemplates && 
        Array.isArray(paymentTermsResponse.data.data.paymentTermsTemplates)) {
      
      const templates = paymentTermsResponse.data.data.paymentTermsTemplates;
      net30Template = templates.find(template => 
        template.paymentTermsType === 'NET' && template.dueInDays === 30
      );
    } else {
      console.log('Payment terms templates not available or invalid structure');
    }
    
    if (net30Template) {
      console.log('Found NET_30 template:', net30Template);
      
      // Establecer términos de pago NET_30
      const setPaymentTermsMutation = `
        mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
          draftOrderUpdate(id: $id, input: $input) {
            draftOrder {
              id
              name
              paymentTerms {
                paymentTermsName
                paymentTermsType
                dueInDays
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const setPaymentTermsVariables = {
        id: draftOrderId,
        input: {
          paymentTerms: {
            paymentTermsTemplateId: net30Template.id,
            paymentSchedules: [{
              issuedAt: new Date().toISOString()
            }]
          }
        }
      };
      
      const setPaymentTermsResponse = await axios.post(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
        {
          query: setPaymentTermsMutation,
          variables: setPaymentTermsVariables
        },
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Set payment terms response:', JSON.stringify(setPaymentTermsResponse.data, null, 2));
      
      // Verificar la estructura de la respuesta antes de acceder a userErrors
      if (setPaymentTermsResponse.data.data && 
          setPaymentTermsResponse.data.data.draftOrderUpdate && 
          setPaymentTermsResponse.data.data.draftOrderUpdate.userErrors && 
          setPaymentTermsResponse.data.data.draftOrderUpdate.userErrors.length > 0) {
        console.error('Error setting payment terms:', setPaymentTermsResponse.data.data.draftOrderUpdate.userErrors);
      }
    } else {
      console.log('NET_30 template not found, proceeding without payment terms');
    }
    
    // Completar el draft order
    const completeMutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder {
            id
            name
            order {
              id
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const completeVariables = {
      id: draftOrderId
    };
    
    const completeResponse = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: completeMutation,
        variables: completeVariables
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('Complete draft order response:', JSON.stringify(completeResponse.data, null, 2));
    
    // Verificar la estructura de la respuesta antes de acceder a los datos
    if (!completeResponse.data.data || !completeResponse.data.data.draftOrderComplete) {
      console.error('Invalid response structure detected:');
      console.error('Response data:', JSON.stringify(completeResponse.data, null, 2));
      console.error('Has data property:', !!completeResponse.data.data);
      console.error('Has draftOrderComplete property:', !!(completeResponse.data.data && completeResponse.data.data.draftOrderComplete));
      
      return res.status(500).json({
        success: false,
        error: 'Invalid response structure from Shopify API',
        details: {
          hasData: !!completeResponse.data.data,
          hasDraftOrderComplete: !!(completeResponse.data.data && completeResponse.data.data.draftOrderComplete),
          actualResponse: completeResponse.data
        }
      });
    }
    
    if (completeResponse.data.data.draftOrderComplete.userErrors && 
        completeResponse.data.data.draftOrderComplete.userErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: completeResponse.data.data.draftOrderComplete.userErrors[0].message
      });
    }
    
    const completedOrder = completeResponse.data.data.draftOrderComplete.draftOrder;
    
    res.json({
      success: true,
      draftOrder: {
        id: completedOrder.id,
        name: completedOrder.name,
        order: completedOrder.order
      },
      message: 'Draft order completado exitosamente con términos NET_30'
    });
    
  } catch (error) {
    console.error('Error completing draft order:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message
    });
  }
});

// Endpoint original para completar un draft order (mantener compatibilidad)
app.post('/complete-draft-order', async (req, res) => {
  try {
    const { draftOrderId } = req.body;
    
    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Draft order ID is required' 
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing' 
      });
    }

    console.log('🔄 Paso 1: Obteniendo templates de términos de pago disponibles...');
    
    // First, get available payment terms templates
    const templatesQuery = `
      query {
        paymentTermsTemplates {
          id
          name
          paymentTermsType
          dueInDays
        }
      }
    `;

    const templatesResponse = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2025-07/graphql.json`,
      { query: templatesQuery },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📋 Templates disponibles:', JSON.stringify(templatesResponse.data.data.paymentTermsTemplates, null, 2));
    
    // Find NET_30 template (30 days net payment)
    const net30Template = templatesResponse.data.data.paymentTermsTemplates.find(
      template => template.paymentTermsType === 'NET' && template.dueInDays === 30
    );
    
    if (!net30Template) {
      console.log('⚠️ No se encontró template NET_30, completando pedido sin términos de pago...');
      // Skip payment terms and go directly to complete
    } else {
      console.log('🔄 Paso 2: Estableciendo términos de pago NET_30...');
      
      // Step 1: Update draft order with payment terms to mark as unpaid
      const updateMutation = `
        mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
          draftOrderUpdate(id: $id, input: $input) {
            draftOrder {
              id
              name
              paymentTerms {
                id
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const updateVariables = {
        id: draftOrderId,
        input: {
          paymentTerms: {
            paymentTermsTemplateId: net30Template.id,
            paymentSchedules: [{
              issuedAt: new Date().toISOString() // Current date and time
            }]
          }
        }
      };

      const updateResponse = await axios.post(
        `https://${SHOPIFY_STORE_URL}/admin/api/2025-07/graphql.json`,
        {
          query: updateMutation,
          variables: updateVariables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );

      const { data: updateData, errors: updateErrors } = updateResponse.data;

      if (updateErrors) {
        console.error('GraphQL errors al establecer términos de pago:', updateErrors);
        return res.status(400).json({ 
          error: 'Error estableciendo términos de pago', 
          details: updateErrors 
        });
      }

      if (updateData.draftOrderUpdate.userErrors.length > 0) {
        console.error('User errors al establecer términos de pago:', updateData.draftOrderUpdate.userErrors);
        return res.status(400).json({ 
          error: 'Error estableciendo términos de pago', 
          details: updateData.draftOrderUpdate.userErrors 
        });
      }

      console.log('✅ Términos de pago establecidos correctamente');
    }
    
    console.log('🔄 Paso 3: Completando draft order...');

    // Step 2: Complete the draft order
    const completeMutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder {
            id
            name
            status
            order {
              id
              name
              paymentTerms {
                id
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const completeVariables = {
      id: draftOrderId
    };

    const completeResponse = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2025-07/graphql.json`,
      {
        query: completeMutation,
        variables: completeVariables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );
    
    const { data: completeData, errors: completeErrors } = completeResponse.data;

    if (completeErrors) {
      console.error('GraphQL errors al completar draft order:', completeErrors);
      return res.status(400).json({ 
        error: 'Error completando draft order', 
        details: completeErrors 
      });
    }

    if (completeData.draftOrderComplete.userErrors.length > 0) {
      console.error('User errors al completar draft order:', completeData.draftOrderComplete.userErrors);
      return res.status(400).json({ 
        error: 'Error completando draft order', 
        details: completeData.draftOrderComplete.userErrors 
      });
    }

    console.log('✅ Draft order completado exitosamente');
    console.log('💰 Estado financiero del pedido:', completeData.draftOrderComplete.draftOrder.order?.financialStatus);

    // Success response
    res.json({
      success: true,
      message: 'Draft order completado exitosamente como no pagado',
      draftOrder: completeData.draftOrderComplete.draftOrder,
      financialStatus: completeData.draftOrderComplete.draftOrder.order?.financialStatus
    });

  } catch (error) {
    console.error('❌ Error completando draft order:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Add recargo equivalencia endpoint
app.post('/api/add-recargo-equivalencia', async (req, res) => {
  const { draftOrderId } = req.body;
  
  console.log(`Añadiendo Recargo de Equivalencia al Draft Order ${draftOrderId}`);
  console.log('Datos recibidos completos:', JSON.stringify(req.body, null, 2));
  
  try {
    
    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Draft order ID is required' 
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing' 
      });
    }

    // First, get existing line items from the draft order
    // Getting existing line items to preserve them with all properties
    const getLineItemsQuery = `
      query getDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
                discountedUnitPrice
                originalUnitPriceWithCurrency {
                  amount
                  currencyCode
                }
                requiresShipping
                taxable
                sku
                uuid
                vendor
                variantTitle
                custom
                image {
                  id
                  url
                  altText
                  width
                  height
                }
                product {
                  id
                  title
                  handle
                }
                variant {
                  id
                  title
                  sku
                  price
                  compareAtPrice
                  image {
                    id
                    url
                    altText
                  }
                }
                customAttributes {
                  key
                  value
                }
                weight {
                  unit
                  value
                }
                appliedDiscount {
                  description
                  value
                  valueType
                }
              }
            }
          }
        }
      }
    `;

    const getResponse = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: getLineItemsQuery,
        variables: { id: draftOrderId }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    // Existing line items response received

    if (getResponse.data.errors) {
      console.error('Error getting existing line items:', getResponse.data.errors);
      return res.status(400).json({ 
        error: 'Error getting existing line items', 
        details: getResponse.data.errors 
      });
    }

    // Get draft order details
    const draftOrder = getResponse.data.data?.draftOrder;
    
    // Depurar la estructura completa de la respuesta
    console.log('Estructura completa de getResponse:', JSON.stringify(getResponse.data, null, 2));
    
    if (!draftOrder) {
      console.error('Error: Draft order not found in response');
      return res.status(404).json({ 
        error: 'Draft order not found', 
        draftOrderId: draftOrderId 
      });
    }
    
    console.log(`Draft Order details: ID=${draftOrder.id}`);
    console.log('Estructura completa del draftOrder:', JSON.stringify(draftOrder, null, 2));

    // Calculate subtotal from existing line items
    let subtotal = 0;
    const lineItemsData = getResponse.data.data.draftOrder.lineItems.edges || [];
    
    lineItemsData.forEach(edge => {
      const node = edge.node;
      
      // Skip existing "Recargo de Equivalencia" items from subtotal calculation
      if (node.title && node.title.includes('Recargo de Equivalencia')) {
        console.log(`Saltando recargo existente: ${node.title}`);
        return;
      }
      
      // Use discounted price if available, otherwise use original price
      const price = parseFloat(node.discountedUnitPrice) || parseFloat(node.originalUnitPrice) || 0;
      const quantity = parseInt(node.quantity) || 0;
      const lineTotal = price * quantity;
      console.log(`Line item: ${node.title} - Precio con descuento: €${price} x ${quantity} = €${lineTotal.toFixed(2)}`);
      subtotal += lineTotal;
    });
    
    console.log(`Subtotal calculado: €${subtotal.toFixed(2)}`);
    
    // Calculate recargo amount (5.2% of subtotal)
    const recargoAmount = subtotal * 0.052;
    
    if (recargoAmount <= 0) {
      return res.status(400).json({ 
        error: 'Recargo amount must be greater than 0. El draft order debe tener productos con precio.' 
      });
    }
    
    console.log(`Recargo calculado: €${recargoAmount.toFixed(2)} (5.2% de €${subtotal.toFixed(2)}`);

    // Extract existing line items (handle case when no items exist)
    const existingLineItems = getResponse.data.data.draftOrder.lineItems.edges ? 
      getResponse.data.data.draftOrder.lineItems.edges.map(edge => {
        const node = edge.node;
        const lineItem = {
          title: node.title,
          quantity: node.quantity,
          originalUnitPrice: node.originalUnitPrice,
          requiresShipping: node.requiresShipping,
          taxable: node.taxable
        };
        
        // Only include valid fields for DraftOrderLineItemInput
        if (node.variant && node.variant.id) {
          lineItem.variantId = node.variant.id;
        }
        
        if (node.customAttributes && node.customAttributes.length > 0) {
          lineItem.customAttributes = node.customAttributes.map(attr => ({
            key: attr.key,
            value: attr.value
          }));
        }
        
        if (node.appliedDiscount) {
          lineItem.appliedDiscount = {
            description: node.appliedDiscount.description,
            value: node.appliedDiscount.value,
            valueType: node.appliedDiscount.valueType
          };
        }
        
        return lineItem;
      }) : [];

    // Filter out any existing recargo items to replace them with the correct one
    const filteredLineItems = existingLineItems.filter(item => 
      !item.title || !item.title.includes('Recargo de Equivalencia')
    );

    console.log(`Recargos existentes eliminados: ${existingLineItems.length - filteredLineItems.length}`);

    // Add the new recargo line item to filtered items (or create new array if no existing items)
    const allLineItems = [
      ...filteredLineItems,
      {
        title: "Recargo de Equivalencia (5.2%)",
        quantity: 1,
        originalUnitPrice: recargoAmount.toFixed(2),
        requiresShipping: false,
        taxable: false
      }
    ];

    console.log(`Total line items después de añadir recargo: ${allLineItems.length}`);

    // All line items prepared (existing + recargo)

    // GraphQL mutation to update draft order with all line items
    const mutation = `
      mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
        draftOrderUpdate(id: $id, input: $input) {
          draftOrder {
            id
            name
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPrice
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      id: draftOrderId,
      input: {
        lineItems: allLineItems
      }
    };

    // GraphQL mutation variables prepared

    const response = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: mutation,
        variables: variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    // Shopify API response received

    const { data, errors } = response.data;

    if (errors) {
      console.error('GraphQL errors:', errors);
      return res.status(400).json({ 
        error: 'GraphQL errors', 
        details: errors 
      });
    }

    if (data.draftOrderUpdate.userErrors && data.draftOrderUpdate.userErrors.length > 0) {
      console.error('User errors:', data.draftOrderUpdate.userErrors);
      return res.status(400).json({ 
        error: 'Shopify user errors', 
        details: data.draftOrderUpdate.userErrors 
      });
    }

    console.log(`✅ Recargo de Equivalencia añadido exitosamente: €${recargoAmount.toFixed(2)}`);
    res.json({
      success: true,
      message: 'Recargo de equivalencia añadido exitosamente',
      draftOrder: data.draftOrderUpdate.draftOrder,
      recargoAmount: recargoAmount.toFixed(2),
      subtotal: subtotal.toFixed(2)
    });

  } catch (error) {
    console.error('❌ Error añadiendo Recargo de Equivalencia:', error.message);
    if (error.response) {
      console.error('Shopify API Error:', error.response.status, error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Get all draft orders endpoint
app.get('/api/draft-orders', async (req, res) => {
  try {
    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing' 
      });
    }

    // GraphQL query to get draft orders
    const query = `
      query {
        draftOrders(first: 50, query: "status:open") {
          edges {
            node {
              id
              name
              createdAt
              updatedAt
              totalPrice
              subtotalPrice
              currencyCode
              customer {
                displayName
                email
              }
              lineItems(first: 3) {
                edges {
                  node {
                    title
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    const { data, errors } = response.data;

    if (errors) {
      console.error('GraphQL errors:', errors);
      return res.status(400).json({ 
        error: 'GraphQL errors', 
        details: errors 
      });
    }

    res.json({
      success: true,
      draftOrders: data.draftOrders.edges.map(edge => edge.node)
    });
  } catch (error) {
    console.error('Error getting draft orders:', error.message);
    if (error.response) {
      console.error('Axios response status:', error.response.status);
      console.error('Axios response data:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Get draft order details endpoint
app.get('/api/draft-order/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing' 
      });
    }

    // GraphQL query to get draft order details
    const query = `
      query getDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          status
          totalPrice
          currencyCode
          createdAt
          updatedAt
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
              }
            }
          }
        }
      }
    `;

    const variables = { id };

    const response = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: query,
        variables: variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    const { data, errors } = response.data;

    if (errors) {
      console.error('GraphQL errors:', errors);
      return res.status(400).json({ 
        error: 'GraphQL errors', 
        details: errors 
      });
    }

    res.json({
      success: true,
      draftOrder: data.draftOrder
    });
  } catch (error) {
    console.error('=== ERROR COMPLETING DRAFT ORDER ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Axios response status:', error.response.status);
      console.error('Axios response data:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Add recargo equivalencia for edited orders endpoint
app.post('/api/add-recargo-equivalencia-order', async (req, res) => {
  console.log('🔍 [ADD-RECARGO] Iniciando proceso de añadir recargo');
  console.log('📥 [ADD-RECARGO] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { orderId } = req.body;
    
    console.log(`📋 [ADD-RECARGO] Parámetros recibidos:`);
    console.log(`   - orderId: ${orderId}`);
    
    if (!orderId) {
      console.log('❌ [ADD-RECARGO] Error: Order ID faltante');
      return res.status(400).json({ 
        error: 'Order ID is required',
        received: req.body
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing'
      });
    }

    // Convert numeric orderId to Shopify GID format if needed
    let shopifyOrderId = orderId;
    if (typeof orderId === 'number' || (typeof orderId === 'string' && !orderId.startsWith('gid://'))) {
      shopifyOrderId = `gid://shopify/Order/${orderId}`;
    }

    console.log(`🔄 [ADD-RECARGO] Procesando recargo para order: ${orderId} -> ${shopifyOrderId}`);
    console.log(`🏪 [ADD-RECARGO] Store URL: ${SHOPIFY_STORE_URL}`);
    console.log(`🔑 [ADD-RECARGO] Access Token disponible: ${SHOPIFY_ACCESS_TOKEN ? 'Sí' : 'No'}`);

    // First, get order info to verify status and check if we can modify it
    console.log('📊 [ADD-RECARGO] Obteniendo información de la orden...');
    const getOrderQuery = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          displayFinancialStatus
          displayFulfillmentStatus
          closed
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    `;

    const orderResponse = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: getOrderQuery,
        variables: { id: shopifyOrderId }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    console.log('📡 [ADD-RECARGO] Respuesta de Shopify API recibida');
    const { data: orderData, errors: orderErrors } = orderResponse.data;

    if (orderErrors) {
      console.error('❌ [ADD-RECARGO] GraphQL errors getting order:', orderErrors);
      return res.status(400).json({ 
        error: 'Error getting order', 
        details: orderErrors 
      });
    }

    if (!orderData.order) {
      console.log('❌ [ADD-RECARGO] Orden no encontrada');
      return res.status(404).json({ 
        error: 'Order not found',
        orderId: orderId
      });
    }
    
    const order = orderData.order;
    console.log(`📋 [ADD-RECARGO] Orden encontrada:`);
    console.log(`   - ID: ${order.id}`);
    console.log(`   - Name: ${order.name}`);
    console.log(`   - Financial Status: ${order.displayFinancialStatus}`);
    console.log(`   - Fulfillment Status: ${order.displayFulfillmentStatus}`);
    console.log(`   - Closed: ${order.closed}`);

    // Calculate subtotal (excluding existing recargo items)
    let calculatedSubtotal = 0;
    const lineItems = order.lineItems.edges || [];
    
    console.log(`🧮 [ADD-RECARGO] Calculando subtotal de ${lineItems.length} items...`);
    
    lineItems.forEach((edge, index) => {
      const node = edge.node;
      
      // Skip existing "Recargo de Equivalencia" items
      if (node.title && node.title.includes('Recargo de Equivalencia')) {
        console.log(`⏭️ [ADD-RECARGO] Saltando recargo existente: ${node.title}`);
        return;
      }
      
      // Use discounted price if available, otherwise use original price
      const discountedPrice = parseFloat(node.discountedUnitPriceSet?.shopMoney?.amount || 0);
      const originalPrice = parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
      const price = discountedPrice > 0 ? discountedPrice : originalPrice;
      const quantity = parseInt(node.quantity) || 0;
      const lineTotal = price * quantity;
      
      console.log(`   Item ${index + 1}: ${node.title} - €${price} x ${quantity} = €${lineTotal.toFixed(2)}`);
      calculatedSubtotal += lineTotal;
    });

    // Calculate recargo amount (5.2% of subtotal)
    const finalRecargoAmount = calculatedSubtotal * 0.052;
    
    console.log(`💰 [ADD-RECARGO] Subtotal calculado: €${calculatedSubtotal.toFixed(2)}`);
    console.log(`💰 [ADD-RECARGO] Recargo a añadir: €${finalRecargoAmount.toFixed(2)}`);
    
    // Check if order can be modified
    if (order.closed) {
      console.log('⚠️ [ADD-RECARGO] La orden está cerrada, no se puede modificar');
      return res.json({
        success: false,
        message: 'La orden está cerrada y no puede ser modificada',
        order: {
          id: order.id,
          name: order.name,
          status: order.displayFinancialStatus,
          subtotal: calculatedSubtotal.toFixed(2),
          recargoAmount: finalRecargoAmount.toFixed(2),
          canModify: false,
          reason: 'Orden cerrada'
        }
      });
    }

    // Try to add line item using Order Edit API (for orders that support editing)
    console.log('🔧 [ADD-RECARGO] Intentando añadir recargo usando Order Edit API...');
    
    try {
      // First, create an order edit
      const createEditMutation = `
        mutation orderEditBegin($id: ID!) {
          orderEditBegin(id: $id) {
            calculatedOrder {
              id
              addedLineItems(first: 10) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      console.log('📝 [ADD-RECARGO] Creando order edit...');
      const editResponse = await axios.post(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
        {
          query: createEditMutation,
          variables: { id: shopifyOrderId }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      
      const editData = editResponse.data;
      console.log('📝 [ADD-RECARGO] Respuesta de order edit:', JSON.stringify(editData, null, 2));
      
      if (editData.data?.orderEditBegin?.userErrors?.length > 0) {
        const errors = editData.data.orderEditBegin.userErrors;
        console.log('❌ [ADD-RECARGO] No se puede editar la orden:', errors);
        
        return res.json({
          success: false,
          message: 'No se puede editar esta orden',
          order: {
            id: order.id,
            name: order.name,
            status: order.displayFinancialStatus,
            subtotal: calculatedSubtotal.toFixed(2),
            recargoAmount: finalRecargoAmount.toFixed(2),
            canModify: false,
            reason: 'Orden no editable: ' + errors.map(e => e.message).join(', ')
          },
          errors: errors
        });
      }
      
      console.log('✅ [ADD-RECARGO] Order edit creado exitosamente');
      
      // Registrar los elementos añadidos y existentes
      const addedLineItems = editData.data?.orderEditBegin?.calculatedOrder?.addedLineItems?.edges?.map(edge => edge.node) || [];
      const lineItems = editData.data?.orderEditBegin?.calculatedOrder?.lineItems?.edges?.map(edge => edge.node) || [];
      
      if (addedLineItems.length > 0) {
        console.log('📊 [ADD-RECARGO] Elementos añadidos al iniciar la edición:');
        addedLineItems.forEach((item, index) => {
          console.log(`  Elemento ${index + 1}: "${item.title}" - Cantidad: ${item.quantity}`);
        });
      }
      
      if (lineItems.length > 0) {
        console.log('📊 [ADD-RECARGO] Elementos existentes al iniciar la edición:');
        lineItems.forEach((item, index) => {
          console.log(`  Elemento ${index + 1}: "${item.title}" - Cantidad: ${item.quantity}`);
        });
          
      }
      
      const calculatedOrderId = editData.data.orderEditBegin.calculatedOrder.id;
      console.log(`📝 [ADD-RECARGO] Calculated Order ID: ${calculatedOrderId}`);
      
      // Now add the recargo line item to the order edit
      const addLineItemMutation = `
        mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!) {
          orderEditAddCustomItem(id: $id, title: $title, price: $price, quantity: $quantity) {
            calculatedLineItem {
              id
              title
              quantity
            }
            calculatedOrder {
              id
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      console.log('➕ [ADD-RECARGO] Añadiendo line item del recargo...');
      const addItemResponse = await axios.post(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
        {
          query: addLineItemMutation,
          variables: {
            id: calculatedOrderId,
            title: 'Recargo de Equivalencia (5.2%)',
            quantity: 1,
            price: {
              amount: finalRecargoAmount.toFixed(2),
              currencyCode: 'EUR'
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      
      const addItemData = addItemResponse.data;
      console.log('➕ [ADD-RECARGO] Respuesta de añadir line item:', JSON.stringify(addItemData, null, 2));
      
      if (addItemData.data?.orderEditAddCustomItem?.userErrors?.length > 0) {
        const errors = addItemData.data.orderEditAddCustomItem.userErrors;
        console.log('❌ [ADD-RECARGO] Error añadiendo line item:', errors);
        
        return res.json({
          success: false,
          message: 'No se pudo añadir el recargo al pedido',
          order: {
            id: order.id,
            name: order.name,
            status: order.displayFinancialStatus,
            subtotal: calculatedSubtotal.toFixed(2),
            recargoAmount: finalRecargoAmount.toFixed(2),
            canModify: true,
            reason: 'Error añadiendo line item: ' + errors.map(e => e.message).join(', ')
          },
          errors: errors
        });
      }
      
      console.log('✅ [ADD-RECARGO] Line item añadido exitosamente');
      
      // Registrar el elemento calculado añadido
      const calculatedLineItem = addItemData.data?.orderEditAddCustomItem?.calculatedLineItem;
      if (calculatedLineItem) {
        console.log(`📦 [ADD-RECARGO] Elemento calculado añadido: ${calculatedLineItem.title} (ID: ${calculatedLineItem.id})`);
        console.log(`   Cantidad: ${calculatedLineItem.quantity}`);
      }
      
      // Registrar los elementos de la orden calculada
      const calculatedOrder = addItemData.data?.orderEditAddCustomItem?.calculatedOrder;
      const orderLineItems = calculatedOrder?.lineItems?.edges?.map(edge => edge.node) || [];
      if (calculatedOrder && orderLineItems.length > 0) {
        console.log('📊 [ADD-RECARGO] Elementos en la orden después de añadir el recargo:');
        orderLineItems.forEach((item, index) => {
          console.log(`  Elemento ${index + 1}: "${item.title}" - Cantidad: ${item.quantity}`);
        });
      }
      
      // Finally, commit the order edit
      const commitEditMutation = `
        mutation orderEditCommit($id: ID!) {
          orderEditCommit(id: $id) {
            order {
              id
              name
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      console.log('💾 [ADD-RECARGO] Confirmando cambios del order edit...');
      const commitResponse = await axios.post(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
        {
          query: commitEditMutation,
          variables: { id: calculatedOrderId }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      
      const commitData = commitResponse.data;
      console.log('💾 [ADD-RECARGO] Respuesta de commit:', JSON.stringify(commitData, null, 2));
      
      if (commitData.data?.orderEditCommit?.userErrors?.length > 0) {
        const errors = commitData.data.orderEditCommit.userErrors;
        console.log('❌ [ADD-RECARGO] Error confirmando cambios:', errors);
        
        return res.json({
          success: false,
          message: 'No se pudieron confirmar los cambios del pedido',
          order: {
            id: order.id,
            name: order.name,
            status: order.displayFinancialStatus,
            subtotal: calculatedSubtotal.toFixed(2),
            recargoAmount: finalRecargoAmount.toFixed(2),
            canModify: true,
            reason: 'Error confirmando cambios: ' + errors.map(e => e.message).join(', ')
          },
          errors: errors
        });
      }
      
      console.log('🎉 [ADD-RECARGO] ¡Recargo añadido exitosamente al pedido!');
      
      // Registrar los elementos del pedido después de confirmar los cambios
      const updatedOrder = commitData.data?.orderEditCommit?.order;
      if (updatedOrder) {
        console.log(`📋 [ADD-RECARGO] Pedido actualizado: ${updatedOrder.name} (ID: ${updatedOrder.id})`);
        
        // Registrar los elementos del pedido actualizado
        const lineItems = updatedOrder.lineItems?.edges || [];
        console.log(`📦 [ADD-RECARGO] Total de elementos en el pedido actualizado: ${lineItems.length}`);
        
        lineItems.forEach((edge, index) => {
          const node = edge.node;
          console.log(`  Elemento ${index + 1}: "${node.title}" - Cantidad: ${node.quantity}`);
          
          // Identificar el recargo añadido
          if (node.title && (node.title.includes('Recargo de Equivalencia') || node.title.toLowerCase().includes('recargo'))) {
            console.log(`  ✅ [ADD-RECARGO] Recargo confirmado en el pedido: "${node.title}" - Cantidad: ${node.quantity}`);
          }
        });
      }
      
      // Return success with all details
      res.json({
        success: true,
        message: 'Recargo añadido exitosamente al pedido',
        order: {
          id: order.id,
          name: order.name,
          status: order.displayFinancialStatus,
          subtotal: calculatedSubtotal.toFixed(2),
          recargoAmount: finalRecargoAmount.toFixed(2),
          newTotal: (calculatedSubtotal + finalRecargoAmount).toFixed(2),
          canModify: true,
          editCreated: true,
          lineItemAdded: true,
          changesCommitted: true
        }
      });
      
    } catch (editError) {
      console.error('❌ [ADD-RECARGO] Error creando order edit:', editError.message);
      
      // Return calculation info even if edit fails
      res.json({
        success: false,
        message: 'No se pudo modificar la orden, pero el cálculo es correcto',
        order: {
          id: order.id,
          name: order.name,
          status: order.displayFinancialStatus,
          subtotal: calculatedSubtotal.toFixed(2),
          recargoAmount: finalRecargoAmount.toFixed(2),
          canModify: false,
          reason: 'Error técnico: ' + editError.message
        }
      });
    }

  } catch (error) {
    console.error('❌ Error procesando recargo para order:', error.message);
    if (error.response) {
      console.error('Shopify API Error:', error.response.status, error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;