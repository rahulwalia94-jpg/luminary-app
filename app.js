// app.js — Luminary PWA
// Replace this with your Render backend URL after deployment
const BACKEND = 'https://luminary-backend-8j37.onrender.com';

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    console.log('[SW] Registered');
    // Listen for messages from SW (notification click with item)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'OPEN_ITEM') scrollToItem(e.data.itemId);
    });
  });
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const sec = item.dataset.sec;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`sec-${sec}`).classList.add('active');
  });
});

// ─── Load Queue ───────────────────────────────────────────────────────────────
let queueData = [];

async function loadQueue() {
  try {
    const res = await fetch(`${BACKEND}/queue`);
    const { queue = [] } = await res.json();
    queueData = queue;
    renderQueue(queue);
    updateStats(queue);
  } catch (err) {
    console.error('[App] Queue load error:', err);
    document.getElementById('loading').innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--muted)">
        <div style="font-size:11px;margin-bottom:8px">Could not reach Luminary backend</div>
        <div style="font-size:9px;color:var(--dim)">Make sure your backend is deployed on Render</div>
      </div>`;
  }
}

function renderQueue(queue) {
  document.getElementById('loading').style.display = 'none';
  const content = document.getElementById('queueContent');
  content.style.display = 'block';

  document.getElementById('badge').textContent = queue.length;

  if (queue.length === 0) {
    content.innerHTML = `
      <div class="q-empty">
        <div class="q-empty-glyph">∞</div>
        <div class="q-empty-title">Queue is building</div>
        <div class="q-empty-sub">Luminary runs tonight at 2am. It's reading your 2 years of YouTube history right now. Come back tomorrow morning.</div>
      </div>`;
    return;
  }

  content.innerHTML = queue.map(item => {
    const themes = (item.themes || []).slice(0, 4).map(t =>
      `<span class="q-chip">${t}</span>`
    ).join('');

    return `
      <div class="q-item ${!item.seen ? 'new' : ''}" data-id="${item.id}" data-url="${item.videoUrl}" id="item-${item.id}">
        <div class="q-thumb-wrap">
          <img class="q-thumb" src="${item.thumbnail || ''}" loading="lazy" onerror="this.style.opacity='0'">
          <div class="q-play">
            <div class="play-icon">
              <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
          </div>
        </div>
        <div class="q-body">
          <div class="q-title">${item.videoTitle}</div>
          <div class="q-channel">${item.channelName}</div>
          <div class="q-why">${item.whyThisMatters || ''}</div>
          <div class="q-footer">
            <span class="q-date">${timeAgo(item.addedAt)}</span>
            ${!item.seen ? '<span class="q-new">✦ new</span>' : ''}
          </div>
          <div class="q-themes">${themes}</div>
        </div>
      </div>`;
  }).join('');

  // Tap to open YouTube
  content.querySelectorAll('.q-item').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.dataset.url;
      const id = el.dataset.id;
      if (url) {
        window.open(url, '_blank');
        markSeen(id);
        el.classList.remove('new');
      }
    });
  });
}

function updateStats(queue) {
  document.getElementById('statTotal').textContent = queue.length;
  document.getElementById('statSeen').textContent = queue.filter(q => q.seen).length;

  // Show profile from most recent item
  const latest = queue.find(q => q.profile);
  if (latest?.profile) {
    document.getElementById('profileBox').style.display = 'block';
    document.getElementById('profileText').textContent = latest.profile;
  }
}

async function markSeen(id) {
  try {
    await fetch(`${BACKEND}/seen/${id}`, { method: 'POST' });
  } catch (_) {}
}

function scrollToItem(id) {
  const el = document.getElementById(`item-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Push Notifications ───────────────────────────────────────────────────────
document.getElementById('notifBtn').addEventListener('click', async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Enable notifications in your browser settings to get Luminary updates.');
      return;
    }

    const reg = await navigator.serviceWorker.ready;

    // Get VAPID public key from backend
    const keyRes = await fetch(`${BACKEND}/vapid-public-key`);
    const { key } = await keyRes.json();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    await fetch(`${BACKEND}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });

    document.getElementById('notifBtn').style.display = 'none';
    document.getElementById('notifOk').style.display = 'block';

  } catch (err) {
    console.error('[Push]', err);
    alert('Could not subscribe to notifications: ' + err.message);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000), h = Math.floor(d / 3600000), days = Math.floor(d / 86400000);
  if (days > 0) return `${days}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Boot
loadQueue();
