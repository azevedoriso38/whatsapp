const express = require('express');
const { Client } = require('whatsapp-web.js');
const app = express();

// Cada usuário conecta seu WhatsApp
const userClients = new Map();

app.post('/api/connect', (req, res) => {
  const userId = req.session.userId;
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { headless: true }
  });
  
  client.on('qr', (qr) => {
    // Envia QR code para frontend
  });
  
  client.on('ready', () => {
    // WhatsApp conectado
  });
  
  client.initialize();
});

app.post('/api/send', async (req, res) => {
  // Recebe: lista de contatos, mensagem, mídia(opcional)
  // Envia mensagem para cada contato
  // Retorna progresso
});
