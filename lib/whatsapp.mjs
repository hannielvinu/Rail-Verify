import {createHmac,timingSafeEqual} from 'node:crypto';
import {verifyPurchase,items,reportText,sources,extractReceipt} from '../public/engine.mjs';
export function validSignature(raw,signature,secret) {
 if(!secret||!/^sha256=[a-f0-9]{64}$/i.test(signature||''))return false;
 const expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}
export function createWhatsApp({config,store,createReport,ocr,send=async(to,body)=>{
 const response=await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body}})});
 if(!response.ok)throw new Error('WhatsApp delivery failed.');
}}) {
 const aliases={VEG:'veg-meal',EGG:'egg-meal',CHICKEN:'chicken-meal',BREAKFAST:'veg-breakfast',WATER:'water-1l',WATER500:'water-500'};
 const help='RailVerify price check\nSend VEG 150 MAIL, EGG 100 MAIL, CHICKEN 150 MAIL, WATER 20 or WATER500 10. Amount is the total paid for one item. Meal checks require MAIL for a standard Mail/Express purchase.\nA bill photo can suggest details for you to confirm.\nAfter checking, send REPORT 12345 to prepare a report, then CONFIRM. No PNR is needed here. Official RailMadad filing follows its own identity checks.';
 return async function processMessage(message) {
  if(!message.id||!message.from||!store.claimMessage(message.id))return;
  const conversationId=createHmac('sha256',config.appSecret).update(message.from).digest('hex');
  const state=store.getConversation(conversationId);
  let reply=help;
  try {
   if(message.type==='image') {
    const metadata=await fetch(`https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(message.image.id)}`,{headers:{Authorization:`Bearer ${config.accessToken}`}});
    if(!metadata.ok)throw new Error('Could not retrieve that image.');
    const media=await metadata.json();
    if(!['image/jpeg','image/png'].includes(media.mime_type)||media.file_size>5*1024*1024)throw new Error('Please send a JPG or PNG under 5 MB.');
    const mediaUrl=new URL(media.url);
    if(mediaUrl.protocol!=='https:'||!/(^|\.)(facebook\.com|fbcdn\.net|fbsbx\.com)$/.test(mediaUrl.hostname))throw new Error('Unrecognized WhatsApp media host.');
    const image=await fetch(mediaUrl,{headers:{Authorization:`Bearer ${config.accessToken}`}});
    if(!image.ok)throw new Error('Could not download that image.');
    const data=Buffer.from(await image.arrayBuffer());
    if(data.length>5*1024*1024)throw new Error('Please send an image under 5 MB.');
    const result=await ocr(data);
    const guessed=items.find(x=>x.id===result.itemId);
    reply=`I read ${guessed?.name||'an unclear item'}${result.amount?` and ₹${result.amount}`:''}. Please confirm the purchase by typing a command such as VEG 150 MAIL or WATER 20. A photo alone does not verify the amount paid.`;
   } else {
    const parts=String(message.text?.body||'').trim().toUpperCase().split(/\s+/);
    const [command,value,category]=parts;
    if(aliases[command]&&value){
     const result=verifyPurchase({itemId:aliases[command],amount:value,quantity:1,category:category==='MAIL'?'mail-express':'other',brand:'rail-neer'});
     store.saveConversation(conversationId,{verification:result});
     reply=`${result.title}\n${result.itemName}\nPaid ₹${result.amount}${result.expected!==undefined?` · Listed ₹${result.expected}`:''}\n${result.reason}\nSource ${result.source.url}\nSend REPORT followed by your five-digit train number to prepare a local report for review.`;
    } else if(command==='REPORT') {
     if(!state.verification)reply='Check a purchase first.\n'+help;
     else if(!/^\d{5}$/.test(value||''))reply='Send REPORT followed by your five-digit train number, for example REPORT 12345.';
     else {
      store.saveConversation(conversationId,{...state,pendingTrain:value,pendingMessage:message.id});
      reply=`Prepare a local report for train ${value}? It will include your confirmed purchase and train number. We store no WhatsApp phone number in the report. This does not submit an official grievance. Reply CONFIRM to consent or CANCEL to stop.`;
     }
    } else if(command==='CONFIRM'&&state.pendingTrain) {
     const report=createReport({id:'wa-'+createHmac('sha256',config.appSecret).update(state.pendingMessage).digest('hex').slice(0,32),trainNumber:state.pendingTrain,itemId:state.verification.itemId,amount:state.verification.amount,quantity:state.verification.quantity,category:state.verification.category,brand:state.verification.brand,consent:true});
     store.saveConversation(conversationId,{verification:state.verification});
     reply=`Local report prepared. Reference ${report.id}\n${reportText(report)}\n\nComplete official submission at ${sources.complaint.url}`;
    } else if(command==='CANCEL') {store.saveConversation(conversationId,{});reply='Report preparation cancelled.';}
   }
   await send(message.from,reply);store.finishMessage(message.id,'sent');
  } catch(error) {
   try {await send(message.from,error.message+' You can try a text command instead.');store.finishMessage(message.id,'error-replied');}
   catch {store.finishMessage(message.id,'delivery-failed');throw Object.assign(new Error('WhatsApp delivery failed. Retry this webhook event.'),{status:503});}
  }
 };
}
