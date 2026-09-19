import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppPack } from '../../server/evaluation/whatsapp-pack.mjs';
const guide={evaluation_only:true,source:{sha256:'synthetic'},policy:{send:false},nodes:{
 start:{id:'start',title:'Inicio',text:'Elegí una opción.',source_pages:[8],actions:[{code:'1',label:'Continuar',target:'main'}]},
 main:{id:'main',title:'Áreas',text:'¿Sobre qué querés consultar?',source_pages:[9],actions:[1,2,3,4,5].map(n=>({code:String(n),label:`Área ${n}`,target:'start'}))},
}};
test('same source produces a deterministic draft and never declares provider activation',()=>{
 const p=buildWhatsAppPack(guide); assert.deepEqual(p,buildWhatsAppPack(guide));
 assert.equal(p.provider_calls,0);assert.equal(p.send_enabled,false);assert.equal(p.status,'draft');
 assert.equal(p.messages.length,2);assert.equal(p.list_approval_supported,false);
});
test('three-button limit chooses a list for larger menus',()=>{
 const p=buildWhatsAppPack(guide);assert.equal(p.messages[0].transport,'quick_reply');
 assert.equal(p.messages[1].transport,'list');
 assert.equal(p.messages[1].meta.interactive.action.sections[0].rows.length,5);
 assert.equal(p.messages[0].meta.to,undefined);
});
test('every reply identifier resolves to the original node and code',()=>{
 const p=buildWhatsAppPack(guide);assert.deepEqual(p.bindings['start:1'],{node:'start',selection:'1',target:'main'});
 assert.equal(Object.keys(p.bindings).length,6);
});
test('rejects missing or non-evaluation content',()=>{
 assert.throws(()=>buildWhatsAppPack(null));
 assert.throws(()=>buildWhatsAppPack({...guide,evaluation_only:false}));
});
test('does not change the source object',()=>{
 const before=JSON.stringify(guide);
 buildWhatsAppPack(guide);
 assert.equal(JSON.stringify(guide),before);
});
