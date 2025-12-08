const express = require('express');
const session = require('express-session');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const app = express();

// SESSÕES (OBRIGATÓRIO!)
app.use(session({
  secret: 'whatsapp-auto-sender',
  resave: false,
  saveUninitialized: true
}));

// ARMAZENA OS CLIENTES
const clients = {};

// PÁGINA INICIAL
app.get('/', (req, res) => res.send(`
  <h1>📱 WhatsApp AutoSender</h1>
  <form action="/connect" method="POST">
    <button>🔗 Conectar Meu WhatsApp</button>
  </form>
`));

// CONECTAR
app.post('/connect', async (req, res) => {
  const userId = Date.now().toString();
  req.session.userId = userId;
  
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { headless: true }
  });
  
  clients[userId] = { client, ready: false };
  
  client.on('qr', async (qr) => {
    try {
      const qrImage = await qrcode.toDataURL(qr);
      clients[userId].qrImage = qrImage;
    } catch (err) {
      console.log('Erro QR:', err);
    }
  });
  
  client.on('ready', () => {
    console.log('✅ PRONTO!');
    clients[userId].ready = true;
  });
  
  client.on('auth_failure', () => {
    console.log('❌ FALHA');
  });
  
  await client.initialize();
  
  res.send(`
    <h2>📱 Conectar WhatsApp</h2>
    <div id="qrcode">Gerando QR Code...</div>
    <p>1. Abra WhatsApp > ⋮ > Dispositivos conectados<br>
    2. Toque em "Conectar um dispositivo"<br>
    3. Escaneie o código acima</p>
    
    <script>
      // Busca QR Code a cada segundo
      function buscarQR() {
        fetch('/get-qr/${userId}')
          .then(r => r.text())
          .then(qr => {
            if (qr && qr !== 'wait') {
              document.getElementById('qrcode').innerHTML = '<img src="' + qr + '" style="width: 300px">';
            }
            
            // Verifica se já conectou
            fetch('/check-ready/${userId}')
              .then(r => r.json())
              .then(data => {
                if (data.ready) {
                  window.location.href = '/sender';
                }
              });
          });
      }
      
      setInterval(buscarQR, 1000);
      buscarQR();
    </script>
  `);
});

// RETORNA QR CODE
app.get('/get-qr/:userId', (req, res) => {
  const user = clients[req.params.userId];
  res.send(user?.qrImage || 'wait');
});

// VERIFICA SE CONECTOU
app.get('/check-ready/:userId', (req, res) => {
  const user = clients[req.params.userId];
  res.json({ ready: user ? user.ready : false });
});

// PÁGINA DE ENVIO
app.get('/sender', (req, res) => {
  const userId = req.session.userId;
  const user = clients[userId];
  
  if (!user || !user.ready) {
    return res.redirect('/');
  }
  
  res.send(`
    <h2>✅ WhatsApp Conectado!</h2>
    <form action="/send-message" method="POST">
      <h3>📋 Contatos (um por linha):</h3>
      <textarea name="numbers" rows="5" placeholder="5511999999999
5511888888888" required></textarea>
      
      <h3>💬 Mensagem:</h3>
      <textarea name="message" rows="5" required></textarea>
      
      <br><br>
      <button>📤 Enviar para todos</button>
    </form>
  `);
});

// ENVIAR MENSAGENS
app.post('/send-message', async (req, res) => {
  const userId = req.session.userId;
  const user = clients[userId];
  
  if (!user || !user.ready) {
    return res.send('❌ WhatsApp não conectado! <a href="/">Voltar</a>');
  }
  
  const numbers = req.body.numbers.split('\n')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(n => n.length >= 10);
    
  const message = req.body.message;
  
  let html = '<h2>📊 Resultados:</h2>';
  
  for (const number of numbers) {
    try {
      await user.client.sendMessage(`${number}@c.us`, message);
      html += `<div style="color: green;">✅ ${number}: Enviado</div>`;
    } catch (err) {
      html += `<div style="color: red;">❌ ${number}: Erro - ${err.message}</div>`;
    }
  }
  
  html += '<br><a href="/sender">⬅️ Voltar</a>';
  res.send(html);
});

app.listen(3000, () => console.log('✅ Servidor rodando: http://localhost:3000'));
