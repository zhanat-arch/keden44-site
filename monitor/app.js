import { conditionalReleaseDeadline, daysUntil, declarationNumberParts, declarationSectionFromDtNumber, esc, isCleared, isConditionalRelease, isReleased, statusKind, dtFromFileName, isRecentRelease, needsAttention, parseReleaseDate, submissionDateFromDtNumber } from './modules/core/dt.js';
import { notificationForChange } from './modules/core/notifications.js';
import { relatedDeclarationParts, shipmentGroupKey } from './modules/core/shipment.js';
import { createImportQueue } from './modules/import/queue.js';
import { requestKedenCheck } from './modules/keden/client.js';
import { parseDeclarationReferences, parseDeclarationSummary, parseStandardDtPage } from './modules/pdf/declaration.js';
import { splitDeclarationNumber, splitOrganizationName } from './modules/core/privacy.js';
import { deleteFirstPagePreview, deleteSupportDocument, getFirstPagePreview, getSupportDocument, saveFirstPagePreview, saveSupportDocument } from './modules/storage/previews.js';
import { recordMatchesQuery } from './modules/core/search.js';
import { createTelegramClient } from './modules/telegram/client.js';

(() => {
    const KEY = 'dt-board-records-v6';
    const SETTINGS_KEY = 'dt-board-settings-v1';
    const GOOGLE_CLIENT_ID = '57476430330-a9mvuo5sh4gec820jtd1u5ldcgrm8tpn.apps.googleusercontent.com';
    const $ = (selector) => document.querySelector(selector);
    const els = {
      addBtn: $('#addBtn'), importPdfBtn: $('#importPdfBtn'), pdfInput: $('#pdfInput'), jsonInput: $('#jsonInput'), importJsonBtn: $('#importJsonBtn'), notifyBtn: $('#notifyBtn'), telegramBtn: $('#telegramBtn'), telegramStatus: $('#telegramStatus'), googleSignIn: $('#googleSignIn'), exportBtn: $('#exportBtn'), checkAllBtn: $('#checkAllBtn'),
      searchInput: $('#searchInput'), declarantBinFilter: $('#declarantBinFilter'), scopeSelect: $('#scopeSelect'), releasePeriod: $('#releasePeriod'), resetFiltersBtn: $('#resetFiltersBtn'), workInterval: $('#workInterval'), releasedInterval: $('#releasedInterval'), recentDays: $('#recentDays'), conditionalDays: $('#conditionalDays'), checkDueBtn: $('#checkDueBtn'), line: $('#line'), summary: $('#summary'),
      notifyReleased: $('#notifyReleased'), notifyStatusChanges: $('#notifyStatusChanges'), notifyDataChanges: $('#notifyDataChanges'), notifyProblems: $('#notifyProblems'), notifyConditional: $('#notifyConditional'),
      showDeclarant: $('#showDeclarant'), showTransport: $('#showTransport'), showGoods: $('#showGoods'), showSender: $('#showSender'), showReceiver: $('#showReceiver'), privacyMode: $('#privacyMode'),
      entryDialog: $('#entryDialog'), entryForm: $('#entryForm'), dialogTitle: $('#dialogTitle'), closeDialogBtn: $('#closeDialogBtn'), cancelBtn: $('#cancelBtn'),
      extensionDialog: $('#extensionDialog'), extensionForm: $('#extensionForm'), closeExtensionBtn: $('#closeExtensionBtn'), cancelExtensionBtn: $('#cancelExtensionBtn'),
      changed: $('#changed'), work: $('#work'), conditional: $('#conditional'), released: $('#released'), archive: $('#archive'), archiveMoreBtn: $('#archiveMoreBtn'), cc: $('#cc'), cw: $('#cw'), ccond: $('#ccond'), cr: $('#cr'), ca: $('#ca')
    };
    const store = (() => { try { return window.localStorage || null; } catch { return null; } })();
    const telegram = createTelegramClient({ storage: store });
    const now = () => new Date().toLocaleString('ru-RU');
    const seed = [];
    let records = normalizeStoredRecords(loadRecords());
    let settings = loadSettings();
    let query = '';
    let declarantBinFilter = '';
    let releasePeriod = 'all';
    let scope = 'all';
    let archiveVisibleCount = 20;
    let dueCheckRunning = false;
    let telegramSyncTimer;
    let cloudSyncTimer;
    let googleConnected = false;
    let googleCloudLoaded = false;

    function loadRecords() { try { const saved = store && store.getItem(KEY); return saved ? JSON.parse(saved) : seed; } catch { return seed; } }
    function normalizeStoredRecords(items) {
      const output = [];
      const mainByNumber = new Map();
      const corrections = [];

      for (const item of items) {
        if (item.status === 'Нужна проверка' && item.kedenUrl
          && !(item.logs || []).some(line => /KEDEN проверен|Проверка KEDEN/i.test(line))) {
          item.checkedAt = '';
          item.lastChecked = '';
        }
        const number = declarationNumberParts(item.dtNumber);
        if (number.isCorrection) corrections.push({ item, number });
        else {
          output.push(item);
          if (number.baseNumber) mainByNumber.set(number.baseNumber, item);
        }
      }

      for (const { item, number } of corrections) {
        const main = mainByNumber.get(number.baseNumber);
        if (main && !main.requiresMainDt) {
          main.corrections = [...new Set([...(main.corrections || []), number.fullNumber])];
          main.history = [...(main.history || []), now() + ': распознана КДТ ' + number.fullNumber + ', основной QR сохранён'];
          continue;
        }
        const migrated = {
          ...item,
          dtNumber: number.baseNumber,
          kdtNumber: number.fullNumber,
          corrections: [...new Set([...(item.corrections || []), number.fullNumber])],
          requiresMainDt: true,
          correctionKedenUrl: item.kedenUrl || item.correctionKedenUrl || '',
          kedenUrl: '',
          status: 'Нужна основная ДТ',
          description: 'Загружена КДТ ' + number.fullNumber + '. Загрузите основной PDF ДТ ' + number.baseNumber + ' без /' + number.correctionIndex + '.'
        };
        output.push(migrated);
        mainByNumber.set(number.baseNumber, migrated);
      }
      return output;
    }
    function loadSettings() {
      const defaults = { workMinutes: 15, releasedHours: 6, recentDays: 3, conditionalDays: 60, notifyReleased: true, notifyStatusChanges: false, notifyDataChanges: false, notifyProblems: true, notifyConditional: true, showDeclarant: true, showTransport: true, showGoods: true, showSender: false, showReceiver: false, privacyMode: false };
      try {
        const saved = store && store.getItem(SETTINGS_KEY);
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
      } catch {
        return defaults;
      }
    }
    function persistentRecords() { return records.filter(record => !record.transientDuplicate); }
    function saveRecords() { try { if (store) store.setItem(KEY, JSON.stringify(persistentRecords())); } catch {} scheduleTelegramSync(); scheduleCloudSync(); }
    function saveSettings() { try { if (store) store.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} scheduleCloudSync(); }
    function importTransferFromUrl() {
      const params = new URLSearchParams(location.search);
      if (params.get('source') !== 'extension') return '';
      const action = params.get('action') || 'watch';
      const dtNumber = declarationNumberParts(params.get('dt') || '').baseNumber;
      const qrCandidate = params.get('qr') || '';
      let kedenUrl = '';
      try {
        const parsed = new URL(qrCandidate);
        if (parsed.protocol === 'https:' && parsed.hostname === 'keden.kgd.gov.kz' && parsed.pathname === '/qrpage') kedenUrl = parsed.toString();
      } catch {}
      history.replaceState({}, '', location.pathname + location.hash);
      if (!/^\d{5}\/\d{6}\/\d{7}$/.test(dtNumber)) return 'Расширение открыло монитор, но номер ДТ прочитать не удалось';
      const existing = records.find(record => declarationNumberParts(record.dtNumber).baseNumber === dtNumber);
      if (action === 'unwatch') {
        if (!existing) return 'ДТ ' + dtNumber + ' не была добавлена в монитор';
        existing.archived = true;
        existing.updatedAt = new Date().toISOString();
        existing.history = [...(existing.history || []), now() + ': наблюдение остановлено из расширения'];
        return 'Наблюдение за ДТ ' + dtNumber + ' остановлено';
      }
      if (existing) {
        if (kedenUrl && !existing.kedenUrl) existing.kedenUrl = kedenUrl;
        existing.archived = false;
        existing.updatedAt = new Date().toISOString();
        existing.history = [...(existing.history || []), now() + ': повторно передана из расширения'];
        return 'ДТ ' + dtNumber + ' уже была в мониторе';
      }
      records.unshift({
        id: crypto.randomUUID(),
        name: 'ДТ ' + dtNumber,
        dtNumber,
        status: 'Добавлена в монитор',
        releaseDate: '',
        kedenUrl,
        changed: false,
        archived: false,
        lastChecked: '',
        checkedAt: '',
        updatedAt: new Date().toISOString(),
        logs: [now() + ' | Добавлена из расширения KEDEN44'],
        history: [now() + ': передана из открытой ДТ в расширении'],
      });
      return 'ДТ ' + dtNumber + ' добавлена. Проверка статуса начнётся автоматически';
    }
    function isRevokedStatus(status = '') { return /отозван|аннулирован/i.test(String(status)); }
    function isTerminalStatus(status = '') { return isReleased(status) || isRevokedStatus(status); }
    function checkIntervalMs(record) { return isConditionalRelease(record.status) ? Number(settings.releasedHours || 6) * 3600000 : Number(settings.workMinutes || 15) * 60000; }
    function isDue(record) { if (record.archived || !record.kedenUrl || isTerminalStatus(record.status)) return false; const last = Date.parse(record.checkedAt || record.updatedAt || 0); return !last || Date.now() - last >= checkIntervalMs(record); }
    function nextCheckText(record) { if (record.archived) return 'архив'; if (isTerminalStatus(record.status)) return 'проверки завершены'; if (!record.kedenUrl) return 'нет QR'; const last = Date.parse(record.checkedAt || record.updatedAt || 0); if (!last) return 'сейчас'; const next = last + checkIntervalMs(record); return Date.now() >= next ? 'сейчас' : new Date(next).toLocaleString('ru-RU'); }
    function conditionalInfo(record) {
      if (!isConditionalRelease(record.status)) return null;
      const extended = /^\d{4}-\d{2}-\d{2}$/.test(record.conditionalExtendedUntil || '')
        ? new Date(record.conditionalExtendedUntil + 'T00:00:00')
        : null;
      const deadline = extended || conditionalReleaseDeadline(record.dtNumber, settings.conditionalDays);
      return deadline ? { deadline, remaining: daysUntil(deadline) } : null;
    }
    function conditionalNeedsAttention(record) { const info = conditionalInfo(record); return Boolean(info && info.remaining <= 7); }
    function recordNeedsAttention(record) { return needsAttention(record) || conditionalNeedsAttention(record); }
    function matches(record) { if (!recordMatchesQuery(record, query)) return false; if (declarantBinFilter && !String(record.declarantBin || '').includes(declarantBinFilter)) return false; if (releasePeriod !== 'all') { const date = parseReleaseDate(record.releaseDate); if (!date || Date.now() - date.getTime() > Number(releasePeriod) * 86400000) return false; } if (scope === 'active') return !record.archived; if (scope === 'changed') return recordNeedsAttention(record); if (scope === 'conditional') return !record.archived && isConditionalRelease(record.status); if (scope === 'work') return !record.archived && !recordNeedsAttention(record) && !['released', 'conditional'].includes(statusKind(record.status)); if (scope === 'released') return !record.archived && statusKind(record.status) === 'released'; return true; }
    function grouped() { const out = { changed: [], work: [], conditional: [], released: [], archive: [] }; records.filter(matches).forEach(r => { if (r.archived) out.archive.push(r); else if (recordNeedsAttention(r)) out.changed.push(r); else if (statusKind(r.status) === 'conditional') out.conditional.push(r); else if (statusKind(r.status) === 'released' && isRecentRelease(r.releaseDate, settings.recentDays)) out.released.push(r); else if (statusKind(r.status) === 'released') out.archive.push(r); else out.work.push(r); }); return out; }

    function sortWithShipmentGroups(items, score, ascending = false) {
      const anchors = new Map();
      for (const item of items) {
        const key = shipmentGroupKey(item);
        if (!key) continue;
        const value = score(item);
        const previous = anchors.get(key);
        anchors.set(key, previous === undefined ? value : ascending ? Math.min(previous, value) : Math.max(previous, value));
      }
      return [...items].sort((a, b) => {
        const keyA = shipmentGroupKey(a);
        const keyB = shipmentGroupKey(b);
        const valueA = keyA ? anchors.get(keyA) : score(a);
        const valueB = keyB ? anchors.get(keyB) : score(b);
        if (valueA !== valueB) return ascending ? valueA - valueB : valueB - valueA;
        if (keyA && keyA === keyB) return declarationSectionFromDtNumber(a.dtNumber).localeCompare(declarationSectionFromDtNumber(b.dtNumber), 'ru');
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
    }

    function render() { const g = grouped(); const sortedArchive = sortWithShipmentGroups(g.archive, record => submissionDateFromDtNumber(record.dtNumber)?.getTime() || new Date(record.updatedAt || 0).getTime()); const visibleArchive = sortedArchive.slice(0, archiveVisibleCount); els.summary.innerHTML = [['Всего', records.length], ['Активные', g.work.length + g.conditional.length], ['Требуют внимания', records.filter(recordNeedsAttention).length], ['Условный выпуск', records.filter(r => !r.archived && isConditionalRelease(r.status)).length], ['Выпущены', records.filter(r => isReleased(r.status)).length]].map(([label, value]) => '<div class="sum"><b>' + value + '</b><span>' + label + '</span></div>').join(''); draw(els.changed, g.changed); draw(els.work, g.work); draw(els.conditional, g.conditional, true); draw(els.released, g.released); draw(els.archive, visibleArchive, false, true); const archiveRemaining = sortedArchive.length - visibleArchive.length; els.archiveMoreBtn.hidden = archiveRemaining <= 0; els.archiveMoreBtn.textContent = archiveRemaining > 0 ? 'Показать ещё (' + archiveRemaining + ')' : ''; els.cc.textContent = g.changed.length; els.cw.textContent = g.work.length; els.ccond.textContent = g.conditional.length; els.cr.textContent = g.released.length; els.ca.textContent = g.archive.length; }
    function draw(container, items, sortByDeadline = false, preserveOrder = false) {
      container.innerHTML = '';
      if (!items.length) {
        container.innerHTML = '<p class="empty">Пусто</p>';
        return;
      }
      const orderedItems = preserveOrder
        ? items
        : sortByDeadline
          ? sortWithShipmentGroups(items, record => conditionalInfo(record)?.deadline?.getTime() || Infinity, true)
          : sortWithShipmentGroups(items, record => new Date(record.updatedAt || 0).getTime());
      orderedItems.forEach(record => {
        const node = card(record);
        node.querySelector('[data-action="clear"]').hidden = !record.changed;
        container.appendChild(node);
      });
    }
    function privateHtml(value) { return '<span class="privateData">' + esc(value) + '</span>'; }
    function organizationHtml(value) {
      const organization = splitOrganizationName(value);
      if (!organization.legalForm) return privateHtml(organization.name);
      return '<span class="organizationForm">' + esc(organization.legalForm) + '</span>' + (organization.name ? ' ' + privateHtml(organization.name) : '');
    }
    function cardValueHtml(key, value) {
      if (['Декларант', 'Отправитель', 'Получатель'].includes(key)) return organizationHtml(value);
      if (key === 'Дата выпуска') return esc(value);
      return privateHtml(value);
    }
    function declarationNumberHtml(value) {
      const number = splitDeclarationNumber(value || 'ДТ не указана');
      return esc(number.prefix) + (number.privateTail ? privateHtml(number.privateTail) : '') + esc(number.suffix);
    }
    function card(record) {
      const pillClass = statusKind(record.status) === 'problem' || conditionalNeedsAttention(record) ? 'bad' : statusKind(record.status) === 'released' ? 'ok' : 'warn';
      const meta = [
        ['Дата выпуска', record.releaseDate],
        ['Декларант', settings.showDeclarant && record.declarant],
        ['БИН декларанта', settings.showDeclarant && record.declarantBin],
        ['Транспорт', settings.showTransport && [record.transport, record.containers?.length ? 'контейнер ' + record.containers.join(', ') : record.container ? 'контейнер ' + record.container : ''].filter(Boolean).join(' · ')],
        ['Отправитель', settings.showSender && record.sender],
        ['Получатель', settings.showReceiver && record.receiver],
        ['Первый товар', settings.showGoods && record.goods]
      ].filter(([, value]) => value).map(([key, value]) => '<div class="' + (key === 'Первый товар' ? 'goodsPreview' : '') + '"><span>' + key + ':</span> ' + cardValueHtml(key, value) + '</div>').join('');
      const relatedParts = relatedDeclarationParts(record, records);
      const recordSection = declarationSectionFromDtNumber(record.dtNumber);
      const relationshipHtml = relatedParts.length
        ? '<div class="relationshipText">Часть ' + esc(recordSection) + ' · ' + relatedParts.map(part => esc('часть ' + declarationSectionFromDtNumber(part.dtNumber) + ': ' + (part.status || 'без статуса'))).join(' · ') + '</div>'
        : '';
      const detailsMeta = [
        ['Имя загруженного файла', record.name],
        ['Таможенный пост / описание', record.description],
        ['Общая таможенная стоимость KEDEN', record.customsValue],
        ['Вес нетто / брутто', [record.netWeight, record.grossWeight].filter(Boolean).join(' / ')],
        ['Инвойс', record.invoice],
        ['Контейнер', record.containers?.join(', ') || record.container],
        ['ТН ВЭД', record.tnved],
        ['БИН получателя', record.receiverBin],
        ['Первый товар полностью', record.goods],
        ['Продлено до', record.conditionalExtendedUntil ? new Date(record.conditionalExtendedUntil + 'T00:00:00').toLocaleDateString('ru-RU') : ''],
        ['Основание продления', record.conditionalExtensionComment],
        ['Письмо-основание', record.conditionalExtensionLetterName],
        ['Последняя проверка', record.lastChecked],
        ['Следующая проверка', nextCheckText(record)]
      ].filter(([, value]) => value).map(([key, value]) => '<div><span>' + key + ':</span> ' + (['Последняя проверка', 'Следующая проверка'].includes(key) ? esc(value) : privateHtml(value)) + '</div>').join('');
      const info = conditionalInfo(record);
      const deadlineHtml = info ? '<div class="conditionalDeadline"><b>Контроль до ' + info.deadline.toLocaleDateString('ru-RU') + '</b><span>' + (info.remaining < 0 ? 'Просрочено: не очищено в срок · ' + Math.abs(info.remaining) + ' дн.' : info.remaining === 0 ? 'Срок сегодня' : 'Осталось ' + info.remaining + ' дн.') + '</span></div>' : '';
      const history = (record.history || []).slice(-3).map(item => '<div class="privateData">' + esc(item) + '</div>').join('');
      const logBoxHtml = record.logs && record.logs.length ? '<div class="logBox privateData">' + record.logs.slice(-8).map(esc).join('\n') + '</div>' : '';
      const qrPreviewHtml = record.qrImageDataUrl ? '<div class="qrPreview"><img class="privateData" src="' + esc(record.qrImageDataUrl) + '" alt="QR"><span>QR извлечён из PDF и прочитан</span></div>' : '';
      const detailsHtml = '<details class="cardDetails"><summary>Подробнее</summary><div class="detailsBody"><div class="meta">' + detailsMeta + '</div>' + qrPreviewHtml + logBoxHtml + '<div class="hist">' + history + '</div></div></details>';
      const previewButton = record.hasFirstPagePreview ? '<button data-action="preview">1-я страница PDF</button>' : '';
      const extendButton = isConditionalRelease(record.status) ? '<button data-action="extend">Продлить срок</button>' : '';
      const letterButton = record.conditionalExtensionLetterName ? '<button data-action="letter">Письмо</button>' : '';
      const archiveLabel = record.archived ? 'Вернуть' : 'В архив';
      const node = document.createElement('article');
      node.className = 'card';
      const actionsHtml = record.transientDuplicate
        ? '<button data-action="dismiss">Убрать копию</button>'
        : '<button data-action="open">KEDEN</button>' + previewButton + extendButton + letterButton + '<button data-action="check">Проверить</button><button data-action="edit">Править</button><button data-action="clear">Принято</button><button data-action="archive">' + archiveLabel + '</button><button data-action="delete">Удалить</button>';
      node.innerHTML = '<div class="cardTop"><div><h3>' + declarationNumberHtml(record.dtNumber) + '</h3></div><div class="cardBadges"><span class="pill ' + pillClass + '">' + esc(record.status || 'Без статуса') + '</span>' + (record.changed ? '<span class="changeFlag">Новое изменение</span>' : '') + '</div></div>' + relationshipHtml + '<div class="meta primaryMeta">' + meta + '</div>' + deadlineHtml + detailsHtml + '<div class="cardActions">' + actionsHtml + '</div>';
      if (record.transientDuplicate) {
        node.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
          records = records.filter(item => item.id !== record.id);
          render();
        });
        return node;
      }
      node.querySelector('[data-action="open"]').addEventListener('click', () => { if (record.kedenUrl) window.open(record.kedenUrl, '_blank'); else els.line.textContent = 'Нет ссылки KEDEN'; });
      node.querySelector('[data-action="preview"]')?.addEventListener('click', () => openFirstPage(record));
      node.querySelector('[data-action="extend"]')?.addEventListener('click', () => openExtensionForm(record));
      node.querySelector('[data-action="letter"]')?.addEventListener('click', () => openSupportDocument(record));
      node.querySelector('[data-action="check"]').addEventListener('click', () => check(record.id));
      node.querySelector('[data-action="edit"]').addEventListener('click', () => openForm(record));
      node.querySelector('[data-action="clear"]').addEventListener('click', () => clearChanged(record.id));
      node.querySelector('[data-action="archive"]').addEventListener('click', () => toggleArchive(record.id));
      node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRecord(record.id));
      return node;
    }

    function openForm(record = null) { els.entryForm.reset(); els.dialogTitle.textContent = record ? 'Править ДТ' : 'Добавить ДТ'; if (record) Object.entries(record).forEach(([key, value]) => { if (els.entryForm.elements[key]) els.entryForm.elements[key].value = value || ''; }); if (typeof els.entryDialog.showModal === 'function') els.entryDialog.showModal(); else els.entryDialog.setAttribute('open', ''); }
    function closeForm() { if (typeof els.entryDialog.close === 'function') els.entryDialog.close(); else els.entryDialog.removeAttribute('open'); }
    function openExtensionForm(record) {
      els.extensionForm.reset();
      els.extensionForm.elements.id.value = record.id;
      els.extensionForm.elements.extendedUntil.value = record.conditionalExtendedUntil || '';
      els.extensionForm.elements.comment.value = record.conditionalExtensionComment || '';
      els.extensionForm.elements.notifyClient.checked = Boolean(record.notifyClientOnConditionalExtension);
      if (typeof els.extensionDialog.showModal === 'function') els.extensionDialog.showModal(); else els.extensionDialog.setAttribute('open', '');
    }
    function closeExtensionForm() { if (typeof els.extensionDialog.close === 'function') els.extensionDialog.close(); else els.extensionDialog.removeAttribute('open'); }
    async function saveConditionalExtension(event) {
      event.preventDefault();
      const data = new FormData(els.extensionForm);
      const record = records.find(item => item.id === data.get('id'));
      if (!record) return;
      const previousDeadline = conditionalInfo(record)?.deadline;
      const extendedUntil = String(data.get('extendedUntil') || '');
      const letter = data.get('letter');
      record.conditionalExtendedUntil = extendedUntil;
      record.conditionalExtensionComment = String(data.get('comment') || '').trim();
      record.notifyClientOnConditionalExtension = data.get('notifyClient') === 'on';
      if (letter instanceof File && letter.size) {
        await saveSupportDocument(record.id, letter);
        record.conditionalExtensionLetterName = letter.name;
      }
      const formattedDate = new Date(extendedUntil + 'T00:00:00').toLocaleDateString('ru-RU');
      record.updatedAt = new Date().toISOString();
      record.history = [...(record.history || []), now() + ': срок условного выпуска продлён до ' + formattedDate
        + (record.conditionalExtensionComment ? '; ' + record.conditionalExtensionComment : '')
        + (record.conditionalExtensionLetterName ? '; письмо: ' + record.conditionalExtensionLetterName : '')
        + (record.notifyClientOnConditionalExtension ? '; уведомить клиента' : '')];
      record.logs = [...(record.logs || []), now() + ' | Продление срока: '
        + (previousDeadline ? previousDeadline.toLocaleDateString('ru-RU') + ' -> ' : '') + formattedDate];
      saveRecords();
      render();
      closeExtensionForm();
      els.line.textContent = 'Срок условного выпуска продлён до ' + formattedDate;
    }
    async function openSupportDocument(record) {
      const document = await getSupportDocument(record.id);
      if (!document?.blob) { els.line.textContent = 'Письмо не найдено на этом компьютере'; return; }
      const url = URL.createObjectURL(document.blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    function getFormData() { return Object.fromEntries(new FormData(els.entryForm).entries()); }
    function diff(oldRecord, nextRecord) { const labels = { name:'имя', dtNumber:'ДТ', status:'статус', releaseDate:'дата выпуска', declarant:'декларант', declarantBin:'БИН декларанта', transport:'транспорт', containers:'контейнер', sender:'отправитель', receiver:'получатель', receiverBin:'БИН получателя', invoice:'инвойс', tnved:'ТН ВЭД', goods:'товар', customsValue:'стоимость', netWeight:'нетто', grossWeight:'брутто' }; return Object.keys(labels).filter(key => String(oldRecord[key] || '') !== String(nextRecord[key] || '')).map(key => labels[key] + ': "' + (oldRecord[key] || '-') + '" -> "' + (nextRecord[key] || '-') + '"'); }
    function saveForm(event) { event.preventDefault(); const data = getFormData(); let record = records.find(r => r.id === data.id); if (record) { const changes = diff(record, data); Object.assign(record, data, { updatedAt: new Date().toISOString() }); if (changes.length) { record.changed = true; record.history = [...(record.history || []), now() + ': ' + changes.join('; ')]; } } else { records.unshift({ ...data, id: crypto.randomUUID(), changed: false, archived: false, lastChecked: now(), checkedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), logs: [now() + ' | Ручное создание записи'], history: [now() + ': создана запись'] }); } saveRecords(); render(); closeForm(); }


    async function readQrFromPdfBottom(file) {
      if (!window.pdfjsLib || !window.jsQR) return null;
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.4 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const zones = [
        { name: 'bottom', x: 0, y: Math.floor(canvas.height * 0.55), w: canvas.width, h: Math.ceil(canvas.height * 0.45) },
        { name: 'bottom-right', x: Math.floor(canvas.width * 0.45), y: Math.floor(canvas.height * 0.45), w: Math.ceil(canvas.width * 0.55), h: Math.ceil(canvas.height * 0.55) },
        { name: 'full-page', x: 0, y: 0, w: canvas.width, h: canvas.height }
      ];

      for (const zone of zones) {
        const image = ctx.getImageData(zone.x, zone.y, zone.w, zone.h);
        const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
        if (!code?.data) continue;
        const points = [code.location.topLeftCorner, code.location.topRightCorner, code.location.bottomLeftCorner, code.location.bottomRightCorner];
        const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x)) - 12));
        const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y)) - 12));
        const maxX = Math.min(zone.w, Math.ceil(Math.max(...points.map(p => p.x)) + 12));
        const maxY = Math.min(zone.h, Math.ceil(Math.max(...points.map(p => p.y)) + 12));
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = Math.max(1, maxX - minX);
        qrCanvas.height = Math.max(1, maxY - minY);
        qrCanvas.getContext('2d').drawImage(canvas, zone.x + minX, zone.y + minY, qrCanvas.width, qrCanvas.height, 0, 0, qrCanvas.width, qrCanvas.height);
        return { qrUrl: String(code.data).replace(/^"|"$/g, ''), qrImageDataUrl: qrCanvas.toDataURL('image/png'), source: zone.name };
      }
      return null;
    }

    async function captureFirstPage(file) {
      if (!window.PDFLib) return null;
      const original = await window.PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      if (!original.getPageCount()) return null;
      const firstPagePdf = await window.PDFLib.PDFDocument.create();
      const [firstPage] = await firstPagePdf.copyPages(original, [0]);
      firstPagePdf.addPage(firstPage);
      const bytes = await firstPagePdf.save({ useObjectStreams: true });
      return new Blob([bytes], { type: 'application/pdf' });
    }

    async function readDeclarationFields(file) {
      if (!window.pdfjsLib) return {};
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();
      const contentText = pageContent => (pageContent.items || []).map(item => item.str || '').join(' ');
      const lines = new Map();
      for (const item of content.items || []) {
        const y = Math.round(item.transform?.[5] || 0);
        const row = lines.get(y) || [];
        row.push({ x: item.transform?.[4] || 0, text: item.str || '' });
        lines.set(y, row);
      }
      const text = [...lines.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) => row.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
        .join('\n');
      const standardFields = parseStandardDtPage(content.items, page.view[2] - page.view[0], page.view[3] - page.view[1]);
      const textFields = parseDeclarationSummary(text);
      let references = parseDeclarationReferences(contentText(content));
      for (let pageNumber = pdf.numPages; pageNumber > 1 && !references.containers.length; pageNumber -= 1) {
        const extraPage = await pdf.getPage(pageNumber);
        const extraContent = await extraPage.getTextContent();
        const found = parseDeclarationReferences(contentText(extraContent));
        references = {
          invoice: references.invoice || found.invoice,
          containers: [...new Set([...references.containers, ...found.containers])]
        };
      }
      return Object.fromEntries(Object.entries({ ...textFields, ...standardFields, ...references }).filter(([, value]) => Array.isArray(value) ? value.length : value));
    }

    async function openFirstPage(record) {
      try {
        const blob = await getFirstPagePreview(record.id);
        if (!blob) throw new Error('снимок не найден');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        els.line.textContent = 'Не удалось открыть первую страницу: ' + error.message;
      }
    }

    async function importPdf(file) {
      if (!file) return false;
      const logs = [];
      const addLog = (message) => logs.push(now() + ' | ' + message);
      addLog('Выбран PDF: ' + file.name + ', размер ' + Math.round(file.size / 1024) + ' KB');
      els.line.textContent = 'Читаю PDF и ищу QR...';

      const formData = new FormData();
      formData.append('pdf', file, file.name);
      let data = { ok: false, qrUrl: '', qrImageDataUrl: '', fields: {} };
      let serverError = '';

      try {
        if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Публичная версия использует локальный разбор PDF');
        addLog('Пробую серверный разбор PDF: встроенные изображения/QR');
        const response = await fetch('/api/import-pdf', { method: 'POST', body: formData });
        data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'PDF не прочитан');
        addLog(data.qrUrl ? 'QR найден сервером: ' + data.qrUrl : 'Сервер QR не нашёл');
        if (data.fields && Object.keys(data.fields).length) addLog('KEDEN проверен через ' + (data.check?.source === 'browser' ? 'браузер' : 'прямой ответ') + ': ' + Object.keys(data.fields).join(', '));
        else addLog('KEDEN не отдал карточку: ' + (data.check?.diagnostics || []).join('; '));
      } catch (error) {
        serverError = error.message;
        addLog('Серверный разбор не сработал: ' + serverError);
      }

      try {
        if (!data.qrUrl || !data.qrImageDataUrl) {
          els.line.textContent = 'Смотрю нижнюю часть первой страницы PDF...';
          addLog('Fallback: рендер первой страницы, поиск QR снизу/справа/по всей странице');
          const fallback = await readQrFromPdfBottom(file);
          if (fallback) {
            data = { ...data, qrUrl: data.qrUrl || fallback.qrUrl, qrImageDataUrl: data.qrImageDataUrl || fallback.qrImageDataUrl, qrSource: fallback.source, ok: true };
            addLog('QR найден через обрезку страницы (' + fallback.source + '): ' + fallback.qrUrl);
          } else {
            addLog('Fallback QR не нашёл');
          }
        }
      } catch (error) {
        addLog('Fallback ошибка: ' + error.message);
        if (!serverError) serverError = error.message;
      }

      if (!data.qrUrl && serverError) {
        els.line.textContent = 'Ошибка импорта PDF: ' + serverError;
        console.warn('DT import logs', logs);
        return false;
      }

      const fields = data.fields || {};
      try {
        const pdfFields = await readDeclarationFields(file);
        for (const [key, value] of Object.entries(pdfFields)) if (value && !fields[key]) fields[key] = value;
        const found = Object.keys(pdfFields).filter(key => pdfFields[key]);
        addLog(found.length ? 'Из PDF прочитаны: ' + found.join(', ') : 'Поля ДТ автоматически не распознаны');
      } catch (error) {
        addLog('Текст первой страницы не прочитан: ' + error.message);
      }
      let firstPagePreview = null;
      try {
        firstPagePreview = await captureFirstPage(file);
        if (firstPagePreview) addLog('Локально сохранена оригинальная первая страница PDF');
      } catch (error) {
        addLog('Первая страница PDF не сохранена: ' + error.message);
      }
      const detectedDtNumber = fields.dtNumber || dtFromFileName(file.name);
      const number = declarationNumberParts(detectedDtNumber);
      const dtNumber = number.baseNumber;
      if (detectedDtNumber) addLog('№ ДТ определён: ' + detectedDtNumber);
      else addLog('№ ДТ не определён автоматически');

      const importedRecord = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.pdf$/i, ''),
        dtNumber,
        status: fields.status || 'Нужна проверка',
        releaseDate: fields.releaseDate || '',
        declarant: fields.declarant || '', declarantBin: fields.declarantBin || '', transport: fields.transport || '',
        sender: fields.sender || '', receiver: fields.receiver || '', receiverBin: fields.receiverBin || '', invoice: fields.invoice || '', containers: fields.containers || [], tnved: '',
        customsValue: fields.customsValue || '',
        netWeight: fields.netWeight || '',
        grossWeight: fields.grossWeight || '',
        kedenUrl: data.qrUrl || '',
        description: fields.description || (data.qrUrl ? 'QR найден, данные KEDEN нужно проверить' : 'QR не найден в PDF'),
        goods: fields.goods || '',
        note: data.qrUrl ? 'QR: ' + data.qrUrl + (data.qrSource ? ' (' + data.qrSource + ')' : '') : 'QR не найден в PDF',
        sourceFileName: file.name,
        sourceFolder: String(file.webkitRelativePath || '').split('/').slice(0, -1).join('/'),
        qrImageDataUrl: data.qrImageDataUrl || '',
        hasFirstPagePreview: Boolean(firstPagePreview),
        previewImportedAt: firstPagePreview ? now() : '',
        logs,
        changed: false,
        archived: false,
        lastChecked: '',
        checkedAt: '',
        updatedAt: new Date().toISOString(),
        history: [now() + ': импорт PDF' + (data.qrUrl ? ', QR найден' : ', QR не найден')]
      };

      const existing = dtNumber
        ? records.find(record => declarationNumberParts(record.dtNumber).baseNumber === dtNumber)
        : null;
      let previewRecordId = importedRecord.id;
      let duplicateImport = false;

      if (number.isCorrection) {
        if (existing && existing.kedenUrl && !existing.requiresMainDt) {
          previewRecordId = existing.id;
          existing.corrections = [...new Set([...(existing.corrections || []), number.fullNumber])];
          existing.logs = [...(existing.logs || []), ...logs, now() + ' | КДТ не заменила основной QR'];
          existing.history = [...(existing.history || []), now() + ': распознана КДТ ' + number.fullNumber + ', основной QR сохранён'];
          existing.updatedAt = new Date().toISOString();
          els.line.textContent = 'КДТ распознана, основной QR сохранён';
        } else {
          const target = existing || importedRecord;
          previewRecordId = target.id;
          Object.assign(target, importedRecord, {
            id: target.id,
            dtNumber,
            kdtNumber: number.fullNumber,
            corrections: [...new Set([...(target.corrections || []), number.fullNumber])],
            requiresMainDt: true,
            correctionKedenUrl: data.qrUrl || '',
            kedenUrl: '',
            status: 'Нужна основная ДТ',
            description: 'Загружена КДТ ' + number.fullNumber + '. Загрузите основной PDF ДТ ' + dtNumber + ' без /' + number.correctionIndex + '.',
            history: [...(target.history || []), now() + ': загружена КДТ, требуется основной PDF ДТ']
          });
          if (!existing) records.unshift(target);
          els.line.textContent = 'Загружена КДТ. Нужен основной PDF ДТ без /' + number.correctionIndex;
        }
      } else if (existing && existing.requiresMainDt) {
        previewRecordId = existing.id;
        const previousHistory = existing.history || [];
        const knownCorrections = existing.corrections || [];
        Object.assign(existing, importedRecord, {
          id: existing.id,
          corrections: knownCorrections,
          requiresMainDt: false,
          kdtNumber: '',
          correctionKedenUrl: '',
          history: [...previousHistory, now() + ': загружена основная ДТ, основной QR установлен']
        });
        els.line.textContent = 'Основная ДТ загружена, QR КДТ заменён';
      } else if (existing) {
        previewRecordId = existing.id;
        duplicateImport = true;
        const duplicateId = crypto.randomUUID();
        records.unshift({
          ...importedRecord,
          id: duplicateId,
          status: 'Повтор ДТ',
          kedenUrl: '',
          qrImageDataUrl: '',
          hasFirstPagePreview: false,
          transientDuplicate: true,
          description: `Оригинал уже есть в мониторе. Его текущий статус: ${existing.status || 'не определён'}. Эта копия исчезнет через 5 минут.`,
          history: [now() + ': повторная загрузка, оригинал не изменён'],
        });
        setTimeout(() => {
          records = records.filter(record => record.id !== duplicateId);
          render();
        }, 5 * 60 * 1000);
        els.line.textContent = `Эта ДТ уже есть. Текущий статус: ${existing.status || 'не определён'}`;
      } else {
        records.unshift(importedRecord);
        els.line.textContent = data.qrUrl ? 'PDF импортирован, QR найден' : 'PDF импортирован, QR не найден';
      }
      if (firstPagePreview && !duplicateImport) await saveFirstPagePreview(previewRecordId, firstPagePreview);
      saveRecords();
      render();
      const savedRecord = records.find(record => record.id === previewRecordId);
      if (!duplicateImport && savedRecord?.kedenUrl && !savedRecord.requiresMainDt) {
        els.line.textContent = 'QR найден. Сразу проверяю статус в KEDEN...';
        await check(savedRecord.id);
      }
      finalImportMessage = duplicateImport
        ? `Эта ДТ уже есть. Текущий статус: ${savedRecord?.status || 'не определён'}`
        : (savedRecord?.status ? `ДТ добавлена. Статус: ${savedRecord.status}` : 'ДТ добавлена');
      console.info('DT import logs', logs);
      return true;
    }

    async function check(id) {
      const record = records.find(r => r.id === id);
      if (!record) return;
      record.lastChecked = now();
      record.checkedAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      if (!record.kedenUrl) {
        record.logs = [...(record.logs || []), now() + ' | Проверка: нет ссылки KEDEN'];
        record.history = [...(record.history || []), now() + ': нет ссылки KEDEN'];
        els.line.textContent = 'Нет ссылки KEDEN';
        saveRecords();
        render();
        return;
      }

      els.line.textContent = 'Проверяю KEDEN: ' + (record.dtNumber || record.name);
      try {
        const data = await requestKedenCheck(record.kedenUrl);
        if (data.fields && Object.keys(data.fields).length) {
          const previous = { ...record };
          const firstFill = !record.status || record.status === 'Нужна проверка';
          const next = { ...record, ...data.fields };
          const changes = diff(record, next);
          const notification = notificationForChange(previous, next, changes, settings);
          Object.assign(record, next);
          record.lastProblemKey = '';
          record.logs = [...(record.logs || []), now() + ' | KEDEN проверен через ' + (data.source === 'browser' ? 'браузер' : 'прямой ответ')];
          record.history = [...(record.history || []), firstFill
            ? now() + ': первичная сверка с KEDEN'
            : changes.length ? now() + ': ' + changes.join('; ') : now() + ': без изменений'];
          if (changes.length && !firstFill) {
            record.changed = true;
            if (notification) sendNotice(notification.title, notification.body, `change:${record.id}:${record.status}:${record.releaseDate || ''}`);
          }
          els.line.textContent = changes.length && !firstFill
            ? 'Обнаружены изменения: ' + record.name
            : 'Без изменений: ' + record.name;
        } else {
          record.logs = [...(record.logs || []), now() + ' | ' + (data.diagnostics || ['Карточка KEDEN не получена']).join(' | ')];
          record.history = [...(record.history || []), now() + ': карточка KEDEN не получена'];
          notifyProblemOnce(record, 'no-card', 'KEDEN не отдал карточку', record.name || record.dtNumber);
          els.line.textContent = 'KEDEN пока не отдал карточку';
        }
      } catch (error) {
        record.logs = [...(record.logs || []), now() + ' | Проверка KEDEN: ошибка ' + error.message];
        record.history = [...(record.history || []), now() + ': ошибка проверки ' + error.message];
        notifyProblemOnce(record, 'error:' + error.message, 'Ошибка проверки KEDEN', (record.name || record.dtNumber) + ': ' + error.message);
        els.line.textContent = 'Ошибка проверки: ' + error.message;
      }
      saveRecords();
      render();
    }
    async function checkAll() { for (const record of records.filter(r => !r.archived && r.kedenUrl && !isTerminalStatus(r.status))) await check(record.id); }
    async function checkDue(silent = false) {
      if (dueCheckRunning) return;
      const due = records.filter(isDue);
      if (!due.length) {
        if (!silent) els.line.textContent = 'Сейчас нет ДТ, которым нужна проверка';
        return;
      }
      dueCheckRunning = true;
      if (!silent) els.line.textContent = 'Проверяю нужные: ' + due.length;
      try {
        for (const record of due) await check(record.id);
      } finally {
        dueCheckRunning = false;
      }
    }
    function checkConditionalReminders() {
      if (!settings.notifyConditional) return;
      let changed = false;
      for (const record of records.filter(r => !r.archived && isConditionalRelease(r.status))) {
        const info = conditionalInfo(record);
        if (!info) continue;
        const threshold = [30, 14, 7, 3, 1, 0].find(days => info.remaining === days);
        const reminderKey = info.remaining < 0 ? 'overdue:' + Math.abs(info.remaining) : threshold === undefined ? '' : 'left:' + threshold;
        if (!reminderKey || record.lastConditionalReminderKey === reminderKey) continue;
        record.lastConditionalReminderKey = reminderKey;
        changed = true;
        const timing = info.remaining < 0
          ? 'срок прошёл ' + Math.abs(info.remaining) + ' дн. назад'
          : info.remaining === 0 ? 'срок сегодня' : 'осталось ' + info.remaining + ' дн.';
        sendNotice('Условный выпуск: ' + (record.dtNumber || record.name), timing + '. Контроль до ' + info.deadline.toLocaleDateString('ru-RU'), `conditional:${record.id}:${reminderKey}`);
      }
      if (changed) saveRecords();
    }
    function clearChanged(id) { const record = records.find(r => r.id === id); if (!record) return; record.changed = false; if (isCleared(record.status)) record.archived = true; record.updatedAt = new Date().toISOString(); record.history = [...(record.history || []), now() + (isCleared(record.status) ? ': очистка принята, ДТ перенесена в архив' : ': изменение принято')]; saveRecords(); render(); }
    function toggleArchive(id) { const record = records.find(r => r.id === id); if (!record) return; record.archived = !record.archived; record.updatedAt = new Date().toISOString(); saveRecords(); render(); }
    async function deleteRecord(id) { const record = records.find(r => r.id === id); if (!record) return; if (!window.confirm('Удалить запись "' + (record.name || record.dtNumber || 'без имени') + '"?')) return; records = records.filter(r => r.id !== id); await Promise.all([deleteFirstPagePreview(id).catch(() => {}), deleteSupportDocument(id).catch(() => {})]); saveRecords(); render(); }
    function applySettings() {
      els.workInterval.value = settings.workMinutes;
      els.releasedInterval.value = settings.releasedHours;
      els.recentDays.value = settings.recentDays;
      els.conditionalDays.value = settings.conditionalDays;
      els.notifyReleased.checked = settings.notifyReleased;
      els.notifyStatusChanges.checked = settings.notifyStatusChanges;
      els.notifyDataChanges.checked = settings.notifyDataChanges;
      els.notifyProblems.checked = settings.notifyProblems;
      els.notifyConditional.checked = settings.notifyConditional;
      els.showDeclarant.checked = settings.showDeclarant;
      els.showTransport.checked = settings.showTransport;
      els.showGoods.checked = settings.showGoods;
      els.showSender.checked = settings.showSender;
      els.showReceiver.checked = settings.showReceiver;
      els.privacyMode.checked = settings.privacyMode;
      document.body.classList.toggle('privacyMode', settings.privacyMode);
      updateNotificationButton();
    }
    function updateSettings() {
      settings = {
        ...settings,
        workMinutes: Number(els.workInterval.value || 15),
        releasedHours: Number(els.releasedInterval.value || 6),
        recentDays: Number(els.recentDays.value || 3),
        conditionalDays: Number(els.conditionalDays.value || 60),
        notifyReleased: els.notifyReleased.checked,
        notifyStatusChanges: els.notifyStatusChanges.checked,
        notifyDataChanges: els.notifyDataChanges.checked,
        notifyProblems: els.notifyProblems.checked,
        notifyConditional: els.notifyConditional.checked,
        showDeclarant: els.showDeclarant.checked,
        showTransport: els.showTransport.checked,
        showGoods: els.showGoods.checked,
        showSender: els.showSender.checked,
        showReceiver: els.showReceiver.checked,
        privacyMode: els.privacyMode.checked
      };
      saveSettings();
      applySettings();
      render();
    }
    function updateNotificationButton() {
      if (!('Notification' in window)) els.notifyBtn.textContent = 'Уведомления недоступны';
      else if (Notification.permission === 'granted') els.notifyBtn.textContent = 'Уведомления включены';
      else els.notifyBtn.textContent = 'Включить уведомления';
    }
    async function enableNotifications() {
      if (!('Notification' in window)) {
        els.line.textContent = 'Браузер не поддерживает уведомления';
        return;
      }
      const permission = await Notification.requestPermission();
      updateNotificationButton();
      els.line.textContent = permission === 'granted' ? 'Уведомления включены' : 'Уведомления не включены в браузере';
      if (permission === 'granted') sendNotice('KEDEN44 Control', 'Уведомления включены');
    }
    function renderGoogleProfile(profile) {
      if (!els.googleSignIn) return;
      els.googleSignIn.replaceChildren();
      const status = document.createElement('span');
      status.className = 'googleAccount';
      status.textContent = 'Синхронизация: ' + (profile?.email || 'Google подключён');
      status.title = 'Записи этого монитора синхронизируются между вашими устройствами';
      els.googleSignIn.append(status);
    }
    function mergeCloudRecords(remoteRecords = []) {
      const merged = new Map();
      const keyOf = record => declarationNumberParts(record?.dtNumber || '').baseNumber || record?.id;
      for (const record of [...persistentRecords(), ...remoteRecords]) {
        if (!record || typeof record !== 'object') continue;
        const key = keyOf(record);
        if (!key) continue;
        const current = merged.get(key);
        if (!current || Date.parse(record.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) merged.set(key, record);
      }
      records = normalizeStoredRecords([...merged.values()]);
    }
    async function pullCloudAndMerge() {
      const result = await telegram.cloudPull();
      const cloud = result.cloud || {};
      mergeCloudRecords(Array.isArray(cloud.records) ? cloud.records : []);
      if (cloud.settings && typeof cloud.settings === 'object' && Object.keys(cloud.settings).length) {
        settings = { ...settings, ...cloud.settings };
        try { if (store) store.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
        applySettings();
      }
      googleCloudLoaded = true;
      saveRecords();
      render();
      els.line.textContent = 'Синхронизация Google завершена: ' + records.length + ' ДТ';
    }
    async function pushCloud() {
      if (!googleConnected || !googleCloudLoaded) return;
      await telegram.cloudPush(persistentRecords(), settings);
    }
    function scheduleCloudSync() {
      if (!googleConnected || !googleCloudLoaded) return;
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => pushCloud().catch(() => {}), 1200);
    }
    async function handleGoogleCredential(response) {
      try {
        const result = await telegram.googleAuth(response.credential);
        googleConnected = true;
        googleCloudLoaded = false;
        renderGoogleProfile(result.profile);
        await pullCloudAndMerge();
      } catch (error) {
        els.line.textContent = 'Вход Google не выполнен: ' + error.message;
      }
    }
    function initializeGoogleSignIn(attempt = 0) {
      if (!els.googleSignIn || googleConnected) return;
      if (!window.google?.accounts?.id) {
        if (attempt < 40) setTimeout(() => initializeGoogleSignIn(attempt + 1), 250);
        return;
      }
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      els.googleSignIn.replaceChildren();
      window.google.accounts.id.renderButton(els.googleSignIn, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
    }
    async function refreshTelegramStatus() {
      try {
        const result = await telegram.connection();
        els.telegramBtn.textContent = result.linked ? 'Telegram подключён' : 'Подключить Telegram';
        els.telegramBtn.classList.toggle('connected', Boolean(result.linked));
        els.telegramStatus.textContent = result.linked
          ? 'Telegram: подключён' + (result.username ? ` (@${result.username})` : '') + ` · ДТ: ${result.watchCount || 0}`
          : 'Telegram: не подключён';
        if (result.google) {
          googleConnected = true;
          renderGoogleProfile(result.google);
          if (!googleCloudLoaded) await pullCloudAndMerge();
        }
        return result.linked;
      } catch {
        els.telegramBtn.textContent = 'Подключить Telegram';
        els.telegramStatus.textContent = 'Telegram: сервис временно недоступен';
        return false;
      }
    }
    function watchFromRecord(record) {
      if (record.archived || !record.kedenUrl || isTerminalStatus(record.status)) return null;
      try {
        const parsed = new URL(record.kedenUrl);
        const sourcePath = parsed.pathname === '/qrpage' ? parsed.searchParams.get('url') || '' : parsed.pathname;
        const match = sourcePath.match(/\/qr-data\/([A-Za-z0-9]{16,64})\/DT$/);
        if (!match) return null;
        return {
          id: record.id,
          qrId: match[1],
          dtNumber: record.dtNumber,
          name: record.name,
          workMinutes: settings.workMinutes,
          releasedHours: settings.releasedHours,
          notifyReleased: settings.notifyReleased,
          notifyStatusChanges: settings.notifyStatusChanges,
          notifyDataChanges: settings.notifyDataChanges,
          notifyProblems: settings.notifyProblems
        };
      } catch { return null; }
    }
    async function syncTelegramWatches() {
      const watches = records.map(watchFromRecord).filter(Boolean);
      const result = await telegram.sync(watches);
      if (!result.skipped && els.telegramStatus) els.telegramStatus.textContent = `Telegram: фоновое наблюдение · ДТ: ${result.watchCount}`;
      return result;
    }
    function scheduleTelegramSync() {
      clearTimeout(telegramSyncTimer);
      telegramSyncTimer = setTimeout(() => syncTelegramWatches().catch(() => {}), 800);
    }
    async function connectTelegram() {
      els.telegramBtn.disabled = true;
      els.telegramStatus.textContent = 'Telegram: создаю ссылку подключения...';
      try {
        const link = await telegram.createLink();
        if (!link.url) throw new Error('Бот пока не готов');
        window.open(link.url, '_blank', 'noopener');
        els.telegramStatus.textContent = 'В Telegram нажмите Start. Проверяю подключение...';
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (await refreshTelegramStatus()) {
            await syncTelegramWatches();
            els.line.textContent = 'Telegram подключён';
            return;
          }
        }
        els.telegramStatus.textContent = 'Нажмите кнопку ещё раз, если ссылка истекла';
      } catch (error) {
        els.telegramStatus.textContent = 'Telegram: ' + error.message;
      } finally {
        els.telegramBtn.disabled = false;
      }
    }
    function notifyProblemOnce(record, key, title, body) {
      if (!settings.notifyProblems || record.lastProblemKey === key) return;
      record.lastProblemKey = key;
      sendNotice(title, body, `problem:${record.id}:${key}`);
    }
    async function sendNotice(title, body, dedupeKey = '') {
      if (settings.privacyMode) return;
      telegram.notify(title, body, dedupeKey).catch(() => {});
      if ('Notification' in window && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready.catch(() => null);
          if (registration) {
            await registration.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: dedupeKey || 'keden44-status' });
            return;
          }
        }
        new Notification(title, { body });
      }
    }
    function exportJson() { const blob = new Blob([JSON.stringify(records, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'KEDEN44-backup-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); URL.revokeObjectURL(url); els.line.textContent = 'Резервная копия создана'; }
    async function importJson(file) {
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
          throw new Error('ожидался список записей ДТ');
        }
        if (!window.confirm('Заменить текущие записи данными из резервной копии?')) return;
        records = normalizeStoredRecords(parsed);
        archiveVisibleCount = 20;
        saveRecords();
        render();
        els.line.textContent = 'Резервная копия импортирована: ' + records.length + ' записей';
      } catch (error) {
        els.line.textContent = 'Не удалось импортировать JSON: ' + error.message;
      } finally {
        els.jsonInput.value = '';
      }
    }

    let finalImportMessage = '';
    const pdfImportQueue = createImportQueue({
      process: importPdf,
      onProgress(state) {
        const active = state.stage === 'running' || state.stage === 'queued';
        els.importPdfBtn.disabled = active;
        els.importPdfBtn.textContent = active ? 'Импорт ' + Math.min(state.completed + 1, state.total) + '/' + state.total : 'Импорт PDF';
        if (state.stage === 'running' && !state.current) els.line.textContent = 'Обработано PDF: ' + state.completed + ' из ' + state.total;
        if (state.stage === 'done') {
          const successful = state.total - state.failed;
          els.line.textContent = state.total === 1 && !state.failed && finalImportMessage
            ? finalImportMessage
            : 'Импорт завершён: успешно ' + successful + ' из ' + state.total
              + (state.failed ? '. Ошибки: ' + state.errors.join(', ') : '');
          finalImportMessage = '';
          els.pdfInput.value = '';
        }
      }
    });

    function queuePdfFiles(files) {
      const selected = Array.from(files || []);
      const pdfFiles = selected.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
      if (!pdfFiles.length) {
        els.line.textContent = selected.length ? 'Выберите PDF-файлы' : 'Файлы не выбраны';
        return;
      }
      if (pdfFiles.length !== selected.length) els.line.textContent = 'Файлы не PDF пропущены';
      pdfImportQueue.add(pdfFiles);
    }

    els.addBtn.addEventListener('click', () => { els.addBtn.closest('details')?.removeAttribute('open'); openForm(); });
    els.importPdfBtn.addEventListener('click', () => els.pdfInput.click());
    els.pdfInput.addEventListener('change', e => queuePdfFiles(e.target.files));
    let dragDepth = 0;
    document.addEventListener('dragenter', event => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      dragDepth += 1;
      document.body.classList.add('fileDragActive');
    });
    document.addEventListener('dragover', event => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', event => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove('fileDragActive');
    });
    document.addEventListener('drop', event => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('fileDragActive');
      queuePdfFiles(event.dataTransfer.files);
    });
    els.closeDialogBtn.addEventListener('click', closeForm);
    els.cancelBtn.addEventListener('click', closeForm);
    els.entryForm.addEventListener('submit', saveForm);
    els.closeExtensionBtn.addEventListener('click', closeExtensionForm);
    els.cancelExtensionBtn.addEventListener('click', closeExtensionForm);
    els.extensionForm.addEventListener('submit', saveConditionalExtension);
    els.searchInput.addEventListener('input', e => { query = e.target.value; archiveVisibleCount = 20; render(); });
    els.declarantBinFilter.addEventListener('input', e => { declarantBinFilter = e.target.value.replace(/\D/g, ''); archiveVisibleCount = 20; render(); });
    els.scopeSelect.addEventListener('change', e => { scope = e.target.value; archiveVisibleCount = 20; render(); });
    els.releasePeriod.addEventListener('change', e => { releasePeriod = e.target.value; archiveVisibleCount = 20; render(); });
    els.resetFiltersBtn.addEventListener('click', () => {
      query = '';
      declarantBinFilter = '';
      releasePeriod = 'all';
      scope = 'all';
      archiveVisibleCount = 20;
      els.searchInput.value = '';
      els.declarantBinFilter.value = '';
      els.releasePeriod.value = 'all';
      els.scopeSelect.value = 'all';
      render();
    });
    els.archiveMoreBtn.addEventListener('click', () => { archiveVisibleCount += 20; render(); });
    els.checkAllBtn.addEventListener('click', checkAll);
    els.checkDueBtn.addEventListener('click', () => checkDue(false));
    els.workInterval.addEventListener('change', updateSettings);
    els.releasedInterval.addEventListener('change', updateSettings);
    els.recentDays.addEventListener('change', updateSettings);
    els.conditionalDays.addEventListener('change', updateSettings);
    els.notifyReleased.addEventListener('change', updateSettings);
    els.notifyStatusChanges.addEventListener('change', updateSettings);
    els.notifyDataChanges.addEventListener('change', updateSettings);
    els.notifyProblems.addEventListener('change', updateSettings);
    els.notifyConditional.addEventListener('change', updateSettings);
    for (const input of [els.showDeclarant, els.showTransport, els.showGoods, els.showSender, els.showReceiver, els.privacyMode]) input.addEventListener('change', updateSettings);
    els.notifyBtn.addEventListener('click', enableNotifications);
    els.telegramBtn.addEventListener('click', connectTelegram);
    els.googleSignIn?.addEventListener('click', event => {
      if (!event.target.closest('.googleFallback')) return;
      initializeGoogleSignIn();
      window.google?.accounts?.id?.prompt();
    });
    els.exportBtn.addEventListener('click', exportJson);
    els.importJsonBtn.addEventListener('click', () => els.jsonInput.click());
    els.jsonInput.addEventListener('change', event => importJson(event.target.files?.[0]));
    window.dtBoardDebug = { get records() { return records; }, openForm, render };
    const transferMessage = importTransferFromUrl();
    applySettings();
    initializeGoogleSignIn();
    refreshTelegramStatus().then(linked => { if (linked) syncTelegramWatches().catch(() => {}); });
    saveRecords();
    render();
    if (transferMessage) els.line.textContent = transferMessage;
    setTimeout(() => { checkDue(true); checkConditionalReminders(); }, 5000);
    setInterval(() => { checkDue(true); checkConditionalReminders(); }, 60000);
  })();
