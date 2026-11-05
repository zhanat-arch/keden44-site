export function publicQrUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://keden.kgd.gov.kz' || url.pathname !== '/qrpage' || url.username || url.password) return '';
    const path = url.searchParams.get('url');
    if (!/^\/declaration\/declarations\/qr-data\/[A-Za-z0-9]{16,64}\/DT$/.test(path || '')) return '';
    return 'https://keden.kgd.gov.kz/qrpage?url=' + path;
  } catch {return '';}
}
