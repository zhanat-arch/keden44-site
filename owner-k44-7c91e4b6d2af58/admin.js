const API = 'https://api.keden44.com/v1/telegram';
const GOOGLE_CLIENT_ID = '57476430330-a9mvuo5sh4gec820jtd1u5ldcgrm8tpn.apps.googleusercontent.com';
const TOKEN_KEY = 'keden44-admin-google-token';
const $ = selector => document.querySelector(selector);
let credential = sessionStorage.getItem(TOKEN_KEY) || '';
let runtimeConfig = null;
let selectedPromotion = -1;

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

function renderSupport(tickets = []) {
  const body = $('#supportBody');
  body.replaceChildren();
  for (const ticket of tickets) {
    const row = document.createElement('tr');
    cell(row, dateTime(ticket.createdAt));
    const priority = cell(row, ticket.priority === 'urgent' ? 'Срочный' : 'Обычный');
    priority.className = ticket.priority === 'urgent' ? 'state bad' : 'state';
    cell(row, ticket.contact || ticket.username || '—');
    cell(row, ticket.text);
    const status = cell(row, ticket.status === 'answered' ? 'Отвечено' : 'В очереди');
    status.className = ticket.status === 'answered' ? 'state ok' : 'state wait';
    body.append(row);
  }
  if (!tickets.length) {
    const row = document.createElement('tr');
    const empty = cell(row, 'Вопросов пока нет.', 'emptyRow');
    empty.colSpan = 5;
    body.append(row);
  }
}

function extensionState(reason) {
  const labels = {
    ok: 'Связь работает',
    'tab-closed': 'Вкладка закрыта',
    'tab-discarded': 'Вкладка выгружена',
    'login-or-loading': 'Нужен вход в KEDEN',
    'session-expired': 'Сессия закончилась',
    session: 'KEDEN не отвечает',
    'extension-error': 'Ошибка расширения'
  };
  return labels[reason] || reason || 'Нет данных';
}

function renderExtensions(installations = []) {
  const body = $('#extensionsBody');
  body.replaceChildren();
  for (const installation of installations) {
    const row = document.createElement('tr');
    cell(row, String(installation.installationId || '').slice(0, 8) || '—');
    cell(row, dateTime(installation.lastSeenAt));
    const online = cell(row, installation.online ? 'На связи' : 'Нет сигнала');
    online.className = installation.online ? 'state ok' : 'state wait';
    const keden = cell(row, extensionState(installation.lastState?.reason));
    keden.className = installation.lastState?.ok ? 'state ok' : 'state wait';
    cell(row, installation.lastState?.version || '—');
    cell(row, installation.sampleCount || 0);
    body.append(row);
  }
  if (!installations.length) {
    const row = document.createElement('tr');
    const empty = cell(row, 'Сигналы от расширений ещё не поступали.', 'emptyRow');
    empty.colSpan = 6;
    body.append(row);
  }
}

function renderAdminProbes(items = []) {
  const body = $('#adminProbesBody');
  body.replaceChildren();
  for (const item of items) {
    const row = document.createElement('tr');
    cell(row, dateTime(item.visitedAt));
    cell(row, item.visitorId || '—');
    cell(row, item.browser || '—');
    cell(row, item.platform || '—');
    body.append(row);
  }
  if (!items.length) {
    const row = document.createElement('tr');
    const empty = cell(row, 'На обычный адрес /admin/ пока никто не заходил.', 'emptyRow');
    empty.colSpan = 4;
    body.append(row);
  }
}

function configText(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

function selectedBlock() {
  return runtimeConfig?.ui?.promotions?.[selectedPromotion] || null;
}

function readPromotionEditor() {
  const block = selectedBlock();
  if (!block) return;
  block.visible = $('#promotionVisible').checked;
  block.placement = $('#promotionPlacement').value;
  block.kind = $('#promotionKind').value;
  block.badge = $('#promotionBadge').value.trim();
  block.title = $('#promotionTitle').value.trim();
  block.text = $('#promotionText').value.trim();
  block.imageUrl = $('#promotionImageUrl').value.trim();
  block.linkUrl = $('#promotionLinkUrl').value.trim();
  block.linkLabel = $('#promotionLinkLabel').value.trim();
  block.maxHeight = Math.max(80, Math.min(600, Number($('#promotionMaxHeight').value) || 180));
}

function renderPromotionPreview() {
  readPromotionEditor();
  const block = selectedBlock();
  const preview = $('#promotionPreview');
  preview.replaceChildren();
  if (!block) return;
  preview.className = `promotionPreview kind-${block.kind || 'notice'}`;
  const badge = document.createElement('small');
  badge.textContent = block.badge || (block.kind === 'ad' ? 'Реклама' : 'Новости');
  const content = document.createElement('div');
  if (block.imageUrl) {
    const image = document.createElement('img');
    image.src = block.imageUrl;
    image.alt = '';
    content.append(image);
  }
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = block.title || 'Заголовок блока';
  const description = document.createElement('p');
  description.textContent = block.text || 'Текст появится здесь.';
  copy.append(title, description);
  if (block.linkUrl) {
    const link = document.createElement('span');
    link.className = 'previewLink';
    link.textContent = block.linkLabel || 'Подробнее';
    copy.append(link);
  }
  content.append(copy);
  preview.append(badge, content);
}

function renderPromotionEditor() {
  const block = selectedBlock();
  $('#emptyPromotion').hidden = Boolean(block);
  $('#promotionFields').hidden = !block;
  if (!block) return;
  $('#promotionVisible').checked = block.visible !== false;
  configText('promotionPlacement', block.placement || 'footer');
  configText('promotionKind', block.kind || 'notice');
  configText('promotionBadge', block.badge);
  configText('promotionTitle', block.title);
  configText('promotionText', block.text);
  configText('promotionImageUrl', block.imageUrl);
  configText('promotionLinkUrl', block.linkUrl);
  configText('promotionLinkLabel', block.linkLabel);
  configText('promotionMaxHeight', block.maxHeight || 180);
  $('#movePromotionUp').disabled = selectedPromotion <= 0;
  $('#movePromotionDown').disabled = selectedPromotion >= runtimeConfig.ui.promotions.length - 1;
  renderPromotionPreview();
}

function renderPromotionList() {
  const list = $('#promotionList');
  list.replaceChildren();
  const items = runtimeConfig?.ui?.promotions || [];
  items.forEach((block, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `promotionListItem${index === selectedPromotion ? ' selected' : ''}`;
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = block.title || 'Без заголовка';
    const meta = document.createElement('small');
    meta.textContent = `${block.badge || 'Без метки'} · ${block.visible === false ? 'выключен' : 'включён'}`;
    copy.append(title, meta);
    const order = document.createElement('b');
    order.textContent = String(index + 1);
    button.append(order, copy);
    button.addEventListener('click', () => {
      readPromotionEditor();
      selectedPromotion = index;
      renderPromotionList();
      renderPromotionEditor();
    });
    list.append(button);
  });
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'listEmpty';
    empty.textContent = 'Блоков пока нет.';
    list.append(empty);
  }
}

function renderModules() {
  const list = $('#moduleList');
  list.replaceChildren();
  const labels = {
    attachment: 'Прикрепление файлов', monitor: 'Монитор', notifications: 'Уведомления', promotions: 'Контентные блоки',
    'dt-download': 'Загрузка ДТ', 'kdt-download': 'Загрузка КДТ', 'payment-preview': 'Снимок платежей',
    'request-download': 'Загрузка запроса', 'frro-download': 'Загрузка ФРРО'
  };
  for (const module of runtimeConfig?.modules || []) {
    const label = document.createElement('label');
    label.className = 'toggle moduleToggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = module.enabled !== false;
    input.addEventListener('change', () => { module.enabled = input.checked; });
    const text = document.createElement('span');
    text.textContent = labels[module.id] || module.id;
    label.append(input, text);
    list.append(label);
  }
}

function renderRuntimeConfig(config) {
  runtimeConfig = structuredClone(config);
  runtimeConfig.ui ||= {};
  runtimeConfig.ui.promotions ||= [];
  runtimeConfig.modules ||= [];
  selectedPromotion = runtimeConfig.ui.promotions.length ? 0 : -1;
  setText('configVersion', `Версия: ${runtimeConfig.version || 1}`);
  renderPromotionList();
  renderPromotionEditor();
  renderModules();
}

async function configRequest(path, payload = {}) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function loadRuntimeConfig() {
  const data = await configRequest('/admin/config/get');
  renderRuntimeConfig(data.config);
  setText('configStatus', 'Конфигурация загружена с сервера.');
}

async function saveRuntimeConfig() {
  readPromotionEditor();
  const button = $('#saveConfig');
  button.disabled = true;
  setText('configStatus', 'Сохраняю...');
  try {
    const data = await configRequest('/admin/config/save', { config: runtimeConfig });
    const selectedId = selectedBlock()?.id;
    renderRuntimeConfig(data.config);
    const restoredIndex = runtimeConfig.ui.promotions.findIndex(item => item.id === selectedId);
    if (restoredIndex >= 0) selectedPromotion = restoredIndex;
    renderPromotionList();
    renderPromotionEditor();
    setText('configStatus', `Сохранено. Новая версия: ${data.config.version}. Расширения получат её не позднее чем через 5 минут.`);
  } catch (error) {
    setText('configStatus', `Не удалось сохранить: ${error.message}`);
  } finally {
    button.disabled = false;
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
  setText('supportCount', `Открытых: ${metrics.openSupportTickets || 0}`);
  setText('adminProbesCount', `Заходов: ${data.adminProbes?.length || 0}`);
  setText('adminIdentity', data.admin?.email || '');
  renderActivity(data.dailyActivity);
  renderUsers(data.users);
  renderPayments(data.payments);
  renderSupport(data.supportTickets);
  renderExtensions(data.extensionDiagnostics);
  renderAdminProbes(data.adminProbes);
  $('#authView').hidden = true;
  $('#dashboard').hidden = false;
  $('#refreshBtn').hidden = false;
}

async function downloadExtensionDiagnostics() {
  const button = $('#downloadExtensionDiagnostics');
  button.disabled = true;
  try {
    const response = await fetch(`${API}/admin/extension-diagnostics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `KEDEN44-extension-journal-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    setText('authStatus', `Не удалось скачать журнал: ${error.message}`);
  } finally {
    button.disabled = false;
  }
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
    await loadRuntimeConfig();
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
$('#downloadExtensionDiagnostics').addEventListener('click', downloadExtensionDiagnostics);
$('#saveConfig').addEventListener('click', saveRuntimeConfig);
$('#addPromotion').addEventListener('click', () => {
  readPromotionEditor();
  runtimeConfig.ui.promotions.push({
    id: `block-${Date.now()}`,
    visible: true,
    placement: 'footer',
    kind: 'notice',
    badge: 'Новости',
    title: 'Новый блок',
    text: '',
    imageUrl: '',
    linkUrl: '',
    linkLabel: 'Подробнее',
    maxHeight: 180
  });
  selectedPromotion = runtimeConfig.ui.promotions.length - 1;
  renderPromotionList();
  renderPromotionEditor();
});
$('#deletePromotion').addEventListener('click', () => {
  if (!selectedBlock() || !confirm('Удалить этот блок из конфигурации?')) return;
  runtimeConfig.ui.promotions.splice(selectedPromotion, 1);
  selectedPromotion = Math.min(selectedPromotion, runtimeConfig.ui.promotions.length - 1);
  renderPromotionList();
  renderPromotionEditor();
});
$('#movePromotionUp').addEventListener('click', () => {
  readPromotionEditor();
  if (selectedPromotion <= 0) return;
  [runtimeConfig.ui.promotions[selectedPromotion - 1], runtimeConfig.ui.promotions[selectedPromotion]] = [runtimeConfig.ui.promotions[selectedPromotion], runtimeConfig.ui.promotions[selectedPromotion - 1]];
  selectedPromotion -= 1;
  renderPromotionList();
  renderPromotionEditor();
});
$('#movePromotionDown').addEventListener('click', () => {
  readPromotionEditor();
  if (selectedPromotion >= runtimeConfig.ui.promotions.length - 1) return;
  [runtimeConfig.ui.promotions[selectedPromotion + 1], runtimeConfig.ui.promotions[selectedPromotion]] = [runtimeConfig.ui.promotions[selectedPromotion], runtimeConfig.ui.promotions[selectedPromotion + 1]];
  selectedPromotion += 1;
  renderPromotionList();
  renderPromotionEditor();
});
$('#promotionEditor').addEventListener('input', renderPromotionPreview);
$('#promotionEditor').addEventListener('change', renderPromotionPreview);
initializeGoogle();
if (credential) loadDashboard();
