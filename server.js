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
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL; // e.g., 'your-store.myshopify.com'
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

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

// Test endpoint to verify draft order ID
app.post('/api/verify-draft-order', async (req, res) => {
  
  try {
    const { draftOrderId } = req.body;
    
    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Draft order ID is required',
        received: req.body
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing'
      });
    }

    // GraphQL query to get basic draft order info
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
          lineItems(first: 5) {
            edges {
              node {
                id
                title
                quantity
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
  const { draftOrderId, recargoAmount, subtotal } = req.body;
  
  // Información del recargo: €${recargoAmount} (5.2% de €${subtotal})
    console.log(`Añadiendo Recargo de Equivalencia: €${recargoAmount} (5.2% de €${subtotal}) al Draft Order ${draftOrderId}`);
  
  try {
    
    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Draft order ID is required' 
      });
    }

    if (!recargoAmount || recargoAmount <= 0) {
      return res.status(400).json({ 
        error: 'Recargo amount must be greater than 0' 
      });
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      return res.status(500).json({ 
        error: 'Shopify configuration is missing' 
      });
    }

    // First, get existing line items from the draft order
    // Getting existing line items to preserve them
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
                requiresShipping
                taxable
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
        
        // Add variantId if it exists
        if (node.variantId) {
          lineItem.variantId = node.variantId;
        }
        
        return lineItem;
      }) : [];

    // Existing line items will be preserved

    // Check if recargo already exists (only if there are existing items)
    const recargoExists = existingLineItems.length > 0 && existingLineItems.some(item => 
      item.title && item.title.includes('Recargo de Equivalencia')
    );

    if (recargoExists) {
      return res.status(400).json({ 
        error: 'El recargo de equivalencia ya existe en este draft order' 
      });
    }

    // Add the new recargo line item to existing items (or create new array if no existing items)
    const allLineItems = [
      ...existingLineItems,
      {
        title: "Recargo de Equivalencia (5.2%)",
        quantity: 1,
        originalUnitPrice: recargoAmount.toString(),
        requiresShipping: false,
        taxable: false
      }
    ];

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

    console.log(`✅ Recargo de Equivalencia añadido exitosamente: €${recargoAmount}`);
    res.json({
      success: true,
      message: 'Recargo de equivalencia añadido exitosamente',
      draftOrder: data.draftOrderUpdate.draftOrder,
      recargoAmount: recargoAmount
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;