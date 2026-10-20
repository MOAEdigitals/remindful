import test from 'node:test';
import assert from 'node:assert/strict';
import {fromDatabase,toDatabase} from '../dist/cloud-model.js';
test('subscription writes always belong to the authenticated user',()=>{
 const row=toDatabase({id:'1',kind:'subscriptions',owner:'partner',name:'Netflix',date:'2026-12-01',amount:100,cycle:'monthly',lead:3},'me','partner','pair');
 assert.equal(row.owner_id,'me');assert.equal(row.currency,'PHP');assert.equal(row.renewal_date,'2026-12-01');assert.equal('connection_id' in row,false);
});
test('shared and private event records round trip without losing the real owner',()=>{
 const data={id:'1',kind:'birthdays',name:'Birthday',owner_id:'partner-id',applies_to_both:true,is_private:false,event_date:'1990-01-03',repeat:'yearly',reminder_days:7,notes:'',created_by:'partner-id',updated_by:'me'};
 const item=fromDatabase(data,'birthdays','me');assert.equal(item.owner,'both');
 const row=toDatabase(item,'me','partner-id','pair');assert.equal(row.owner_id,'partner-id');assert.equal(row.connection_id,'pair');
 const privateRow=toDatabase({...item,owner:'you',private:true},'me','partner-id','pair');assert.equal(privateRow.connection_id,null);assert.equal(privateRow.applies_to_both,false);
});
test('unconnected accounts cannot target another schedule',()=>{
 assert.throws(()=>toDatabase({kind:'personal',owner:'partner'},'me',null,null),/Connect/);
 assert.throws(()=>toDatabase({kind:'personal',owner:'partner',private:true},'me','partner','pair'),/Private/);
});
