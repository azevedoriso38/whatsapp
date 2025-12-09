const express = require('express');
const session = require('express-session');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const app = express();

// ================= CONFIGURAÇÃO =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'zap-sender-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// ================= ARMAZENAMENTO =================
const whatsappClients = new Map(); // {userId: {client, ready, qrImage}}

// ================= ROTAS =================

// 1. PÁGINA INICIAL
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp AutoSender</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        h1 { color: #25D366; font-size: 2.5em; margin-bottom: 10px; }
        .btn { background: #25D366; color: white; border: none; padding: 15px 40px; font-size: 18px; border-radius: 8px; cursor: pointer; margin: 20px 0; text-decoration: none; display: inline-block; }
        .btn:hover { background: #128C7E; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
      </style>
    </head>
    <body>
      <h1>📱 WhatsApp AutoSender</h1>
      <p>Sistema de envio automático de mensagens</p>
      <div class="info">
        <h3>✅ Como funciona:</h3>
        <p>1. Conecte seu WhatsApp (escaneie QR Code)</p>
        <p>2. Cole sua lista de contatos</p>
        <p>3. Digite a mensagem</p>
        <p>4. Envie para todos automaticamente!</p>
      </div>
      <form action="/connect" method="POST">
        <button type="submit" class="btn">🔗 Conectar Meu WhatsApp</button>
      </form>
      <p><small>Cada usuário conecta seu próprio WhatsApp</small></p>
    </body>
    </html>
  `);
});

// 2. CONECTAR WHATSAPP
app.post('/connect', async (req, res) => {
  try {
    const userId = Date.now().toString();
    req.session.userId = userId;

    console.log(`📱 Novo usuário: ${userId}`);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    whatsappClients.set(userId, { client: client, ready: false, qrImage: null });

    client.on('qr', async (qr) => {
      console.log(`📸 QR gerado para ${userId}`);
      try {
        const qrImage = await qrcode.toDataURL(qr);
        whatsappClients.get(userId).qrImage = qrImage;
      } catch (err) {
        console.log('Erro ao gerar QR:', err);
      }
    });

    client.on('ready', () => {
      console.log(`✅ WhatsApp conectado: ${userId}`);
      whatsappClients.get(userId).ready = true;
    });

    client.on('auth_failure', (msg) => {
      console.log(`❌ Falha na autenticação ${userId}:`, msg);
      whatsappClients.delete(userId);
    });

    client.on('disconnected', (reason) => {
      console.log(`🔌 WhatsApp desconectado ${userId}:`, reason);
      whatsappClients.delete(userId);
    });

    await client.initialize();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectar WhatsApp</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; max-width: 500px; margin: 30px auto; padding: 20px; text-align: center; }
          .qrcode-container { margin: 20px 0; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .instructions { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .status { padding: 10px; border-radius: 5px; margin: 10px 0; font-weight: bold; }
          .waiting { background: #fff3cd; color: #856404; }
          .connected { background: #d4edda; color: #155724; }
        </style>
      </head>
      <body>
        <h2>📱 Conectar WhatsApp</h2>
        <div class="status waiting" id="status">⏳ Aguardando QR Code...</div>
        <div class="qrcode-container"><div id="qrcode"><p>Gerando código QR...</p></div></div>
        <div class="instructions">
          <h3>📝 Como conectar:</h3>
          <p>1. Abra o WhatsApp no seu celular</p>
          <p>2. Toque em <strong>⋮ (Android)</strong> ou <strong>Configurações (iPhone)</strong></p>
          <p>3. Selecione <strong>"Dispositivos conectados"</strong></p>
          <p>4. Toque em <strong>"Conectar um dispositivo"</strong></p>
          <p>5. Escaneie o código acima com a câmera</p>
        </div>
        <p><a href="/">« Voltar</a></p>
        <script>
          const userId = '${userId}';
          async function updateQR() {
            try {
              const qrResponse = await fetch('/api/qr?userId=' + userId);
              const qrData = await qrResponse.text();
              if (qrData && qrData !== 'wait') {
                document.getElementById('qrcode').innerHTML = '<img src="' + qrData + '" style="max-width: 300px;">';
                document.getElementById('status').innerHTML = '📸 QR Code gerado! Escaneie agora';
                document.getElementById('status').className = 'status waiting';
              }
              const connResponse = await fetch('/api/check?userId=' + userId);
              const connData = await connResponse.json();
              if (connData.connected) {
                document.getElementById('status').innerHTML = '✅ WhatsApp conectado! Redirecionando...';
                document.getElementById('status').className = 'status connected';
                setTimeout(() => { window.location.href = '/sender'; }, 1500);
                return;
              }
              setTimeout(updateQR, 2000);
            } catch (error) { console.error('Erro:', error); setTimeout(updateQR, 3000); }
          }
          updateQR();
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Erro ao conectar:', error);
    res.send(`<h2>❌ Erro ao conectar</h2><p>${error.message}</p><p><a href="/">« Voltar e tentar novamente</a></p>`);
  }
});

// 3. API: OBTER QR CODE
app.get('/api/qr', (req, res) => {
  const userId = req.query.userId;
  const user = whatsappClients.get(userId);
  res.send(user?.qrImage || 'wait');
});

// 4. API: VERIFICAR CONEXÃO
app.get('/api/check', (req, res) => {
  const userId = req.query.userId;
  const user = whatsappClients.get(userId);
  res.json({ connected: user ? user.ready : false, userId: userId });
});

// 5. PÁGINA DE ENVIO (igual ao seu original)
// ... (mantém o HTML do `/sender` sem alterações, pois não tinha erro)

// 6. API: ENVIAR MENSAGEM INDIVIDUAL
app.post('/api/send', async (req, res) => {
  try {
    const { userId, number, message } = req.body;
    if (!userId || !number || !message) return res.json({ success: false, error: 'Dados incompletos' });

    const user = whatsappClients.get(userId);
    if (!user || !user.ready) return res.json({ success: false, error: 'WhatsApp não conectado' });

    // Formata número
    const formattedNumber = number.replace(/\D/g, '');
    if (formattedNumber.length < 10) return res.json({ success: false, error: 'Número inválido' });

    // ================= LINHA CORRIGIDA =================
    await user.client.sendMessage(`${formattedNumber}@c.us`, message);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar:', error);
    res.json({ success: false, error: error.message || 'Erro desconhecido' });
  }
});

// 7. API: DESCONECTAR
app.get('/api/disconnect', (req, res) => {
  const userId = req.query.userId;
  if (userId && whatsappClients.has(userId)) {
    const user = whatsappClients.get(userId);
    user.client.destroy();
    whatsappClients.delete(userId);
    console.log(`🔌 Usuário desconectado: ${userId}`);
  }
  res.json({ success: true });
});

// 8. ROTA DE SAÚDE
app.get('/health', (req, res) => {
  res.json({ status: 'online', clients: whatsappClients.size, timestamp: new Date().toISOString() });
});

// 9. ROTA 404
app.use((req, res) => {
  res.status(404).send(`<h2>🔍 Página não encontrada</h2><p>A URL <strong>${req.url}</strong> não existe.</p><p><a href="/">« Voltar para a página inicial</a></p>`);
});

// ================= INICIAR SERVIDOR =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando: http://localhost:${PORT}`);
  console.log(`📱 WhatsApp AutoSender pronto!`);
  console.log(`👥 Clientes conectados: 0`);
});
