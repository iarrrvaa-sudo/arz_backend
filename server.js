const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let senders = [];
let clients = {};
let pairingCodes = {};

async function initClient(phone) {
    if (clients[phone]) return clients[phone];
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${phone}`);
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(`✅ WhatsApp ${phone} CONNECTED!`);
            const idx = senders.findIndex(s => s.phone === phone);
            if (idx !== -1) senders[idx].status = 'connected';
            delete pairingCodes[phone];
        }
        if (connection === 'close') {
            console.log(`❌ WhatsApp ${phone} DISCONNECTED`);
            const idx = senders.findIndex(s => s.phone === phone);
            if (idx !== -1) senders[idx].status = 'disconnected';
            delete clients[phone];
        }
    });
    try {
        const code = await sock.requestPairingCode(phone);
        console.log(`📲 Pairing code untuk ${phone}: ${code}`);
        pairingCodes[phone] = code;
    } catch (err) {
        console.error(`Gagal minta pairing code untuk ${phone}:`, err.message);
    }
    clients[phone] = sock;
    return sock;
}

app.get('/', (req, res) => {
    res.json({ name: 'ARZ ZERO Backend', status: 'online' });
});

app.get('/api/senders', (req, res) => {
    res.json(senders);
});

app.post('/api/senders', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    if (senders.find(s => s.phone === phone)) {
        return res.status(400).json({ error: 'Sender already exists' });
    }
    const newSender = { id: Date.now(), phone, status: 'pending' };
    senders.push(newSender);
    try {
        await initClient(phone);
        let code = null;
        for (let i = 0; i < 10; i++) {
            if (pairingCodes[phone]) {
                code = pairingCodes[phone];
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        res.status(201).json({ ...newSender, pairingCode: code });
    } catch (err) {
        res.status(500).json({ error: 'Failed to init', detail: err.message });
    }
});

app.post('/api/senders/refresh/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const sender = senders.find(s => s.id === id);
    if (!sender) return res.status(404).json({ error: 'Sender not found' });
    sender.status = 'connected';
    res.json(sender);
});

app.delete('/api/senders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = senders.findIndex(s => s.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const deleted = senders[index];
    if (clients[deleted.phone]) {
        clients[deleted.phone].end();
        delete clients[deleted.phone];
    }
    delete pairingCodes[deleted.phone];
    senders.splice(index, 1);
    res.json({ message: 'Deleted', deleted });
});

app.post('/api/send', async (req, res) => {
    const { phone, target, message, count } = req.body;
    if (!phone || !target || !message) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    const sock = clients[phone];
    if (!sock) {
        return res.status(404).json({ error: `Client ${phone} not found` });
    }
    const jumlah = count || 5;
    const jid = target.includes('@') ? target : target + '@s.whatsapp.net';
    try {
        for (let i = 0; i < jumlah; i++) {
            await sock.sendMessage(jid, { text: message + ` [${i+1}]` });
            console.log(`📨 Sent ${i+1} to ${target}`);
        }
        res.json({ success: true, sent: jumlah, to: target });
    } catch (err) {
        res.status(500).json({ error: 'Send failed', detail: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 ARZ ZERO Backend running on port ${port}`);
});
