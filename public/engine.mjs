export const sources = {
 meal: {label:'Railway Board tariff · standard Mail/Express meals',url:'https://indianrailways.gov.in/railwayboard/uploads/directorate/coaching/TAG_2023-24/Menu_Meals.pdf',effective:'2019 tariff schedule',note:'Applicable to standard meals sold separately on covered Mail/Express services. Confirm the item and train category.'},
 water: {label:'Railway Board · Commercial Circular 18/2025',url:'https://rb.indianrailways.gov.in/uploads/directorate/traffic_comm/Comm_Cir_2025/MRP%20of%20Rail%20Neer%20Shortlisted%20packaged%20drinking%20water%20.pdf',effective:'22 September 2025',note:'Rail Neer and railway-shortlisted packaged drinking water. Verify bottle size and current applicable authorization.'},
 complaint:{label:'Official RailMadad complaint portal',url:'https://railmadad.indianrailways.gov.in/madad/final/ComplaintOnTrain.jsp'},
 scale:{label:'Lok Sabha · 25 March 2026',url:'https://sansad.in/getFile/loksabhaquestions/annex/187/AU5506_SeGOEw.pdf?source=pqals'}
};
export const items=[
 {id:'veg-meal',name:'Standard vegetarian meal',short:'Veg meal',kind:'meal',rate:80,source:'meal'},
 {id:'egg-meal',name:'Standard meal with egg curry',short:'Egg meal',kind:'meal',rate:90,source:'meal'},
 {id:'chicken-meal',name:'Standard meal with chicken curry',short:'Chicken meal',kind:'meal',rate:130,source:'meal'},
 {id:'veg-breakfast',name:'Standard vegetarian breakfast',short:'Veg breakfast',kind:'meal',rate:40,source:'meal'},
 {id:'egg-breakfast',name:'Standard non-vegetarian breakfast',short:'Egg breakfast',kind:'meal',rate:50,source:'meal'},
 {id:'water-1l',name:'Rail Neer · 1 litre',short:'Water 1L',kind:'water',rate:14,source:'water'},
 {id:'water-500',name:'Rail Neer · 500 mL',short:'Water 500mL',kind:'water',rate:9,source:'water'}
];
export function verifyPurchase(input={}) {
 const item=items.find(x=>x.id===input.itemId);
 if(!item)throw new Error('Choose a supported item.');
 const amount=Number(input.amount);
 if(!Number.isFinite(amount)||amount<=0||amount>10000||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw new Error('Enter a valid amount between ₹0.01 and ₹10,000, with at most two decimal places.');
 if(!Number.isInteger(Number(input.quantity))||Number(input.quantity)<1||Number(input.quantity)>100)throw new Error('Quantity must be a whole number between 1 and 100.');
 const quantity=Number(input.quantity);
 const result={itemId:item.id,itemName:item.name,kind:item.kind,amount,quantity,category:input.category,source:sources[item.source],referenceRate:item.rate,brand:input.brand||'rail-neer'};
 if(item.kind==='meal'&&input.category!=='mail-express')return {...result,status:'review',title:'This purchase needs a different tariff',reason:'Premium trains, prepaid catering and restaurant orders can use different menus. This standard meal rate cannot verify that purchase.'};
 if(item.kind==='water'&&input.brand!=='rail-neer')return {...result,status:'review',title:'Brand authorization needs review',reason:'The reference price also covers railway-shortlisted brands. This prototype has no current route-specific brand registry and cannot certify this bottle.'};
 const expected=Number((item.rate*quantity).toFixed(2));
 const difference=Number((amount-expected).toFixed(2));
 return {...result,expected,difference,status:difference>0?'above':'within',title:difference>0?`₹${difference} above the listed tariff`:'Within the listed tariff',reason:'Based on the item, quantity and amount you confirmed. This comparison supports a review, and does not establish vendor wrongdoing.'};
}
export function extractReceipt(text='') {
 const clean=String(text).slice(0,30000);
 let itemId='';
 if(/water|rail\s*neer|bottle/i.test(clean)) itemId=/500\s*m[l1]/i.test(clean)?'water-500':'water-1l';
 else if(/breakfast/i.test(clean))itemId=/egg|omelet|non.?veg/i.test(clean)?'egg-breakfast':'veg-breakfast';
 else if(/chicken/i.test(clean))itemId='chicken-meal';
 else if(/egg/i.test(clean))itemId='egg-meal';
 else if(/veg|thali|meal/i.test(clean))itemId='veg-meal';
 const total=[...clean.matchAll(/(?:grand\s*total|total\s*(?:paid|amount)?|amount\s*paid|paid|payable)\s*[:=\-]?\s*(?:rs\.?|inr|₹)?\s*(\d{1,5}(?:\.\d{1,2})?)/ig)].at(-1);
 return {text:clean,itemId,amount:total?Number(total[1]):null,needsConfirmation:true};
}
export function reportText(report) {
 const r=report.verification;
 return ['Railway catering report draft',`Train ${report.trainNumber}`,`Vendor reference ${report.vendorId||'Not supplied'}`,`Purchase ${r.itemName}`,`Quantity ${r.quantity}`,`Passenger-reported payment ₹${r.amount}`,`Listed total ₹${r.expected??'Needs tariff review'}`,`Difference ₹${r.difference??'Unverified'}`,`Source ${r.source.url}`,`Created ${report.createdAt}`,report.location?`Passenger-consented location ${report.location.latitude}, ${report.location.longitude} (accuracy ${report.location.accuracy??'unknown'} m)`:'Location not shared',`Details ${report.description||'No additional details'}`,'','Prepared by RailVerify. Submit through the official RailMadad process. This local record is not an official grievance.'].join('\n');
}
