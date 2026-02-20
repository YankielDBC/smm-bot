require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuración
const TOKEN = process.env.TELEGRAM_TOKEN || '7912356435:AAEUsH26GBsk6-3gr34v3HFDB4N3pLVC3xo';
const SMM_API_KEY = 'dfab95cc8836ffae64fc6fe14b13174d';
const SMM_API_URL = 'https://smmstone.com/api/v2';

// Markup keyboard para categorías
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '✈️ Telegram', callback_data: 'cat_telegram' }],
      [{ text: '❓ Ayuda', callback_data: 'help' }]
    ]
  }
};

// Servicios por categoría (solo Telegram)
const services = {
  telegram: [
    { id: 4296, name: '👁️ Telegram Post Views', min: 100, max: 1000000, rate: 0.03 },
    { id: 4295, name: '👥 Telegram Channel Members', min: 100, max: 50000, rate: 0.45 }
  ]
};

// Carrito de compras en memoria (en producción usar DB)
const cart = new Map();

// Inicializar bot con polling
const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Bot iniciado correctamente');

// Mensaje de inicio
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '👋 *¡Bienvenido al SMM Bot!*\n\n' +
    'Compra views y miembros para tus canales de Telegram.\n\n' +
    'Selecciona un servicio:',
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// Manejar callbacks
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    // Solo Telegram
    if (data === 'cat_telegram') {
      showServices(chatId, 'telegram', '✈️ *Telegram* - Selecciona un servicio:');
    } else if (data === 'help') {
      showHelp(chatId);
    } else if (data === 'back_main') {
      bot.editMessageText(
        '👋 *¡Bienvenido al SMM Bot!*\n\nSelecciona un servicio:',
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', ...mainMenu }
      );
    } else if (data.startsWith('service_')) {
      const serviceId = parseInt(data.split('_')[1]);
      bot.editMessageText(
        `📝 *Nuevo Pedido*\n\n` +
        `Servicio ID: ${serviceId}\n\n` +
        `Por favor, envíame el enlace de tu perfil/video/post:`,
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
      );
      // Guardar selección para el siguiente mensaje
      bot.once('message', async (msg) => {
        if (msg.text && !msg.text.startsWith('/')) {
          const link = msg.text;
          bot.sendMessage(chatId, 
            `✅ *Enlace recibido:* ${link}\n\n` +
            `Ahora envíame la cantidad deseada:`,
            { parse_mode: 'Markdown' }
          );
          
          bot.once('message', async (msg2) => {
            if (msg2.text && !msg2.text.startsWith('/')) {
              const quantity = parseInt(msg2.text);
              if (isNaN(quantity)) {
                bot.sendMessage(chatId, '❌ Cantidad inválida. Intenta de nuevo.');
                return;
              }
              
              // Crear orden
              try {
                const order = await createOrder(serviceId, link, quantity);
                bot.sendMessage(chatId, 
                  `✅ *¡Pedido creado!*\n\n` +
                  `📋 ID de orden: ${order.order}\n` +
                  `🔗 Enlace: ${link}\n` +
                  `📊 Cantidad: ${quantity}\n` +
                  `💵 Estado: Pendiente\n\n` +
                  `Tu pedido será procesado pronto.`,
                  { parse_mode: 'Markdown' }
                );
              } catch (error) {
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
              }
            }
          });
        }
      });
    }
    
    // Confirmar callback
    bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '❌ Ocurrió un error. Intenta de nuevo.');
  }
});

// Funciones auxiliares
function showServices(chatId, category, title) {
  const serviceList = services[category];
  const keyboard = serviceList.map(s => [{
    text: `${s.name} - $${s.rate}`,
    callback_data: `service_${s.id}`
  }]);
  
  keyboard.push([{ text: '🔙 Volver', callback_data: 'back_main' }]);
  
  bot.sendMessage(chatId, title, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

function showHelp(chatId) {
  bot.sendMessage(chatId,
    '❓ *Ayuda*\n\n' +
    '1. Selecciona una categoría\n' +
    '2. Elige el servicio que necesitas\n' +
    '3. Envía el enlace de tu perfil/video\n' +
    '4. Indica la cantidad\n' +
    '5. Confirma el pago\n\n' +
    '💡 *Nota:* Los precios mostrados son en USD.',
    { parse_mode: 'Markdown' }
  );
}

async function createOrder(serviceId, link, quantity) {
  const response = await axios.post(SMM_API_URL, {
    key: SMM_API_KEY,
    action: 'add',
    service: serviceId,
    link: link,
    quantity: quantity
  });
  
  if (response.data.order) {
    return { order: response.data.order, status: 'pending' };
  } else {
    throw new Error(response.data.error || 'Error desconocido');
  }
}

// Verificar balance
async function getBalance() {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: SMM_API_KEY,
      action: 'balance'
    });
    return response.data.balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    return null;
  }
}

// Check de salud cada 30 segundos
setInterval(async () => {
  const balance = await getBalance();
  if (balance !== null) {
    console.log(`💰 Balance actual: $${balance}`);
  }
}, 30000);
