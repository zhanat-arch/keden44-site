const ORGANIZATION_FORMS = /^(ТОО|ИП|АО|ОАО|ЗАО|ООО|LLP|JSC)(?=$|[\s,.:;-])[\s,.:;-]*/iu;

export function splitOrganizationName(value) {
  const text = String(value || '').trim();
  const match = text.match(ORGANIZATION_FORMS);
  if (!match) return { legalForm: '', name: text };
  return {
    legalForm: match[1],
    name: text.slice(match[0].length).trim()
  };
}

export function splitDeclarationNumber(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(.*)(\d{4})(\/\d+)?$/u);
  if (!match) return { prefix: text, privateTail: '', suffix: '' };
  return {
    prefix: match[1],
    privateTail: match[2],
    suffix: match[3] || ''
  };
}
