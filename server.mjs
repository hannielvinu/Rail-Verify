import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createStore} from './lib/store.mjs';
import {createWhatsApp,validSignature} from './lib/whatsapp.mjs';
import {verifyPurchase,extractReceipt} from './public/engine.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const publicDir=resolve(here,'public');
export function createApplication({database=resolve(here,'.data/railverify.sqlite'),adminToken=process.env.ADMIN_TOKEN||'railverify-local-demo',whatsapp={},ocr:providedOCR}={}) {
 const store=createStore(database);
 let workerPromise;let ocrBusy=false;
 const ocr=providedOCR||async function(buffer){
  if(ocrBusy)throw Object.assign(new Error('The scanner is busy. Please try again shortly.'),{status:429});
  ocrBusy=true;
  try {
   const {createWorker}=await import('tesseract.js');
   workerPromise??=createWorker('eng',1,{cachePath:resolve(here,'.data'),langPath:resolve(here,'node_modules/@tesseract.js-data/eng/4.0.0_best_int')});
   const worker=await workerPromise;
   const {data}=await worker.recognize(buffer);
   return {...extractReceipt(data.text),confidence:data.confidence};
  } catch(error){if(workerPromise){const worker=await workerPromise.catch(()=>null);await worker?.terminate().catch(()=>{});}workerPromise=undefined;throw error;}
  finally{ocrBusy=false;}
 };
 function createReport(input){
  if(input.consent!==true)throw new Error('Please consent to storing this report.');
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(input.id||''))throw new Error('A valid report request ID is required.');
  if(!/^\d{5}$/.test(input.trainNumber||''))throw new Error('Enter a five-digit train number.');
  const vendorId=String(input.vendorId||'').trim();
  if(vendorId.length>80)throw new Error('Vendor reference is too long.');
  const description=String(input.description||'').trim();
  if(description.length>2000)throw new Error('Keep report details under 2,000 characters.');
  const verification=verifyPurchase(input);
  let location=null;
  if(input.location){const {latitude,longitude,accuracy}=input.location;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!Number.isFinite(accuracy)||accuracy<0)throw new Error('Location is invalid.');location={latitude,longitude,accuracy};}
  const normalized={trainNumber:input.trainNumber,vendorId,description,verification,location};
  const hash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const old=store.getReport(input.id);
  if(old){if(old.requestHash!==hash)throw Object.assign(new Error('This request ID already belongs to a different report.'),{status:409});const {requestHash,...report}=old;return report;}
  const report={id:input.id,...normalized,createdAt:new Date().toISOString(),status:'prepared',officiallyFiled:false};
  return store.saveReport(report,hash);
 }
 const wa={verifyToken:process.env.WHATSAPP_VERIFY_TOKEN,accessToken:process.env.WHATSAPP_ACCESS_TOKEN,phoneId:process.env.WHATSAPP_PHONE_NUMBER_ID,appSecret:process.env.WHATSAPP_APP_SECRET,apiVersion:process.env.WHATSAPP_API_VERSION||'v23.0',...whatsapp};
 const processMessage=createWhatsApp({config:wa,store,createReport,ocr});
 const requests=new Map();
 async function body(req,max=6*1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Object.assign(new Error('File or request is too large.'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
 function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
 function authorized(req){const actual=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,''));const expected=Buffer.from(adminToken);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,whatsappConfigured:!!(wa.accessToken&&wa.phoneId&&wa.appSecret&&wa.verifyToken),demoAdmin:adminToken==='railverify-local-demo'});
   if(url.pathname==='/webhooks/whatsapp'&&req.method==='GET') {
    if(wa.verifyToken&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===wa.verifyToken){res.writeHead(200,{'Content-Type':'text/plain'});return res.end(url.searchParams.get('hub.challenge'));}
    return json(res,403,{error:'Webhook verification failed.'});
   }
   if(url.pathname==='/webhooks/whatsapp'&&req.method==='POST') {
    const raw=await body(req,1024*1024);
    if(!validSignature(raw,req.headers['x-hub-signature-256'],wa.appSecret))return json(res,403,{error:'Invalid webhook signature.'});
    if(!wa.accessToken||!wa.phoneId)return json(res,503,{error:'WhatsApp credentials are not configured.'});
    const event=JSON.parse(raw.toString());
    // Finish persisted processing before acknowledging, so a premature process exit cannot silently discard an accepted event.
    for(const entry of event.entry||[])for(const change of entry.changes||[])for(const message of change.value?.messages||[])await processMessage(message);
    return json(res,200,{received:true});
   }
   if(url.pathname.startsWith('/api/')) {
    const address=req.socket.remoteAddress||'local';const now=Date.now();
    if(requests.size>10000)for(const [key,value] of requests)if(now-value.start>60000)requests.delete(key);
    const usage=requests.get(address);if(!usage||now-usage.start>60000)requests.set(address,{start:now,count:1});else if(++usage.count>100)return json(res,429,{error:'Too many requests. Please wait a minute.'});
    if(req.method==='POST'&&url.pathname==='/api/verify')return json(res,200,verifyPurchase(JSON.parse((await body(req,12000)).toString())));
    if(req.method==='POST'&&url.pathname==='/api/ocr') {
     const type=req.headers['content-type']||'';
     if(!['image/png','image/jpeg','image/webp'].includes(type))return json(res,415,{error:'Upload a PNG, JPG or WebP image.'});
     const buffer=await body(req,5*1024*1024);
     const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=buffer[0]===255&&buffer[1]===216;const webp=buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
     if(!png&&!jpeg&&!webp)return json(res,400,{error:'This file does not look like a supported image.'});
     try{return json(res,200,await ocr(buffer));}catch(error){if(error.status)throw error;throw Object.assign(new Error('The bill could not be read. Try a sharper photo, or enter the item and amount.'),{status:422});}
    }
    if(req.method==='POST'&&url.pathname==='/api/reports')return json(res,201,createReport(JSON.parse((await body(req,16000)).toString())));
    if(req.method==='GET'&&url.pathname==='/api/admin/reports') {
     if(!authorized(req))return json(res,401,{error:'Enter a valid dashboard access key.'});
     return json(res,200,{reports:store.listReports(),officiallyFiled:false});
    }
    return json(res,404,{error:'Endpoint not found.'});
   }
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
   let pathname=decodeURIComponent(url.pathname);
   if(pathname==='/'||pathname==='/dashboard')pathname='/index.html';
   const path=resolve(publicDir,'.'+pathname);
   if(!path.startsWith(publicDir+'\\')&&!path.startsWith(publicDir+'/'))return json(res,403,{error:'Access denied.'});
   const info=await stat(path).catch(()=>null);if(!info?.isFile())return json(res,404,{error:'File not found.'});
   const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.wasm':'application/wasm','.gz':'application/gzip','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':pathname==='/sw.js'?'no-cache':'public, max-age=300'});res.end(req.method==='HEAD'?undefined:await readFile(path));
  }catch(error){json(res,error.status||400,{error:error instanceof SyntaxError?'Invalid JSON request.':error.message||'Request failed.'});}
 });
 return {server,store,createReport,async close(){await new Promise(resolve=>server.close(resolve));if(workerPromise){const worker=await workerPromise.catch(()=>null);await worker?.terminate();}store.close();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.env.HOST&&process.env.HOST!=='127.0.0.1'&&(!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN==='replace-with-a-long-random-secret'))throw new Error('Set a strong ADMIN_TOKEN before exposing the server.');
 const app=createApplication();app.server.listen(Number(process.env.PORT)||4317,process.env.HOST||'127.0.0.1',()=>console.log(`RailVerify is running at http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||4317}`));
}

