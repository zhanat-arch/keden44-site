const API = 'https://api.keden44.com/v1/telegram';
const GOOGLE_CLIENT_ID = '57476430330-a9mvuo5sh4gec820jtd1u5ldcgrm8tpn.apps.googleusercontent.com';
const TOKEN_KEY = 'keden44-admin-google-token';
const $ = selector => document.querySelector(selector);
let credential = sessionStorage.getItem(TOKEN_KEY) || '';

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? '');
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function money(values = {}) {
  const entries = Object.entries(values).filter(([, amount]) => Number(amount));
  return entries.length ? entries.map(([currency, amount]) => `${Number(amount).toLocaleString('ru-RU')} ${currency}`).join(' · ') : '0';
}

function stateLabel(value) {
  const labels = { confirmed: 'Подтверждена', provisional: 'Проверяется', searching: 'Ищем оплату', none: 'Нет', active: 'Активен', open_test: 'Тест' };
  return labels[value] || value || '—';
}

function stateClass(value) {
  if (['confirmed', 'active'].includes(value)) return 'state ok';
  if (['provisional', 'searching', 'open_test'].includes(value)) return 'state wait';
  return 'state';
}

function cell(row, value, className = '') {
  const td = document.createElement('td');
  td.textContent = value;
  if (className) td.className = className;
  row.append(td);
  return td;
}

function renderActivity(items = []) {
  const chart = $('#activityChart');
  chart.replaceChildren();
  const max = Math.max(1, ...items.map(item => Number(item.users) || 0));
  for (const item of items) {
    const day = document.createElement('div');
    day.className = 'chartDay';
    day.title = `${item.date}: пользователей ${item.users}, устройств ${item.devices}, Telegram ${item.telegramUsers}`;
    const bar = document.createElement('i');
    bar.style.height = `${Math.max(2, (Number(item.users) || 0) / max * 100)}%`;
    const value = document.createElement('b');
    value.textContent = item.users;
    const label = document.createElement('span');
    label.textContent = item.date.slice(8, 10);
    day.append(value, bar, label);
    chart.append(day);
  }
  if (!items.length) chart.textContent = 'История активности начнёт заполняться после обновления сервера.';
}

function renderUsers(users = []) {
  const body = $('#usersBody');
  body.replaceChildren();
  for (const user of users) {
    const row = document.createElement('tr');
    const identity = cell(row, '');
    identity.className = 'person';
    const name = document.createElement('strong');
    name.textContent = user.name || user.email || 'Пользователь';
    const email = document.createElement('small');
    email.textContent = `${user.email || 'без почты'} · устройств: ${user.deviceCount}`;
    identity.append(name, email);
    cell(row, dateTime(user.lastSeenAt));
    const sync = cell(row, user.googleSync ? `Да · записей ${user.recordCount}` : 'Нет');
    sync.className = user.googleSync ? 'state ok' : 'state';
    const telegram = cell(row, user.telegram ? 'Подключён' : 'Нет');
    telegram.className = user.telegram ? 'state ok' : 'state';
    cell(row, user.watchCount);
    const subscription = cell(row, stateLabel(user.subscription));
    subscription.className = stateClass(user.subscription);
    body.append(row);
  }
  if (!users.length) {
    const row = document.createElement('tr');
    const empty = cell(row, 'Подтверждённых пользователей пока нет.', 'emptyRow');
    empty.colSpan = 6;
    body.append(row);
  }
}

function renderPayments(payments = []) {
  const body = $('#paymentsBody');
  body.replaceChildren();
  for (const payment of payments) {
    const row = document.createElement('tr');
    cell(row, dateTime(payment.createdAt));
    cell(row, payment.email || 'Анонимное устройство');
    cell(row, `${Number(payment.amount || 0).toLocaleString('ru-RU')} ${payment.currency || ''}`.trim());
    const status = cell(row, stateLabel(payment.status));
    status.className = stateClass(payment.status);
    const access = cell(row, stateLabel(payment.access));
    access.className = stateClass(payment.access);
    body.append(row);
  }
  if (!payments.length) {
    const row = document.createElement('tr');
    const empty = cell(row, 'Заявок на оплату пока нет.', 'emptyRow');
    empty.colSpan = 5;
    body.append(row);
  }
}

function render(data) {
  const metrics = data.metrics || {};
  setText('usersTotal', metrics.users || 0);
  setText('activeToday', metrics.activeToday || 0);
  setText('active24h', metrics.activeUsers || 0);
  setText('googleSync', metrics.googleSyncUsers || 0);
  setText('telegramUsers', metrics.telegramUsers || 0);
  setText('subscriptions', metrics.subscriptions || 0);
  setText('incomeTotal', money(metrics.income));
  setText('incomeToday', money(metrics.incomeToday));
  setText('devices', metrics.devices || 0);
  setText('anonymousDevices', metrics.anonymousDevices || 0);
  setText('watchedDeclarations', metrics.watchedDeclarations || 0);
  setText('newToday', metrics.newUsersToday || 0);
  setText('botStatus', data.bot?.running ? `работает @${data.bot.username || ''}` : 'не работает');
  setText('generatedAt', `Обновлено ${dateTime(data.generatedAt)}`);
  setText('usersCount', `Всего: ${data.users?.length || 0}`);
  setText('paymentsCount', `Заявок: ${data.payments?.length || 0}`);
  setText('adminIdentity', data.admin?.email || '');
  renderActivity(data.dailyActivity);
  renderUsers(data.users);
  renderPayments(data.payments);
  $('#authView').hidden = true;
  $('#dashboard').hidden = false;
  $('#refreshBtn').hidden = false;
}

async function loadDashboard() {
  if (!credential) return;
  document.body.classList.add('loading');
  $('#refreshBtn').disabled = true;
  try {
    const response = await fetch(`${API}/admin/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    render(data);
  } catch (error) {
    if (['admin_only', 'Google не подтвердил аккаунт'].includes(error.message)) {
      credential = '';
      sessionStorage.removeItem(TOKEN_KEY);
      $('#dashboard').hidden = true;
      $('#authView').hidden = false;
    }
    setText('authStatus', error.message === 'admin_only' ? 'Этот Google-аккаунт не является администратором.' : `Не удалось загрузить админку: ${error.message}`);
  } finally {
    document.body.classList.remove('loading');
    $('#refreshBtn').disabled = false;
  }
}

function initializeGoogle() {
  if (!window.google?.accounts?.id) return setTimeout(initializeGoogle, 250);
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback(response) {
      credential = response.credential;
      sessionStorage.setItem(TOKEN_KEY, credential);
      setText('authStatus', 'Проверяю доступ...');
      loadDashboard();
    }
  });
  window.google.accounts.id.renderButton($('#googleButton'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
}

$('#refreshBtn').addEventListener('click', loadDashboard);
initializeGoogle();
if (credential) loadDashboard();
