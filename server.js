/* =========================================================
   BERLIN // TRANSMISSION — backend server
   Express + MongoDB. Replaces every localStorage-based method
   in the frontend's `API` object (see script.js) with a real,
   shared, persistent endpoint.
   ========================================================= */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'saba2011@';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable. Set it in Render → Environment.');
  process.exit(1);
}

// إعداد الـ CORS بشكل آمن ومفتوح لجميع المسارات والطلبات
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-password']
}));
app.use(express.json({ limit: '15mb' })); // 15mb: chat/reconcile avatars & room photos are base64 images

/* ---------------------------------------------------------
   Mongo connection
   --------------------------------------------------------- */
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

/* Generic flexible schema — every document already carries its own
   client-generated "id" field (from genId() in script.js), so we don't
   need to design strict per-collection schemas. */
const flexible = new mongoose.Schema({}, { strict: false, minimize: false });

const Delivery       = mongoose.model('Delivery', flexible, 'deliveries');
const InboxMessage     = mongoose.model('InboxMessage', flexible, 'inbox_messages');
const Confession       = mongoose.model('Confession', flexible, 'confessions');
const ChatMessage      = mongoose.model('ChatMessage', flexible, 'chat_messages');
const ChatName         = mongoose.model('ChatName', flexible, 'chat_names');
const Poem             = mongoose.model('Poem', flexible, 'poems');
const DinoScore        = mongoose.model('DinoScore', flexible, 'dino_scores');
const ReconcileRoom    = mongoose.model('ReconcileRoom', flexible, 'reconcile_rooms');
const ReconcileMessage = mongoose.model('ReconcileMessage', flexible, 'reconcile_messages');

/* ---------------------------------------------------------
   Admin guard — protects the endpoints that back the admin
   dashboard (deliveries, inbox, and every delete route).
   The frontend must send the password it collected at login
   in the "x-admin-password" header.
   --------------------------------------------------------- */
function requireAdmin(req, res, next) {
  const supplied = req.header('x-admin-password');
  if (supplied !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

/* Strip Mongo's internal fields before sending documents back,
   so the shape matches exactly what the frontend already expects. */
function clean(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj._id;
  delete obj.__v;
  return obj;
}
function cleanAll(docs) { return docs.map(clean); }

app.get('/', (req, res) => res.send('BERLIN // TRANSMISSION API is running successfully.'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ---------------------------------------------------------
   DELIVERIES  (admin-only read, matches API.saveDelivery / API.getDeliveries)
   --------------------------------------------------------- */
app.post('/api/deliveries', async (req, res) => {
  await Delivery.create(req.body);
  res.json({ ok: true });
});
app.get('/api/deliveries', requireAdmin, async (req, res) => {
  res.json(cleanAll(await Delivery.find().sort({ _id: 1 })));
});

/* ---------------------------------------------------------
   INBOX ("MESSAGE ME ANONYMOUSLY") — admin-only read
   --------------------------------------------------------- */
app.post('/api/inbox', async (req, res) => {
  await InboxMessage.create(req.body);
  res.json({ ok: true });
});
app.get('/api/inbox', requireAdmin, async (req, res) => {
  res.json(cleanAll(await InboxMessage.find().sort({ _id: 1 })));
});

/* ---------------------------------------------------------
   CONFESSIONS — public read/write, admin-only delete
   --------------------------------------------------------- */
app.get('/api/confessions', async (req, res) => {
  res.json(cleanAll(await Confession.find().sort({ _id: 1 })));
});
app.post('/api/confessions', async (req, res) => {
  await Confession.create(req.body);
  res.json({ ok: true });
});
app.post('/api/confessions/delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  await Confession.deleteMany({ id: { $in: ids } });
  res.json(cleanAll(await Confession.find().sort({ _id: 1 })));
});

/* ---------------------------------------------------------
   CHAT — public join / messages, admin-only delete
   --------------------------------------------------------- */
app.get('/api/chat/name-check', async (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  const exists = await ChatName.exists({ name });
  // نعيد النتيجة كـ JSON واضح لتجنب أي مشاكل في الفحص بالـ Frontend
  res.json({ taken: !!exists });
});
app.post('/api/chat/name-register', async (req, res) => {
  await ChatName.create({ name: (req.body.name || '').toLowerCase() });
  res.json({ ok: true });
});
app.get('/api/chat/messages', async (req, res) => {
  res.json(cleanAll(await ChatMessage.find().sort({ _id: 1 })));
});
app.post('/api/chat/messages', async (req, res) => {
  await ChatMessage.create(req.body);
  res.json({ ok: true });
});
app.post('/api/chat/messages/delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  await ChatMessage.deleteMany({ id: { $in: ids } });
  res.json(cleanAll(await ChatMessage.find().sort({ _id: 1 })));
});

/* ---------------------------------------------------------
   DINO LEADERBOARD — fully public
   --------------------------------------------------------- */
app.get('/api/dino/leaderboard', async (req, res) => {
  const board = await DinoScore.find().sort({ score: -1 });
  res.json(cleanAll(board));
});
app.get('/api/dino/name-check', async (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  const exists = await DinoScore.exists({ name: new RegExp(`^${name}$`, 'i') });
  res.json({ taken: !!exists });
});
app.post('/api/dino/score', async (req, res) => {
  const { name, score } = req.body;
  const existing = await DinoScore.findOne({ name: new RegExp(`^${name}$`, 'i') });
  if (existing) {
    existing.score = Math.max(existing.score, score);
    await existing.save();
  } else {
    await DinoScore.create({ name, score });
  }
  const board = await DinoScore.find().sort({ score: -1 });
  res.json(cleanAll(board));
});

/* ---------------------------------------------------------
   POEMS — public read/write, admin-only delete
   --------------------------------------------------------- */
app.get('/api/poems', async (req, res) => {
  res.json(cleanAll(await Poem.find().sort({ _id: 1 })));
});
app.post('/api/poems', async (req, res) => {
  await Poem.create(req.body);
  res.json({ ok: true });
});
app.post('/api/poems/delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  await Poem.deleteMany({ id: { $in: ids } });
  res.json(cleanAll(await Poem.find().sort({ _id: 1 })));
});

/* ---------------------------------------------------------
   RECONCILE ROOMS ("LET'S MAKE UP") — public
   --------------------------------------------------------- */
app.get('/api/reconcile/rooms', async (req, res) => {
  const rooms = await ReconcileRoom.find().sort({ createdAt: -1 });
  res.json(cleanAll(rooms));
});
app.post('/api/reconcile/rooms', async (req, res) => {
  await ReconcileRoom.create(req.body);
  res.json({ ok: true });
});
app.get('/api/reconcile/rooms/:id', async (req, res) => {
  const room = await ReconcileRoom.findOne({ id: req.params.id });
  res.json(room ? clean(room) : null);
});
app.get('/api/reconcile/rooms/:roomId/messages', async (req, res) => {
  const list = await ReconcileMessage.find({ roomId: req.params.roomId }).sort({ _id: 1 });
  res.json(cleanAll(list));
});
app.post('/api/reconcile/rooms/:roomId/messages', async (req, res) => {
  await ReconcileMessage.create({ ...req.body, roomId: req.params.roomId });
  res.json({ ok: true });
});

/* ---------------------------------------------------------
   ADMIN LOGIN CHECK — lets the frontend verify the password
   server-side instead of hard-coding it in script.js.
   --------------------------------------------------------- */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.listen(PORT, () => console.log(`BERLIN // TRANSMISSION API listening on port ${PORT}`));
