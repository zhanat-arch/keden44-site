export const PERMIT_KEY='keden44-tools-permit-v1';
export const DEVICE_KEY='keden44-telegram-device-v1';
export const PERMIT_GENERATION_KEY='keden44-tools-auth-generation-v1';
const PUBLIC_KEY={kty:'EC',crv:'P-256',x:'ZuSjuvWCEMv-OlgzFTbQdeddqj8_lzSaIS7BZbmY69Q',y:'l-dUqotPX5_lAUFKSHa-Ajj9LLxfr1SpAy2TmgA5KOc'};
const bytes=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export function clearPermit(storage){try{storage?.removeItem(PERMIT_KEY);storage?.setItem(PERMIT_GENERATION_KEY,String(Number(storage?.getItem(PERMIT_GENERATION_KEY)||0)+1));}catch{}}
export function storePermit(storage,permit){
 try{if(permit?.payload&&permit?.signature)storage?.setItem(PERMIT_KEY,JSON.stringify(permit));else clearPermit(storage);}catch{}
}
export async function readPermit(storage,scope,{now=Date.now(),subtle=globalThis.crypto?.subtle,publicKey=PUBLIC_KEY}={}){
 try{
  const device=JSON.parse(storage?.getItem(DEVICE_KEY)||'null');
  const permit=JSON.parse(storage?.getItem(PERMIT_KEY)||'null');
  if(!device?.accountId||!device?.deviceSecret||!permit||!subtle)return null;
  const key=await subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  if(!await subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes(permit.signature),new TextEncoder().encode(permit.payload)))return null;
  const data=JSON.parse(new TextDecoder().decode(bytes(permit.payload)));
  if(data.version!==1||data.audience!=='keden44-tools'||data.accountId!==device.accountId||!Number.isFinite(data.issuedAt)||data.issuedAt>now+300000)return null;
  const access=data.scopes?.[scope];
  if(access?.allowed!==true||!Object.hasOwn(access,'until'))return null;
  if(access.until!==null&&(!Number.isFinite(Date.parse(access.until))||Date.parse(access.until)<=now))return null;
  const current=JSON.parse(storage?.getItem(DEVICE_KEY)||'null');
  if(current?.accountId!==device.accountId||current?.deviceSecret!==device.deviceSecret)return null;
  if(JSON.parse(storage?.getItem(PERMIT_KEY)||'null')?.signature!==permit.signature)return null;
  return {allowed:true,state:access.state,validUntil:access.until,offline:true,issuedAt:data.issuedAt};
 }catch{return null;}
}
