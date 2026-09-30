import { declarationNumberParts, declarationSectionFromDtNumber } from './dt.js';

function normalizedContainers(record = {}) {
  return (record.containers || [record.container])
    .filter(Boolean)
    .map(value => String(value).replace(/\s/g, '').toUpperCase());
}

function normalizedInvoice(record = {}) {
  return String(record.invoice || '').replace(/[^A-ZА-ЯЁ0-9]/giu, '').toUpperCase();
}

export function shipmentGroupKey(record = {}) {
  const container = normalizedContainers(record)[0] || '';
  if (container) return 'container:' + container;
  const invoice = normalizedInvoice(record);
  if (!invoice) return '';
  const datePart = declarationNumberParts(record.dtNumber).baseNumber.split('/')[1] || '';
  return 'invoice:' + String(record.declarantBin || '') + ':' + datePart + ':' + invoice;
}

export function sameShipment(left = {}, right = {}) {
  const leftContainers = new Set(normalizedContainers(left));
  if (normalizedContainers(right).some(value => leftContainers.has(value))) return true;
  const leftInvoice = normalizedInvoice(left);
  const leftDate = declarationNumberParts(left.dtNumber).baseNumber.split('/')[1] || '';
  const rightDate = declarationNumberParts(right.dtNumber).baseNumber.split('/')[1] || '';
  return Boolean(leftInvoice && leftInvoice === normalizedInvoice(right) && leftDate === rightDate && String(left.declarantBin || '') === String(right.declarantBin || ''));
}

export function relatedDeclarationParts(record, records = []) {
  const section = declarationSectionFromDtNumber(record?.dtNumber);
  if (!section) return [];
  return records.filter(candidate => candidate.id !== record.id
    && sameShipment(record, candidate)
    && declarationSectionFromDtNumber(candidate.dtNumber)
    && declarationSectionFromDtNumber(candidate.dtNumber) !== section);
}
