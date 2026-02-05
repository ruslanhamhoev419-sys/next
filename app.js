// app.js — единая, чистая версия

// ========== CONST & STATE ==========
const FREE_LIMIT = 3;
let subscriptions = JSON.parse(localStorage.getItem('subscriptions')) || [];
let userData = JSON.parse(localStorage.getItem('userData')) || { premium: false, premiumUntil: null, plan: null };
let editingId = null;
let selectedPremiumPlan = 'monthly';

// ========== DOM ==========
const dom = {
  subsContainer: document.getElementById('subsContainer'),
  addSubBtn: document.getElementById('addSubBtn'),
  addFirstSubBtn: document.getElementById('addFirstSubBtn'),
  modalOverlay: document.getElementById('modalOverlay'),
  cancelBtn: document.getElementById('cancelBtn'),
  cancelBtn2: document.getElementById('cancelBtn2'),
  modalTitle: document.getElementById('modalTitle'),
  subForm: document.getElementById('subForm'),
  subName: document.getElementById('subName'),
  subPrice: document.getElementById('subPrice'),
  subCycle: document.getElementById('subCycle'),
  subNextDate: document.getElementById('subNextDate'),
  subColor: document.getElementById('subColor'),
  subNotes: document.getElementById('subNotes'),
  colorOptions: document.querySelectorAll('.color-option'),
  monthlyTotal: document.getElementById('monthlyTotal'),
  activeCount: document.getElementById('activeCount'),
  limitCount: document.getElementById('limitCount'),
  limitBox: document.getElementById('limitBox'),
  premiumBadge: document.getElementById('premiumBadge'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  footerUpgradeBtn: document.getElementById('footerUpgradeBtn'),
  premiumModalOverlay: document.getElementById('premiumModalOverlay'),
  buyPremiumBtn: document.getElementById('buyPremiumBtn'),
  closePremiumBtn: document.getElementById('closePremiumBtn'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  todaySubs: document.getElementById('todaySubs'),
  expiringSubs: document.getElementById('expiringSubs'),
  reminderBanner: document.getElementById('reminderBanner'),
  closeBanner: document.getElementById('closeBanner'),
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  sanitizePremiumState();
  initDefaults();
  bindEvents();
  renderSubscriptions();
  updateUI();
  console.info('app.js initialized — single unified script loaded');
});

// ========== Helpers: storage & premium sanitize ==========
function saveAll() {
  localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  localStorage.setItem('userData', JSON.stringify(userData));
}

function sanitizePremiumState() {
  // Если premium=true но нет валидного premiumUntil — выключим премиум
  try {
    if (userData && userData.premium) {
      if (!userData.premiumUntil) {
        userData.premium = false;
        userData.premiumUntil = null;
      } else {
        const until = new Date(userData.premiumUntil);
        if (isNaN(until.getTime()) || until <= new Date()) {
          userData.premium = false;
          userData.premiumUntil = null;
        }
      }
    }
    saveAll();
  } catch (err) {
    console.warn('sanitizePremiumState error', err);
  }
}

function isPremiumActive() {
  if (!userData || !userData.premium) return false;
  if (!userData.premiumUntil) return false;
  return new Date(userData.premiumUntil) > new Date();
}

// ========== UI init defaults ==========
function initDefaults() {
  // default next date = next month
  if (dom.subNextDate) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    dom.subNextDate.value = nextMonth.toISOString().split('T')[0];
  }
}


// ========== BIND ==========
function bindEvents() {
  // Open modal
  dom.addSubBtn?.addEventListener('click', () => openModal());
  dom.addFirstSubBtn?.addEventListener('click', () => openModal());

  // Modal close
  dom.cancelBtn?.addEventListener('click', closeModal);
  dom.cancelBtn2?.addEventListener('click', closeModal);

  // Modal overlay click to close
  dom.modalOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Color picker options
  dom.colorOptions?.forEach(opt => {
    opt.addEventListener('click', () => {
      const c = opt.dataset.color;
      if (dom.subColor) dom.subColor.value = c;
      dom.colorOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
  dom.subColor?.addEventListener('input', () => dom.colorOptions.forEach(o => o.classList.remove('active')));

  // Form submit
  dom.subForm?.addEventListener('submit', handleFormSubmit);

  // Premium
  dom.upgradeBtn?.addEventListener('click', showPremiumModal);
  dom.footerUpgradeBtn?.addEventListener('click', showPremiumModal);
  dom.closePremiumBtn?.addEventListener('click', hidePremiumModal);
  dom.premiumModalOverlay?.addEventListener('click', (e) => { if (e.target === dom.premiumModalOverlay) hidePremiumModal(); });
  dom.buyPremiumBtn?.addEventListener('click', buyPremium);

  // plan select (cards)
  document.querySelectorAll('.btn-select-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPremiumPlan = btn.dataset.plan || 'monthly';
      document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected'));
      btn.closest('.pricing-card')?.classList.add('selected');
    });
  });

  // filters
  dom.filterButtons?.forEach(btn => btn.addEventListener('click', () => {
    dom.filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSubscriptions(btn.dataset.filter || 'all');
  }));

  // close reminder banner
  dom.closeBanner?.addEventListener('click', () => { if (dom.reminderBanner) dom.reminderBanner.style.display = 'none'; });

  // global click hide context-menu if exists
  document.addEventListener('click', () => {
    const ctx = document.getElementById('contextMenu');
    if (ctx) ctx.style.display = 'none';
  });
}

// ========== FORM ==========
function handleFormSubmit(e) {
  e.preventDefault();

  // limit check
  if (!isPremiumActive() && !editingId && subscriptions.length >= FREE_LIMIT) {
    showPremiumModal();
    return;
  }

  const obj = {
    id: editingId || Date.now(),
    name: dom.subName?.value.trim() || '',
    price: parseFloat(dom.subPrice?.value) || 0,
    cycle: dom.subCycle?.value || 'monthly',
    nextDate: dom.subNextDate?.value || (new Date()).toISOString().split('T')[0],
    color: dom.subColor?.value || '#4a6fa5',
    notes: dom.subNotes?.value?.trim() || '',
    createdAt: editingId ? undefined : new Date().toISOString()
  };

  if (editingId) {
    const ix = subscriptions.findIndex(s => s.id == editingId);
    if (ix !== -1) subscriptions[ix] = { ...subscriptions[ix], ...obj };
  } else {
    subscriptions.push(obj);
  }

  saveAll();
  closeModal();
  renderSubscriptions();
  updateUI();
}

// ========== RENDER ==========
function renderSubscriptions(filter = 'all') {
  if (!dom.subsContainer) return;
  dom.subsContainer.innerHTML = '';

  if (!subscriptions.length) {
    dom.subsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-box-open"></i></div>
        <h3>Пока нет подписок</h3>
        <p>Добавьте первую подписку, чтобы начать отслеживать расходы</p>
        <button id="addFirstSubBtn_local" class="btn-primary"><i class="fas fa-plus"></i> Добавить первую подписку</button>
      </div>
    `;
    const btn = document.getElementById('addFirstSubBtn_local');
    if (btn) btn.addEventListener('click', () => openModal());
    updateUI();
    return;
  }

  const today = new Date();
  let list = [...subscriptions];

  if (filter === 'active') list = list.filter(s => s.active !== false);
  if (filter === 'soon') {
    const weekLater = new Date(today.getTime() + 7*24*60*60*1000);
    list = list.filter(s => {
      const d = new Date(s.nextDate);
      return d >= today && d <= weekLater;
    });
  }

  list.sort((a,b) => new Date(a.nextDate) - new Date(b.nextDate));

  list.forEach(s => {
    const next = new Date(s.nextDate);
    const daysLeft = Math.ceil((next - new Date()) / (1000*60*60*24));
    let dateText = '';
    if (daysLeft < 0) dateText = `Просрочено на ${Math.abs(daysLeft)} дн.`;
    else if (daysLeft === 0) dateText = 'Сегодня';
    else dateText = `Через ${daysLeft} дн. • ${formatDate(s.nextDate)}`;

    const el = document.createElement('div');
    el.className = 'subscription-item';
    el.dataset.id = s.id;
    el.style.borderLeft = `6px solid ${s.color || '#4a6fa5'}`;
    el.innerHTML = `
      <div class="sub-info">
        <h4><span class="color-dot" style="background:${s.color || '#4a6fa5'}"></span>${escapeHtml(s.name)}</h4>
        <div class="sub-meta">
          <div class="meta-item price"><i class="fas fa-ruble-sign"></i> ${Number(s.price || 0).toFixed(2)} ₽</div>
          <div class="meta-item">${getCycleText(s.cycle)}</div>
          <div class="meta-item date">${dateText}</div>
          ${s.notes ? `<div class="meta-item note"><i class="far fa-sticky-note"></i> ${escapeHtml(s.notes)}</div>` : ''}
        </div>
      </div>
      <div class="sub-actions">
        <button class="action-btn edit" data-id="${s.id}" title="Редактировать"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" data-id="${s.id}" title="Удалить"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    dom.subsContainer.appendChild(el);
  });

  // handlers
  dom.subsContainer.querySelectorAll('.action-btn.edit').forEach(b => b.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    openModal(id);
  }));
  dom.subsContainer.querySelectorAll('.action-btn.delete').forEach(b => b.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    deleteSubscription(id);
  }));

  updateUI();
}

// ========== MODAL ==========
function openModal(id = null) {
  editingId = id;
  if (!dom.modalOverlay) return;

  if (id) {
    const s = subscriptions.find(x => x.id == id);
    if (!s) return;
    dom.modalTitle && (dom.modalTitle.textContent = 'Редактировать подписку');
    if (dom.subName) dom.subName.value = s.name || '';
    if (dom.subPrice) dom.subPrice.value = s.price || 0;
    if (dom.subCycle) dom.subCycle.value = s.cycle || 'monthly';
    if (dom.subNextDate) dom.subNextDate.value = s.nextDate || '';
    if (dom.subColor) dom.subColor.value = s.color || '#4a6fa5';
    if (dom.subNotes) dom.subNotes.value = s.notes || '';
    dom.colorOptions.forEach(o => o.classList.toggle('active', o.dataset.color === s.color));
  } else {
    editingId = null;
    dom.modalTitle && (dom.modalTitle.textContent = 'Добавить новую подписку');
    dom.subForm && dom.subForm.reset();
    if (dom.subNextDate) {
      const next = new Date(); next.setMonth(next.getMonth()+1);
      dom.subNextDate.value = next.toISOString().split('T')[0];
    }
    if (dom.subColor) dom.subColor.value = '#4a6fa5';
    dom.colorOptions.forEach(o => o.classList.remove('active'));
  }

  dom.modalOverlay.style.display = 'flex';
}

function closeModal() {
  if (!dom.modalOverlay) return;
  dom.modalOverlay.style.display = 'none';
  editingId = null;
  dom.subForm && dom.subForm.reset();
  dom.colorOptions.forEach(o => o.classList.remove('active'));
}

// ========== DELETE ==========
function deleteSubscription(id) {
  if (!confirm('Удалить подписку?')) return;
  subscriptions = subscriptions.filter(s => s.id != id);
  saveAll();
  renderSubscriptions();
}

// ========== PREMIUM ==========
function showPremiumModal() {
  dom.premiumModalOverlay && (dom.premiumModalOverlay.style.display = 'flex');
}
function hidePremiumModal() {
  dom.premiumModalOverlay && (dom.premiumModalOverlay.style.display = 'none');
}
function buyPremium() {
  const plan = selectedPremiumPlan || 'monthly';
  const days = plan === 'monthly' ? 30 : 365;
  userData.premium = true;
  userData.premiumUntil = new Date(Date.now() + days*24*60*60*1000).toISOString();
  userData.plan = plan;
  saveAll();
  hidePremiumModal();
  alert('Премиум активирован — спасибо!');
  renderSubscriptions();
  updateUI();
}

// ========== UI UPDATES ==========
function updateUI() {
  updateStats();
  updatePremiumBadge();
  updateLimitDisplay();
  updateReminders();
}

function updateStats() {
  const monthlyTotal = subscriptions.reduce((sum, s) => {
    let price = Number(s.price || 0);
    if (s.cycle === 'yearly') price = price / 12;
    if (s.cycle === 'weekly') price = price * 4.33;
    if (s.cycle === 'quarterly') price = price / 3;
    return sum + price;
  }, 0);
  if (dom.monthlyTotal) dom.monthlyTotal.textContent = `${monthlyTotal.toFixed(2)} ₽`;
  if (dom.activeCount) dom.activeCount.textContent = subscriptions.length;
}

function updatePremiumBadge() {
  if (!dom.premiumBadge) return;
  if (isPremiumActive()) {
    const until = userData.premiumUntil ? formatDate(userData.premiumUntil) : '';
    dom.premiumBadge.innerHTML = `<i class="fas fa-crown"></i> <span class="premium-text">Премиум активен</span> ${until ? `<span class="premium-limit">(до ${until})</span>` : ''}`;
    dom.upgradeBtn && (dom.upgradeBtn.style.display = 'none');
  } else {
    dom.premiumBadge.innerHTML = `<i class="fas fa-crown"></i> <span class="premium-text">Бесплатная версия</span> <span class="premium-limit">(лимит: ${FREE_LIMIT})</span>`;
    dom.upgradeBtn && (dom.upgradeBtn.style.display = 'inline-flex');
  }
}

function updateLimitDisplay() {
  if (!dom.limitCount) return;
  dom.limitCount.textContent = isPremiumActive() ? '∞' : `${subscriptions.length}/${FREE_LIMIT}`;
  if (dom.limitBox) {
    if (!isPremiumActive() && subscriptions.length >= FREE_LIMIT) {
      dom.limitBox.style.background = '#fff0f0';
      dom.limitBox.style.borderColor = '#ff6b6b';
    } else {
      dom.limitBox.style.background = '';
      dom.limitBox.style.borderColor = '';
    }
  }
}

function updateReminders() {
  if (!dom.todaySubs || !dom.expiringSubs) return;
  const today = new Date();
  const todayCount = subscriptions.filter(s => (new Date(s.nextDate)).toDateString() === today.toDateString()).length;
  const expiringCount = subscriptions.filter(s => {
    const days = Math.ceil(((new Date(s.nextDate)) - today) / (1000*60*60*24));
    return days > 0 && days <= 7;
  }).length;
  dom.todaySubs.textContent = `${todayCount} списаний сегодня`;
  dom.expiringSubs.textContent = `${expiringCount} скоро списывается`;
  if (dom.reminderBanner) dom.reminderBanner.style.display = (todayCount>0 || expiringCount>0) ? 'flex' : 'none';
}

// ========== UTIL ==========
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function getCycleText(c) {
  return { monthly:'Ежемесячно', yearly:'Ежегодно', weekly:'Еженедельно', quarterly:'Ежеквартально' }[c] || c;
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function isPremiumActive() {
  if (!userData || !userData.premium) return false;
  if (!userData.premiumUntil) return false;
  return new Date(userData.premiumUntil) > new Date();
}
function updateLimitDisplay() {
  if (!dom.limitCount) return;
  // показываем ∞ только если премиум реально активен
  dom.limitCount.textContent = isPremiumActive() ? '∞' : `${subscriptions.length}/${FREE_LIMIT}`;

  if (dom.limitBox) {
    // подсветка красным если достигнут лимит
    if (!isPremiumActive() && subscriptions.length >= FREE_LIMIT) {
      dom.limitBox.style.background = '#fff0f0';
      dom.limitBox.style.borderColor = '#ff6b6b';
    } else {
      dom.limitBox.style.background = '';
      dom.limitBox.style.borderColor = '';
    }
  }
}
