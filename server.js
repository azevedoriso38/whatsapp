const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const app = express();
const PORT = 3000;

// Cada usuário tem seu WhatsApp
const users = {};

// Página inicial
app.get('/', (req, res) => res.send(`
  <h1>📱 Zap Sender</h1>
  <form action="/connect" method="POST">
    <button>Conectar WhatsApp</button>
  </form>
`));

// Conectar WhatsApp
app.post('/connect', async (req, res) => {
  const userId = Date.now().toString();
  const client = new Client({ authStrategy: new LocalAuth({ clientId: userId }) });
  
  users[userId] = { client, qr: null, ready: false };
  
  client.on('qr', async (qr) => {
    users[userId].qr = qr;
  });
  
  client.on('ready', () => {
    users[userId].ready = true;
  });
  
  await client.initialize();
  
  res.send(`
    <h2>Escaneie o QR Code:</h2>
    <div id="qrcode"></div>
    <script>
      fetch('/qr/${userId}').then(r => r.text()).then(qr => {
        document.getElementById('qrcode').innerHTML = '<img src="' + qr + '">';
      });
    </script>
    <a href="/send/${userId}">Continuar</a>
  `);
});

// Mostrar QR Code
app.get('/qr/:userId', async (req, res) => {
  const qr = users[req.params.userId]?.qr;
  if (qr) {
    const qrImage = await qrcode.toDataURL(qr);
    res.send(qrImage);
  } else {
    res.send('Aguarde...');
  }
});

// Página para enviar mensagens
app.get('/send/:userId', (req, res) => {
  res.send(`
    <h2>📤 Enviar Mensagens</h2>
    <form action="/send/${req.params.userId}" method="POST">
      <textarea name="numbers" placeholder="Números: 5511999999999" rows="5" required></textarea><br>
      <textarea name="message" placeholder="Sua mensagem" rows="5" required></textarea><br>
      <button>Enviar para todos</button>
    </form>
  `);
});

// Enviar mensagens
app.post('/send/:userId', async (req, res) => {
  const user = users[req.params.userId];
  if (!user?.ready) return res.send('WhatsApp não conectado!');
  
  const numbers = req.body.numbers.split('\n').map(n => n.trim());
  const message = req.body.message;
  
  let results = '';
  for (const number of numbers) {
    try {
      await user.client.sendMessage(`${number}@c.us`, message);
      results += `✅ ${number}: Enviado<br>`;
    } catch (error) {
      results += `❌ ${number}: Erro<br>`;
    }
  }
  
  res.send(`<h3>Resultados:</h3>${results}<a href="/send/${req.params.userId}">Voltar</a>`);
});

app.listen(PORT, () => console.log(`Servidor rodando: http://localhost:${PORT}`));
