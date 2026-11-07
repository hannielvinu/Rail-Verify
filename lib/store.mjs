import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function createStore(filename) {
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
 return {
  db,
  getReport(id){const row=db.prepare('SELECT payload,request_hash FROM reports WHERE id=?').get(id);return row?{...JSON.parse(row.payload),requestHash:row.request_hash}:null;},
  saveReport(report,hash){db.prepare('INSERT INTO reports VALUES(?,?,?,?)').run(report.id,hash,JSON.stringify(report),report.createdAt);return report;},
  listReports(){return db.prepare('SELECT payload FROM reports ORDER BY created_at DESC LIMIT 1000').all().map(x=>JSON.parse(x.payload));},
  claimMessage(id){
   const previous=db.prepare('SELECT state,updated_at FROM messages WHERE id=?').get(id);
   if(previous&&['sent','error-replied'].includes(previous.state))return false;
   if(previous?.state==='processing'&&Date.now()-Date.parse(previous.updated_at)<120000)throw Object.assign(new Error('Webhook event is still processing. Retry later.'),{status:503});
   db.prepare("INSERT INTO messages VALUES(?,'processing',?) ON CONFLICT(id) DO UPDATE SET state='processing',updated_at=excluded.updated_at").run(id,new Date().toISOString());return true;
  },
  finishMessage(id,state){db.prepare('UPDATE messages SET state=?,updated_at=? WHERE id=?').run(state,new Date().toISOString(),id);},
  getConversation(id){const row=db.prepare('SELECT payload FROM conversations WHERE id=?').get(id);return row?JSON.parse(row.payload):{};},
  saveConversation(id,value){db.prepare('INSERT INTO conversations VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(value));},
  close(){db.close();}
 };
}
