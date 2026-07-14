/* =========================================================
   BERLIN // TRANSMISSION — script.js
   Handles: enter transition, screen navigation, hover sound,
   glow interactions, WHO IS BERLIN slow-motion text reveal,
   and full multi-language switching (see translations.js).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const zoomLayer   = document.getElementById('zoomLayer');
  const enterBtn    = document.getElementById('enterBtn');
  const hoverSound  = document.getElementById('hoverSound');

  /* =========================================================
     BACKEND ADDRESS
     Every network call in this file goes through the API object
     below, and every one of those calls is built from this single
     constant. After you deploy the server, replace the placeholder
     with your real Render URL — something like:
     https://berlin-transmission-api.onrender.com
     Do NOT add a trailing slash.
     ========================================================= */
  const API_BASE = 'https://YOUR-RENDER-APP-NAME.onrender.com';

  /* Set once the admin logs in successfully (see ADMIN LOCK below).
     Sent as a header on every admin-only request so the server can
     verify it — the real check now happens server-side, not here. */
  let adminAuthPassword = null;

  /* Shared unique-id helper — used for confessions/poems/chat messages/
     reconcile rooms, anywhere we need something stable to select or
     reply to later. */
  function genId(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* =========================================================
     LANGUAGE SYSTEM
     ========================================================= */
  const STORAGE_KEY = 'berlin_lang';
  const DEFAULT_LANG = 'en';

  const langGearBtn = document.getElementById('langGearBtn');
  const langPanel    = document.getElementById('langPanel');
  const langOptions  = document.querySelectorAll('.lang-option');

  function getSavedLang(){
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveLang(lang){
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* no-op */ }
  }

  function applyLanguage(lang){
    const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];

    // html lang + direction (RTL for Arabic and any future RTL language)
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dict.dir || 'ltr');

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // Active state on language options
    langOptions.forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
    });

    saveLang(lang);
  }

  function detectInitialLang(){
    const saved = getSavedLang();
    if (saved && TRANSLATIONS[saved]) return saved;

    const browserLang = (navigator.language || DEFAULT_LANG).slice(0, 2).toLowerCase();
    if (TRANSLATIONS[browserLang]) return browserLang;

    return DEFAULT_LANG;
  }

  applyLanguage(detectInitialLang());

  // Toggle language panel
  function closeLangPanel(){
    langPanel.classList.remove('open');
    langGearBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleLangPanel(e){
    e.stopPropagation();
    const isOpen = langPanel.classList.toggle('open');
    langGearBtn.setAttribute('aria-expanded', String(isOpen));
  }
  langGearBtn.addEventListener('click', toggleLangPanel);

  langOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      applyLanguage(opt.getAttribute('data-lang'));
      closeLangPanel();
      // the notif button's ON/OFF text is set dynamically (not via data-i18n
      // alone, since it depends on live permission state), so refresh it here
      if (typeof renderNotifBtn === 'function') renderNotifBtn();
    });
  });

  // Close panel when clicking outside of it
  document.addEventListener('click', (e) => {
    if (!langPanel.contains(e.target) && e.target !== langGearBtn) {
      closeLangPanel();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLangPanel();
  });

  /* =========================================================
     ADMIN LOCK — password gate to a private dashboard showing
     everything submitted through "DELIVER A MESSAGE" and
     "MESSAGE ME ANONYMOUSLY". Client-side only for now (matches
     the rest of the site, which currently runs on localStorage) —
     once a real backend exists this check should move server-side.
     ========================================================= */
  const adminLockBtn    = document.getElementById('adminLockBtn');
  const adminLoginPanel = document.getElementById('adminLoginPanel');
  const adminLoginForm  = document.getElementById('adminLoginForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginError = document.getElementById('adminLoginError');

  function closeAdminPanel(){
    adminLoginPanel.classList.remove('open');
    adminLockBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleAdminPanel(e){
    e.stopPropagation();
    closeLangPanel();
    const isOpen = adminLoginPanel.classList.toggle('open');
    adminLockBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      adminLoginError.textContent = '';
      adminPasswordInput.value = '';
      setTimeout(() => adminPasswordInput.focus(), 50);
    }
  }
  if (adminLockBtn) {
    adminLockBtn.addEventListener('click', toggleAdminPanel);
  }
  // Reopening the language panel should close the admin panel and vice versa
  langGearBtn.addEventListener('click', closeAdminPanel);
  document.addEventListener('click', (e) => {
    if (!adminLoginPanel.contains(e.target) && e.target !== adminLockBtn && !adminLockBtn.contains(e.target)) {
      closeAdminPanel();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAdminPanel();
  });

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const typed = adminPasswordInput.value;
      const ok = await API.checkAdminPassword(typed);
      if (ok) {
        adminAuthPassword = typed; // reused as the x-admin-password header on admin-only calls
        closeAdminPanel();
        adminLockBtn.classList.add('unlocked');
        goToScreen('page-admin');
        renderAdminInbox();
        renderAdminDeliveries();
        renderAdminConfess();
        renderAdminChat();
        renderAdminPoems();
      } else {
        adminLoginError.textContent = 'WRONG PASSWORD';
        adminPasswordInput.value = '';
        adminPasswordInput.focus();
      }
    });
  }

  const adminTabs       = document.querySelectorAll('.admin-tab');
  const adminInboxView  = document.getElementById('adminInboxView');
  const adminDeliverView= document.getElementById('adminDeliverView');
  const adminConfessView= document.getElementById('adminConfessView');
  const adminChatView   = document.getElementById('adminChatView');
  const adminPoemsView  = document.getElementById('adminPoemsView');
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      adminTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.getAttribute('data-admin-tab');
      adminInboxView.classList.toggle('active', which === 'inbox');
      adminDeliverView.classList.toggle('active', which === 'deliver');
      adminConfessView.classList.toggle('active', which === 'confess');
      adminChatView.classList.toggle('active', which === 'chat');
      adminPoemsView.classList.toggle('active', which === 'poems');
    });
  });

  /* ---- Admin moderation: CONFESSION CHAT + POEMS
     Both render a checkbox next to every entry; the admin ticks the
     ones to remove and hits "DELETE SELECTED" — this is the "select
     first, then delete" flow that was asked for, rather than a
     delete-on-every-row button that's easy to hit by accident. ---- */
  async function renderAdminChat(){
    const list = document.getElementById('adminChatList');
    if (!list) return;
    const entries = await API.getChatMessages();
    if (!entries.length) {
      list.innerHTML = '<p class="hint-text">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(entry => {
      const card = document.createElement('label');
      card.className = 'admin-card admin-card-selectable';
      card.innerHTML = `
        <input type="checkbox" class="admin-select-box" value="${entry.id}">
        <span class="admin-card-body">
          <span class="admin-card-meta"><span></span></span>
          <span class="admin-card-text"></span>
          <time></time>
        </span>`;
      card.querySelector('.admin-card-meta span').textContent = entry.name || 'ANONYMOUS';
      card.querySelector('.admin-card-text').textContent = entry.text;
      card.querySelector('time').textContent = new Date(entry.timestamp).toLocaleString();
      list.appendChild(card);
    });
  }

  async function renderAdminPoems(){
    const list = document.getElementById('adminPoemsList');
    if (!list) return;
    const entries = await API.getPoems();
    if (!entries.length) {
      list.innerHTML = '<p class="hint-text">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(entry => {
      const card = document.createElement('label');
      card.className = 'admin-card admin-card-selectable';
      card.innerHTML = `
        <input type="checkbox" class="admin-select-box" value="${entry.id}">
        <span class="admin-card-body">
          <span class="admin-card-meta"><span></span></span>
          <span class="admin-card-text"></span>
          <time></time>
        </span>`;
      card.querySelector('.admin-card-meta span').textContent = entry.author || 'ANONYMOUS';
      card.querySelector('.admin-card-text').textContent = entry.text;
      card.querySelector('time').textContent = new Date(entry.timestamp).toLocaleString();
      list.appendChild(card);
    });
  }

  /* ---- Admin moderation: CONFESSIONS (anonymous, so only the text/time show) ---- */
  async function renderAdminConfess(){
    const list = document.getElementById('adminConfessList');
    if (!list) return;
    const entries = await API.getConfessions();
    if (!entries.length) {
      list.innerHTML = '<p class="hint-text">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(entry => {
      const card = document.createElement('label');
      card.className = 'admin-card admin-card-selectable';
      card.innerHTML = `
        <input type="checkbox" class="admin-select-box" value="${entry.id}">
        <span class="admin-card-body">
          <span class="admin-card-meta"><span>ANONYMOUS</span></span>
          <span class="admin-card-text"></span>
          <time></time>
        </span>`;
      card.querySelector('.admin-card-text').textContent = entry.text;
      card.querySelector('time').textContent = new Date(entry.timestamp).toLocaleString();
      list.appendChild(card);
    });
  }

  const adminConfessDeleteBtn = document.getElementById('adminConfessDeleteBtn');
  const adminChatDeleteBtn  = document.getElementById('adminChatDeleteBtn');
  const adminPoemsDeleteBtn = document.getElementById('adminPoemsDeleteBtn');

  if (adminConfessDeleteBtn) {
    adminConfessDeleteBtn.addEventListener('click', async () => {
      const dict = currentDict();
      const ids = [...document.querySelectorAll('#adminConfessList .admin-select-box:checked')].map(b => b.value);
      if (!ids.length) { alert(dict.adminNoneSelected || 'Select at least one message.'); return; }
      await API.deleteConfessions(ids);
      renderAdminConfess();
      renderConfessions();
    });
  }
  if (adminChatDeleteBtn) {
    adminChatDeleteBtn.addEventListener('click', async () => {
      const dict = currentDict();
      const ids = [...document.querySelectorAll('#adminChatList .admin-select-box:checked')].map(b => b.value);
      if (!ids.length) { alert(dict.adminNoneSelected || 'Select at least one message.'); return; }
      await API.deleteChatMessages(ids);
      renderAdminChat();
      if (myChatName) pollChat();
    });
  }
  if (adminPoemsDeleteBtn) {
    adminPoemsDeleteBtn.addEventListener('click', async () => {
      const dict = currentDict();
      const ids = [...document.querySelectorAll('#adminPoemsList .admin-select-box:checked')].map(b => b.value);
      if (!ids.length) { alert(dict.adminNoneSelected || 'Select at least one message.'); return; }
      await API.deletePoems(ids);
      renderAdminPoems();
      renderPoems();
    });
  }

  const PLATFORM_LABELS = {
    instagram: 'Instagram', snapchat: 'Snapchat',
    twitter: 'Twitter / X', whatsapp: 'WhatsApp'
  };

  async function renderAdminInbox(){
    const list = document.getElementById('adminInboxList');
    if (!list) return;
    const entries = await API.getInboxMessages();
    if (!entries.length) {
      list.innerHTML = '<p class="hint-text">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(entry => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <div class="admin-card-meta"><span>ANONYMOUS</span></div>
        <div class="admin-card-text"></div>
        <time></time>`;
      card.querySelector('.admin-card-text').textContent = entry.text;
      card.querySelector('time').textContent = new Date(entry.timestamp).toLocaleString();
      list.appendChild(card);
    });
  }

  async function renderAdminDeliveries(){
    const list = document.getElementById('adminDeliverList');
    if (!list) return;
    const entries = await API.getDeliveries();
    if (!entries.length) {
      list.innerHTML = '<p class="hint-text">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(entry => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const platformLabel = PLATFORM_LABELS[entry.platform] || entry.platform;
      card.innerHTML = `
        <div class="admin-card-meta"><span></span><span></span></div>
        <div class="admin-card-text"></div>
        <time></time>`;
      const metaSpans = card.querySelectorAll('.admin-card-meta span');
      metaSpans[0].textContent = platformLabel;
      metaSpans[1].textContent = '@' + entry.username;
      card.querySelector('.admin-card-text').textContent = entry.message;
      card.querySelector('time').textContent = new Date(entry.timestamp).toLocaleString();
      list.appendChild(card);
    });
  }

  /* =========================================================
     HOVER SOUND
     ========================================================= */
  function playHoverSound(){
    if (!hoverSound) return;
    try {
      hoverSound.currentTime = 0;
      hoverSound.volume = 0.35;
      hoverSound.play().catch(() => { /* autoplay restrictions before first interaction */ });
    } catch (e) { /* no-op */ }
  }

  document.querySelectorAll('.menu-item, .home-btn, .glass-btn, .gear-btn, .lang-option').forEach(el => {
    el.addEventListener('mouseenter', playHoverSound);
    el.addEventListener('focus', playHoverSound);
  });

  /* =========================================================
     SCREEN NAVIGATION (zoom transition, no white flicker)
     ========================================================= */
  function goToScreen(targetId) {
    const current = document.querySelector('.screen.active');
    const target  = document.getElementById(targetId);
    if (!target || current === target) return;

    zoomLayer.classList.remove('burst');
    void zoomLayer.offsetWidth; // restart animation
    zoomLayer.classList.add('burst');

    current.classList.add('zoom-in');

    setTimeout(() => {
      current.classList.remove('active', 'zoom-in');

      target.classList.add('active', 'zoom-reveal');
      const vid = target.querySelector('video');
      if (vid) { vid.play().catch(() => {}); }

      if (targetId === 'page-who') {
        playWhoIsBerlin();
      }

      if (targetId === 'page-rooms' && typeof renderRoomsList === 'function') {
        renderRoomsList();
      }

      setTimeout(() => target.classList.remove('zoom-reveal'), 950);
    }, 420);
  }

  enterBtn.addEventListener('click', () => goToScreen('mainScreen'));

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      goToScreen(item.getAttribute('data-target'));
    });
  });

  document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetWhoIsBerlin();
      goToScreen('mainScreen');
    });
  });

  /* =========================================================
     WHO IS BERLIN — slow motion text reveal
     ========================================================= */
  function playWhoIsBerlin(){
    const lines = document.querySelectorAll('#whoLines .who-line');
    lines.forEach((line, i) => {
      line.classList.remove('reveal');
      void line.offsetWidth;
      setTimeout(() => {
        line.classList.add('reveal');
      }, i * 1400 + 200);
    });
  }
  function resetWhoIsBerlin(){
    document.querySelectorAll('#whoLines .who-line').forEach(line => {
      line.classList.remove('reveal');
    });
  }

  /* =========================================================
     FREE WEBSITE REQUEST — form confirmation
     ========================================================= */
  const requestForm = document.getElementById('requestForm');
  const requestConfirm = document.getElementById('requestConfirm');
  if (requestForm) {
    requestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const lang = document.documentElement.getAttribute('lang') || DEFAULT_LANG;
      const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
      requestConfirm.textContent = dict.requestConfirm;
      requestForm.reset();
    });
  }

  function currentDict(){
    const lang = document.documentElement.getAttribute('lang') || DEFAULT_LANG;
    return TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
  }

  /* =========================================================
     BACKEND STUBS
     Every feature below is written against a tiny "API" object.
     Right now it falls back to localStorage so everything is
     testable before a real server exists. Once you have a
     backend, just replace the body of each method below with a
     real fetch() call to your endpoint — nothing else in this
     file has to change.
     ========================================================= */
  /* Small fetch wrapper: JSON in, JSON out, admin header attached when needed. */
  async function apiCall(path, { method = 'GET', body, admin = false } = {}){
    const headers = { 'Content-Type': 'application/json' };
    if (admin) headers['x-admin-password'] = adminAuthPassword || '';
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
  }

  const API = {
    async saveDelivery(entry){
      return apiCall('/api/deliveries', { method: 'POST', body: entry });
    },
    async saveInboxMessage(entry){
      return apiCall('/api/inbox', { method: 'POST', body: entry });
    },
    async getDeliveries(){
      return apiCall('/api/deliveries', { admin: true });
    },
    async getInboxMessages(){
      return apiCall('/api/inbox', { admin: true });
    },
    async getConfessions(){
      return apiCall('/api/confessions');
    },
    async addConfession(entry){
      return apiCall('/api/confessions', { method: 'POST', body: entry });
    },
    async deleteConfessions(ids){
      return apiCall('/api/confessions/delete', { method: 'POST', body: { ids }, admin: true });
    },
    async isChatNameTaken(name){
      return apiCall('/api/chat/name-check?name=' + encodeURIComponent(name.toLowerCase()));
    },
    async registerChatName(name){
      return apiCall('/api/chat/name-register', { method: 'POST', body: { name } });
    },
    async getChatMessages(){
      return apiCall('/api/chat/messages');
    },
    async postChatMessage(entry){
      return apiCall('/api/chat/messages', { method: 'POST', body: entry });
    },
    async deleteChatMessages(ids){
      return apiCall('/api/chat/messages/delete', { method: 'POST', body: { ids }, admin: true });
    },
    async getLeaderboard(){
      return apiCall('/api/dino/leaderboard');
    },
    async isDinoNameTaken(name){
      return apiCall('/api/dino/name-check?name=' + encodeURIComponent(name));
    },
    async submitDinoScore(name, score){
      return apiCall('/api/dino/score', { method: 'POST', body: { name, score } });
    },

    /* ---- POEMS (page-poems) — public, permanent, admin-deletable ---- */
    async getPoems(){
      return apiCall('/api/poems');
    },
    async addPoem(entry){
      return apiCall('/api/poems', { method: 'POST', body: entry });
    },
    async deletePoems(ids){
      return apiCall('/api/poems/delete', { method: 'POST', body: { ids }, admin: true });
    },

    /* ---- "LET'S MAKE UP" — private, password-gated 2-person room ---- */
    async listReconcileRooms(){
      return apiCall('/api/reconcile/rooms');
    },
    async createReconcileRoom(room){
      return apiCall('/api/reconcile/rooms', { method: 'POST', body: room });
    },
    async getReconcileRoom(id){
      return apiCall('/api/reconcile/rooms/' + encodeURIComponent(id));
    },
    async getReconcileMessages(roomId){
      return apiCall('/api/reconcile/rooms/' + encodeURIComponent(roomId) + '/messages');
    },
    async postReconcileMessage(roomId, entry){
      return apiCall('/api/reconcile/rooms/' + encodeURIComponent(roomId) + '/messages', { method: 'POST', body: entry });
    },

    /* ---- ADMIN LOGIN — real server-side password check ---- */
    async checkAdminPassword(password){
      try {
        const r = await apiCall('/api/admin/login', { method: 'POST', body: { password } });
        return !!(r && r.ok);
      } catch (e) {
        return false;
      }
    }
  };

  /* Small, generic word filter. Expand this list to fit your
     community — it's intentionally short here. Any message that
     matches gets rejected before it's ever stored or shown. */
  const BLOCKED_WORDS = ['idiot','stupid','shutup','hate you','كلب','حقير','غبي','احمق'];
  function containsBlockedWord(text){
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some(w => lower.includes(w));
  }

  /* =========================================================
     DELIVER A MESSAGE (page-deliver)
     ========================================================= */
  const platformSelect = document.getElementById('platformSelect');
  let selectedPlatform = null;
  if (platformSelect) {
    platformSelect.querySelectorAll('.planet-option').forEach(btn => {
      btn.addEventListener('click', () => {
        platformSelect.querySelectorAll('.planet-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedPlatform = btn.getAttribute('data-platform');
      });
    });
  }
  const deliverForm = document.getElementById('deliverForm');
  const deliverConfirm = document.getElementById('deliverConfirm');
  if (deliverForm) {
    deliverForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const username = document.getElementById('deliverUsername').value.trim();
      const message = document.getElementById('deliverMessage').value.trim();
      if (!selectedPlatform || !username || !message) return;
      if (containsBlockedWord(message)) {
        deliverConfirm.textContent = dict.chatFiltered;
        return;
      }
      await API.saveDelivery({
        platform: selectedPlatform,
        username,
        message,
        timestamp: new Date().toISOString()
      });
      deliverConfirm.textContent = dict.deliverConfirm;
      deliverForm.reset();
      platformSelect.querySelectorAll('.planet-option').forEach(b => b.classList.remove('selected'));
      selectedPlatform = null;
    });
  }

  /* =========================================================
     CONFESSIONS (page-confess) — append-only feed
     ========================================================= */
  const confessForm = document.getElementById('confessForm');
  const confessFeed = document.getElementById('confessFeed');
  const confessInput = document.getElementById('confessInput');

  function formatTimestamp(iso){
    const d = new Date(iso);
    return d.toLocaleString();
  }

  async function renderConfessions(){
    if (!confessFeed) return;
    const dict = currentDict();
    const list = await API.getConfessions();
    confessFeed.innerHTML = '';
    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint-text';
      p.textContent = dict.confessEmpty;
      confessFeed.appendChild(p);
      return;
    }
    // newest first, nothing here is ever deletable
    [...list].reverse().forEach(entry => {
      const card = document.createElement('div');
      card.className = 'confess-card';
      const p = document.createElement('p');
      p.textContent = entry.text;
      const time = document.createElement('time');
      time.textContent = formatTimestamp(entry.timestamp);
      card.appendChild(p);
      card.appendChild(time);
      confessFeed.appendChild(card);
    });
  }

  if (confessForm) {
    confessForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const text = confessInput.value.trim();
      if (!text) return;
      if (containsBlockedWord(text)) {
        confessInput.value = '';
        return;
      }
      await API.addConfession({ id: genId(), text, timestamp: new Date().toISOString() });
      confessForm.reset();
      renderConfessions();
    });
    renderConfessions();
  }

  /* =========================================================
     POEMS (page-poems) — public, permanent feed, admin-deletable
     ========================================================= */
  const poemForm   = document.getElementById('poemForm');
  const poemFeed   = document.getElementById('poemFeed');
  const poemInput  = document.getElementById('poemInput');
  const poemAuthorInput = document.getElementById('poemAuthorInput');

  async function renderPoems(){
    if (!poemFeed) return;
    const dict = currentDict();
    const list = await API.getPoems();
    poemFeed.innerHTML = '';
    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint-text';
      p.textContent = dict.poemEmpty;
      poemFeed.appendChild(p);
      return;
    }
    [...list].reverse().forEach(entry => {
      const card = document.createElement('div');
      card.className = 'confess-card poem-card';
      const author = document.createElement('div');
      author.className = 'poem-author';
      author.textContent = entry.author || dict.poemAnonymous;
      const p = document.createElement('p');
      p.textContent = entry.text;
      const time = document.createElement('time');
      time.textContent = formatTimestamp(entry.timestamp);
      card.appendChild(author);
      card.appendChild(p);
      card.appendChild(time);
      poemFeed.appendChild(card);
    });
  }

  if (poemForm) {
    poemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = poemInput.value.trim();
      const author = poemAuthorInput.value.trim();
      if (!text) return;
      if (containsBlockedWord(text)) {
        poemInput.value = '';
        return;
      }
      await API.addPoem({ id: genId(), author, text, timestamp: new Date().toISOString() });
      poemForm.reset();
      renderPoems();
    });
    renderPoems();
  }

  /* =========================================================
     MESSAGE ME ANONYMOUSLY (page-sendme)
     ========================================================= */
  const sendMeForm = document.getElementById('sendMeForm');
  const sendMeConfirm = document.getElementById('sendMeConfirm');
  if (sendMeForm) {
    sendMeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const text = document.getElementById('sendMeInput').value.trim();
      if (!text) return;
      if (containsBlockedWord(text)) {
        sendMeConfirm.textContent = dict.chatFiltered;
        return;
      }
      await API.saveInboxMessage({ text, timestamp: new Date().toISOString() });
      sendMeConfirm.textContent = dict.sendMeConfirm;
      sendMeForm.reset();
    });
  }

  /* =========================================================
     CONFESSION CHAT (page-chat)
     ========================================================= */
  const chatJoinForm   = document.getElementById('chatJoinForm');
  const chatJoinPanel  = document.getElementById('chatJoin');
  const chatRoomPanel  = document.getElementById('chatRoom');
  const chatAvatarInput= document.getElementById('chatAvatarInput');
  const avatarPreview  = document.getElementById('avatarPreview');
  const chatNameInput  = document.getElementById('chatNameInput');
  const chatNameTakenMsg = document.getElementById('chatNameTakenMsg');
  const chatMessages   = document.getElementById('chatMessages');
  const chatSendForm   = document.getElementById('chatSendForm');
  const chatMessageInput = document.getElementById('chatMessageInput');

  let myChatName = null;
  let myChatAvatar = '';
  let chatPollTimer = null;
  let chatReplyTarget = null;   // {id, name, text} of the message currently being replied to
  let seenChatMsgIds = new Set(); // ids already rendered/notified about, so we only notify on NEW replies

  /* ---- Notifications toggle ("get notified" when someone replies to you) ---- */
  const NOTIF_KEY = 'berlin_notif_enabled';
  const chatNotifBtn = document.getElementById('chatNotifBtn');
  const chatNotifBtnLabel = document.getElementById('chatNotifBtnLabel');
  function notifEnabled(){
    try { return localStorage.getItem(NOTIF_KEY) === '1'; } catch (e) { return false; }
  }
  function renderNotifBtn(){
    if (!chatNotifBtnLabel) return;
    const dict = currentDict();
    const on = notifEnabled() && window.Notification && Notification.permission === 'granted';
    chatNotifBtnLabel.textContent = on ? dict.notifOn : dict.notifOff;
    chatNotifBtn.classList.toggle('active', on);
  }
  if (chatNotifBtn) {
    chatNotifBtn.addEventListener('click', async () => {
      const dict = currentDict();
      if (!window.Notification) return;
      if (notifEnabled()) {
        localStorage.setItem(NOTIF_KEY, '0');
        renderNotifBtn();
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission === 'granted') {
        localStorage.setItem(NOTIF_KEY, '1');
      } else {
        alert(dict.notifDenied);
      }
      renderNotifBtn();
    });
  }

  /* ---- Reply-to-message (long-press a message bubble) ---- */
  const chatReplyBar = document.getElementById('chatReplyBar');
  const chatReplyBarName = document.getElementById('chatReplyBarName');
  const chatReplyBarSnippet = document.getElementById('chatReplyBarSnippet');
  const chatReplyCancelBtn = document.getElementById('chatReplyCancelBtn');

  function setReplyTarget(target){
    chatReplyTarget = target;
    if (!chatReplyBar) return;
    if (target) {
      chatReplyBarName.textContent = target.name;
      chatReplyBarSnippet.textContent = target.text.length > 80 ? target.text.slice(0, 80) + '…' : target.text;
      chatReplyBar.style.display = 'flex';
      chatMessageInput.focus();
    } else {
      chatReplyBar.style.display = 'none';
    }
  }
  if (chatReplyCancelBtn) {
    chatReplyCancelBtn.addEventListener('click', () => setReplyTarget(null));
  }

  function attachLongPressReply(row, msg){
    const dict = currentDict();
    let pressTimer = null;
    let popover = null;
    function removePopover(){
      if (popover) { popover.remove(); popover = null; }
    }
    function openPopover(){
      removePopover();
      popover = document.createElement('button');
      popover.type = 'button';
      popover.className = 'chat-reply-popover';
      popover.textContent = dict.replyAction;
      popover.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setReplyTarget({ id: msg.id, name: msg.name, text: msg.text });
        removePopover();
      });
      row.appendChild(popover);
      document.addEventListener('click', removePopover, { once: true });
    }
    function start(e){
      pressTimer = setTimeout(openPopover, 550);
    }
    function cancel(){
      if (pressTimer) clearTimeout(pressTimer);
    }
    row.addEventListener('pointerdown', start);
    row.addEventListener('pointerup', cancel);
    row.addEventListener('pointerleave', cancel);
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); openPopover(); });
  }

  if (chatAvatarInput) {
    chatAvatarInput.addEventListener('change', () => {
      const file = chatAvatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        myChatAvatar = reader.result;
        avatarPreview.style.backgroundImage = `url(${myChatAvatar})`;
        avatarPreview.textContent = '';
      };
      reader.readAsDataURL(file);
    });
  }

  function renderChatMessages(list){
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    list.forEach(msg => {
      if (!msg.id) msg.id = genId(); // safety net for any pre-existing messages without an id
      const row = document.createElement('div');
      row.className = 'chat-msg' + (msg.name === myChatName ? ' self' : '');
      const av = document.createElement('div');
      av.className = 'chat-msg-avatar';
      if (msg.avatar) {
        av.style.backgroundImage = `url(${msg.avatar})`;
      } else {
        av.textContent = (msg.name || '?').charAt(0).toUpperCase();
      }
      const body = document.createElement('div');
      body.className = 'chat-msg-body';
      if (msg.replyTo) {
        const quote = document.createElement('div');
        quote.className = 'chat-reply-quote';
        const qName = document.createElement('b');
        qName.textContent = msg.replyTo.name;
        const qText = document.createElement('span');
        qText.textContent = msg.replyTo.text.length > 60 ? msg.replyTo.text.slice(0, 60) + '…' : msg.replyTo.text;
        quote.appendChild(qName);
        quote.appendChild(qText);
        body.appendChild(quote);
      }
      const name = document.createElement('span');
      name.className = 'chat-msg-name';
      name.textContent = msg.name;
      const text = document.createElement('span');
      text.className = 'chat-msg-text';
      text.textContent = msg.text;
      body.appendChild(name);
      body.appendChild(text);
      row.appendChild(av);
      row.appendChild(body);
      chatMessages.appendChild(row);
      attachLongPressReply(row, msg);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function pollChat(){
    const list = await API.getChatMessages();
    // Notify only about brand-new messages that reply to something *I* said,
    // and only if I've turned notifications on for myself.
    if (myChatName) {
      const isFirstPoll = seenChatMsgIds.size === 0;
      list.forEach(msg => {
        if (!msg.id) return;
        const isNew = !seenChatMsgIds.has(msg.id);
        if (isNew && !isFirstPoll && msg.replyTo && msg.replyTo.name === myChatName && msg.name !== myChatName) {
          if (notifEnabled() && window.Notification && Notification.permission === 'granted') {
            const dict = currentDict();
            new Notification(dict.notifReplyTitle, { body: `${msg.name}: ${msg.text}` });
          }
        }
        seenChatMsgIds.add(msg.id);
      });
    }
    renderChatMessages(list);
  }

  if (chatJoinForm) {
    chatJoinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const name = chatNameInput.value.trim();
      if (!name) return;
      if (await API.isChatNameTaken(name)) {
        chatNameTakenMsg.textContent = dict.chatNameTaken;
        return;
      }
      await API.registerChatName(name);
      myChatName = name;
      chatJoinPanel.style.display = 'none';
      chatRoomPanel.style.display = 'flex';
      seenChatMsgIds = new Set();
      renderNotifBtn();
      pollChat();
      chatPollTimer = setInterval(pollChat, 2000);
    });
  }

  if (chatSendForm) {
    chatSendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const text = chatMessageInput.value.trim();
      if (!text || !myChatName) return;
      if (containsBlockedWord(text)) {
        chatMessageInput.value = '';
        return;
      }
      await API.postChatMessage({
        id: genId(),
        name: myChatName,
        avatar: myChatAvatar,
        text,
        replyTo: chatReplyTarget,
        timestamp: new Date().toISOString()
      });
      chatMessageInput.value = '';
      setReplyTarget(null);
      pollChat();
    });
  }

  /* =========================================================
     LET'S MAKE UP (page-reconcile) — create a private, named,
     password-protected 2-person room and share the link. Whoever
     opens the link needs the password to see anything; the room's
     name/photo only show up once the password is correct.
     Note: like the rest of the site this currently runs on
     localStorage (see the API object above), so the "shareable
     link" only really crosses devices once those stub methods are
     swapped for real fetch() calls to a backend.
     ========================================================= */
  const reconcileCreate      = document.getElementById('reconcileCreate');
  const reconcileCreateForm  = document.getElementById('reconcileCreateForm');
  const reconcilePhotoInput  = document.getElementById('reconcilePhotoInput');
  const reconcilePhotoPreview= document.getElementById('reconcilePhotoPreview');
  const reconcileNameInput   = document.getElementById('reconcileNameInput');
  const reconcilePassInput   = document.getElementById('reconcilePassInput');
  const reconcileLinkBox     = document.getElementById('reconcileLinkBox');
  const reconcileLinkOutput  = document.getElementById('reconcileLinkOutput');
  const reconcileCopyBtn     = document.getElementById('reconcileCopyBtn');
  const reconcileCopiedMsg   = document.getElementById('reconcileCopiedMsg');

  const reconcileGate        = document.getElementById('reconcileGate');
  const reconcileGatePhoto   = document.getElementById('reconcileGatePhoto');
  const reconcileGateName    = document.getElementById('reconcileGateName');
  const reconcileGateForm    = document.getElementById('reconcileGateForm');
  const reconcileGatePassInput = document.getElementById('reconcileGatePassInput');
  const reconcileGateError   = document.getElementById('reconcileGateError');

  const reconcileNameGate    = document.getElementById('reconcileNameGate');
  const reconcileChatTitle   = document.getElementById('reconcileChatTitle');
  const reconcileNameForm    = document.getElementById('reconcileNameForm');
  const reconcileMyNameInput = document.getElementById('reconcileMyNameInput');

  const reconcileRoomPanel   = document.getElementById('reconcileRoom');
  const reconcileMessagesEl  = document.getElementById('reconcileMessages');
  const reconcileSendForm    = document.getElementById('reconcileSendForm');
  const reconcileMessageInput= document.getElementById('reconcileMessageInput');
  const reconcileInfoNoteEl  = document.getElementById('reconcileInfoNote');

  const roomsListEl = document.getElementById('roomsList');
  const roomsEmptyEl = document.getElementById('roomsEmpty');

  let reconcilePhotoData = '';
  let activeReconcileRoom = null;
  let myReconcileName = null;
  let reconcilePollTimer = null;

  /* Per-room "has this browser already used the free first-time entry"
     flag. A fresh shared link skips the password once; after that
     (and always when opened from the ROOMS directory, section 12)
     the password is required. */
  function reconcileVisitedKey(roomId){
    return 'berlin_reconcile_seen_' + roomId;
  }

  if (reconcilePhotoInput) {
    reconcilePhotoInput.addEventListener('change', () => {
      const file = reconcilePhotoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        reconcilePhotoData = reader.result;
        reconcilePhotoPreview.style.backgroundImage = `url(${reconcilePhotoData})`;
        reconcilePhotoPreview.textContent = '';
      };
      reader.readAsDataURL(file);
    });
  }

  if (reconcileCreateForm) {
    reconcileCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = reconcileNameInput.value.trim();
      const password = reconcilePassInput.value;
      if (!name || !password) return;
      const room = {
        id: genId(),
        name,
        password,
        photo: reconcilePhotoData,
        createdAt: new Date().toISOString()
      };
      await API.createReconcileRoom(room);
      const link = `${location.origin}${location.pathname}?room=${room.id}`;
      reconcileLinkOutput.value = link;
      reconcileLinkBox.style.display = 'block';
      reconcileCopiedMsg.textContent = '';
    });
  }

  if (reconcileCopyBtn) {
    reconcileCopyBtn.addEventListener('click', async () => {
      const dict = currentDict();
      try {
        await navigator.clipboard.writeText(reconcileLinkOutput.value);
      } catch (e) {
        reconcileLinkOutput.select();
        document.execCommand('copy');
      }
      reconcileCopiedMsg.textContent = dict.reconcileCopied;
    });
  }

  function showReconcileView(view){
    [reconcileCreate, reconcileGate, reconcileNameGate, reconcileRoomPanel].forEach(el => {
      if (!el) return;
      el.style.display = 'none';
    });
    if (view === 'create') reconcileCreate.style.display = 'flex';
    if (view === 'gate') reconcileGate.style.display = 'flex';
    if (view === 'nameGate') reconcileNameGate.style.display = 'flex';
    if (view === 'room') reconcileRoomPanel.style.display = 'flex';
  }

  if (reconcileGateForm) {
    reconcileGateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const dict = currentDict();
      if (!activeReconcileRoom) return;
      if (reconcileGatePassInput.value === activeReconcileRoom.password) {
        reconcileGateError.textContent = '';
        reconcileChatTitle.textContent = activeReconcileRoom.name;
        try { localStorage.setItem(reconcileVisitedKey(activeReconcileRoom.id), '1'); } catch (err) { /* no-op */ }
        showReconcileView('nameGate');
      } else {
        reconcileGateError.textContent = dict.reconcileWrongPassword;
        reconcileGatePassInput.value = '';
      }
    });
  }

  function renderReconcileMessages(list){
    if (!reconcileMessagesEl) return;
    reconcileMessagesEl.innerHTML = '';
    list.forEach(msg => {
      const row = document.createElement('div');
      row.className = 'chat-msg' + (msg.name === myReconcileName ? ' self' : '');
      const av = document.createElement('div');
      av.className = 'chat-msg-avatar';
      av.textContent = (msg.name || '?').charAt(0).toUpperCase();
      const body = document.createElement('div');
      body.className = 'chat-msg-body';
      const name = document.createElement('span');
      name.className = 'chat-msg-name';
      name.textContent = msg.name;
      const text = document.createElement('span');
      text.className = 'chat-msg-text';
      text.textContent = msg.text;
      body.appendChild(name);
      body.appendChild(text);
      row.appendChild(av);
      row.appendChild(body);
      reconcileMessagesEl.appendChild(row);
    });
    reconcileMessagesEl.scrollTop = reconcileMessagesEl.scrollHeight;
  }

  async function pollReconcileChat(){
    if (!activeReconcileRoom) return;
    const list = await API.getReconcileMessages(activeReconcileRoom.id);
    renderReconcileMessages(list);
  }

  if (reconcileNameForm) {
    reconcileNameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = reconcileMyNameInput.value.trim();
      if (!name) return;
      myReconcileName = name;
      if (reconcileInfoNoteEl && activeReconcileRoom) {
        const dict = currentDict();
        reconcileInfoNoteEl.textContent = (dict.reconcileRoomInfo || '')
          .replace('{name}', activeReconcileRoom.name)
          .replace('{password}', activeReconcileRoom.password);
      }
      showReconcileView('room');
      pollReconcileChat();
      if (reconcilePollTimer) clearInterval(reconcilePollTimer);
      reconcilePollTimer = setInterval(pollReconcileChat, 2000);
    });
  }

  if (reconcileSendForm) {
    reconcileSendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = reconcileMessageInput.value.trim();
      if (!text || !myReconcileName || !activeReconcileRoom) return;
      if (containsBlockedWord(text)) {
        reconcileMessageInput.value = '';
        return;
      }
      await API.postReconcileMessage(activeReconcileRoom.id, {
        id: genId(),
        name: myReconcileName,
        text,
        timestamp: new Date().toISOString()
      });
      reconcileMessageInput.value = '';
      pollReconcileChat();
    });
  }

  /* If the URL was opened with ?room=ID (someone followed a shared
     link), skip the "create a room" view. The very first time THIS
     browser opens THIS room's link, the password gate is skipped
     entirely — straight into picking a name. Every visit after that
     (and every visit that comes through the ROOMS directory instead
     of the link) requires the password. */
  async function initReconcileFromURL(){
    const roomId = new URLSearchParams(location.search).get('room');
    if (!roomId) { showReconcileView('create'); return; }
    const dict = currentDict();
    const room = await API.getReconcileRoom(roomId);
    goToScreen('page-reconcile');
    if (!room) {
      showReconcileView('gate');
      reconcileGateName.textContent = dict.reconcileRoomMissing;
      reconcileGateForm.style.display = 'none';
      return;
    }
    activeReconcileRoom = room;
    reconcileGateName.textContent = room.name;
    if (room.photo) {
      reconcileGatePhoto.style.backgroundImage = `url(${room.photo})`;
      reconcileGatePhoto.textContent = '';
    }

    let alreadySeen = false;
    try { alreadySeen = !!localStorage.getItem(reconcileVisitedKey(room.id)); } catch (err) { /* no-op */ }

    if (!alreadySeen) {
      try { localStorage.setItem(reconcileVisitedKey(room.id), '1'); } catch (err) { /* no-op */ }
      reconcileChatTitle.textContent = room.name;
      showReconcileView('nameGate');
    } else {
      showReconcileView('gate');
    }
  }
  if (document.getElementById('page-reconcile')) {
    initReconcileFromURL();
  }

  /* =========================================================
     ROOMS (page-rooms) — directory of every reconcile room made
     on this device/browser. Unlike the shared link, opening a
     room from this list ALWAYS requires its password.
     ========================================================= */
  async function renderRoomsList(){
    if (!roomsListEl) return;
    const rooms = await API.listReconcileRooms();
    roomsListEl.querySelectorAll('.room-card').forEach(el => el.remove());
    if (!rooms.length) {
      if (roomsEmptyEl) roomsEmptyEl.style.display = 'block';
      return;
    }
    if (roomsEmptyEl) roomsEmptyEl.style.display = 'none';
    rooms.forEach(room => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'room-card';
      card.innerHTML = `
        <span class="room-card-avatar"></span>
        <span class="room-card-body">
          <span class="room-card-name"></span>
          <time></time>
        </span>`;
      const avatar = card.querySelector('.room-card-avatar');
      if (room.photo) {
        avatar.style.backgroundImage = `url(${room.photo})`;
      } else {
        avatar.textContent = (room.name || '?').charAt(0).toUpperCase();
      }
      card.querySelector('.room-card-name').textContent = room.name;
      card.querySelector('time').textContent = new Date(room.createdAt).toLocaleString();
      card.addEventListener('click', () => openRoomFromList(room));
      roomsListEl.appendChild(card);
    });
  }

  function openRoomFromList(room){
    activeReconcileRoom = room;
    goToScreen('page-reconcile');
    reconcileGateForm.style.display = '';
    reconcileGateError.textContent = '';
    reconcileGatePassInput.value = '';
    reconcileGateName.textContent = room.name;
    if (room.photo) {
      reconcileGatePhoto.style.backgroundImage = `url(${room.photo})`;
      reconcileGatePhoto.textContent = '';
    } else {
      reconcileGatePhoto.style.backgroundImage = '';
      reconcileGatePhoto.textContent = '♥';
    }
    showReconcileView('gate');
  }

  /* =========================================================
     DINO RUN (page-dino) — canvas runner + leaderboard
     ========================================================= */
  const dinoNameGate  = document.getElementById('dinoNameGate');
  const dinoGameWrap  = document.getElementById('dinoGameWrap');
  const dinoNameForm  = document.getElementById('dinoNameForm');
  const dinoNameInput = document.getElementById('dinoNameInput');
  const dinoNameTakenMsg = document.getElementById('dinoNameTakenMsg');
  const dinoCanvas    = document.getElementById('dinoCanvas');
  const dinoScoreLine = document.getElementById('dinoScoreLine');
  const dinoBestLine  = document.getElementById('dinoBestLine');
  const dinoBoard     = document.getElementById('dinoBoard');

  let dinoRunnerName = null;

  async function renderLeaderboard(){
    if (!dinoBoard) return;
    const board = await API.getLeaderboard();
    dinoBoard.innerHTML = '';
    board.slice(0, 10).forEach((entry, i) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.className = 'rank-name';
      left.textContent = `${i + 1}. ${i === 0 ? '🏆 ' : ''}${entry.name}`;
      const right = document.createElement('span');
      right.textContent = entry.score;
      li.appendChild(left);
      li.appendChild(right);
      dinoBoard.appendChild(li);
    });
  }

  if (dinoNameForm) {
    dinoNameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = currentDict();
      const name = dinoNameInput.value.trim();
      if (!name) return;
      if (await API.isDinoNameTaken(name)) {
        dinoNameTakenMsg.textContent = dict.dinoNameTaken;
        return;
      }
      dinoRunnerName = name;
      dinoNameGate.style.display = 'none';
      dinoGameWrap.style.display = 'flex';
      renderLeaderboard();
      startDinoGame();
    });
  }

  function startDinoGame(){
    if (!dinoCanvas) return;
    const ctx = dinoCanvas.getContext('2d');
    const W = dinoCanvas.width, H = dinoCanvas.height;
    const groundY = H - 30;

    let dino = { x: 40, y: groundY - 32, w: 30, h: 32, vy: 0, jumping: false };
    const GRAVITY = 0.9, JUMP_V = -13.5;
    let obstacles = [];
    // Slower, longer ramp: starts easy and stays playable far longer
    // than a stock endless-runner before it gets genuinely hard.
    const START_SPEED = 4.6, MAX_SPEED = 11.5, SPEED_STEP = 0.0007;
    let speed = START_SPEED;
    let frame = 0;
    let score = 0;
    let best = Number(localStorage.getItem('berlin_dino_best') || 0);
    let running = true;
    dinoBestLine.textContent = 'BEST: ' + best;

    function spawnObstacle(){
      // Occasional low-flying obstacle for variety once the run is going
      const flying = score > 300 && Math.random() < 0.22;
      if (flying) {
        const h = 20;
        obstacles.push({ x: W + 10, y: groundY - dino.h - 42, w: 22, h, type: 'fly' });
      } else {
        const h = 26 + Math.random() * 20;
        const segs = 1 + (Math.random() < 0.25 ? 1 : 0); // sometimes a double cactus
        obstacles.push({ x: W + 10, y: groundY - h, w: 16 + segs * 10, h, type: 'cactus', segs });
      }
    }

    function jump(){
      if (!dino.jumping) {
        dino.vy = JUMP_V;
        dino.jumping = true;
      }
    }
    function keyHandler(e){
      if (e.code === 'Space') { e.preventDefault(); jump(); }
    }
    document.addEventListener('keydown', keyHandler);
    dinoCanvas.addEventListener('pointerdown', jump);

    function drawDino(){
      ctx.save();
      ctx.translate(Math.round(dino.x), Math.round(dino.y));
      ctx.fillStyle = '#00e5ff';
      // tail
      ctx.fillRect(0, 12, 7, 7);
      // torso
      ctx.fillRect(5, 6, 18, 18);
      // head
      ctx.fillRect(18, 0, 12, 11);
      // snout bump
      ctx.fillRect(28, 4, 4, 4);
      // eye
      ctx.fillStyle = '#05060a';
      ctx.fillRect(26, 3, 3, 3);
      // little arm
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(16, 16, 6, 4);
      // legs — alternate while running, tucked while jumping
      const legFrame = Math.floor(frame / 6) % 2;
      if (dino.jumping) {
        ctx.fillRect(8, 24, 6, 6);
        ctx.fillRect(17, 24, 6, 6);
      } else if (legFrame === 0) {
        ctx.fillRect(7, 24, 6, 8);
        ctx.fillRect(18, 24, 6, 5);
      } else {
        ctx.fillRect(7, 24, 6, 5);
        ctx.fillRect(18, 24, 6, 8);
      }
      ctx.restore();
    }

    function drawObstacle(o){
      if (o.type === 'fly') {
        ctx.fillStyle = '#ffcf4d';
        ctx.fillRect(o.x, o.y + 6, o.w, o.h - 12);
        ctx.fillRect(o.x + o.w * 0.15, o.y, o.w * 0.7, 6);
        ctx.fillRect(o.x + o.w * 0.15, o.y + o.h - 6, o.w * 0.7, 6);
        return;
      }
      ctx.fillStyle = '#1fae63';
      const segW = o.w / (o.segs + 1);
      for (let i = 0; i <= o.segs; i++) {
        const sx = o.x + i * (segW + 4);
        ctx.fillRect(sx, o.y, segW, o.h);
        ctx.fillRect(sx - 5, o.y + o.h * 0.25, 6, o.h * 0.22);
      }
    }

    function loop(){
      if (!running) return;
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ground
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, groundY + dino.h);
      ctx.lineTo(W, groundY + dino.h);
      ctx.stroke();

      // dino physics
      dino.vy += GRAVITY;
      dino.y += dino.vy;
      if (dino.y > groundY - dino.h) {
        dino.y = groundY - dino.h;
        dino.vy = 0;
        dino.jumping = false;
      }
      drawDino();

      // obstacles — gap stays generous even as speed climbs
      const gap = Math.max(58, 95 - Math.floor(speed * 2.6));
      if (frame % gap === 0) spawnObstacle();
      obstacles.forEach(o => { o.x -= speed; drawObstacle(o); });
      obstacles = obstacles.filter(o => o.x + o.w > 0);

      // collision (slightly forgiving hitbox so it feels fair)
      const pad = 4;
      for (const o of obstacles) {
        if (dino.x + pad < o.x + o.w && dino.x + dino.w - pad > o.x &&
            dino.y + pad < o.y + o.h && dino.y + dino.h - pad > o.y) {
          running = false;
          endDinoGame();
          return;
        }
      }

      score += 1;
      if (speed < MAX_SPEED) speed += SPEED_STEP;
      dinoScoreLine.textContent = Math.floor(score / 5);

      requestAnimationFrame(loop);
    }

    async function endDinoGame(){
      document.removeEventListener('keydown', keyHandler);
      const finalScore = Math.floor(score / 5);
      if (finalScore > best) {
        best = finalScore;
        localStorage.setItem('berlin_dino_best', String(best));
      }
      await API.submitDinoScore(dinoRunnerName, finalScore);
      renderLeaderboard();
      const dict = currentDict();
      ctx.fillStyle = 'rgba(5,6,10,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dict.dinoGameOver || 'GAME OVER', W / 2, H / 2 - 10);
      ctx.font = '12px monospace';
      ctx.fillText('tap / space to try again', W / 2, H / 2 + 14);

      const restart = () => {
        dinoCanvas.removeEventListener('pointerdown', restart);
        document.removeEventListener('keydown', restartKey);
        obstacles = [];
        speed = START_SPEED; frame = 0; score = 0; running = true;
        dino = { x: 40, y: groundY - 32, w: 30, h: 32, vy: 0, jumping: false };
        document.addEventListener('keydown', keyHandler);
        requestAnimationFrame(loop);
      };
      const restartKey = (e) => { if (e.code === 'Space') restart(); };
      dinoCanvas.addEventListener('pointerdown', restart);
      document.addEventListener('keydown', restartKey);
    }

    requestAnimationFrame(loop);
  }

});
