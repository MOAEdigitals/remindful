import test from 'node:test';
import assert from 'node:assert/strict';
import {nextDate,visibleItems,monthlyTotal,reminderCandidates,seed,canAccess} from '../dist/model.js';
test('monthly renewals clamp short months and retain original day afterward',()=>{
 const x={kind:'subscriptions',date:'2026-01-31',cycle:'monthly'};
 assert.equal(nextDate(x,'2026-02-01'),'2026-02-28');
 assert.equal(nextDate(x,'2026-03-01'),'2026-03-31');
 assert.equal(nextDate(x,'2026-03-31'),'2026-03-31');
});
test('annual leap-day reminders clamp to February and restore leap day',()=>{
 const x={kind:'birthdays',date:'2024-02-29',repeat:'yearly'};
 assert.equal(nextDate(x,'2026-01-01'),'2026-02-28');
 assert.equal(nextDate(x,'2028-01-01'),'2028-02-29');
});
test('weekly repeats cross years and one-time events retain their date',()=>{
 assert.equal(nextDate({date:'2026-12-30',repeat:'weekly'},'2027-01-01'),'2027-01-06');
 assert.equal(nextDate({date:'2026-01-01',repeat:'once'},'2027-01-01'),'2026-01-01');
});
test('subscription privacy and private event ownership survive schedule filters',()=>{
 const s=seed('2026-10-18');
 assert.equal(visibleItems(s.items,'you','subscriptions').length,3);
 assert.equal(visibleItems(s.items,'partner','subscriptions').length,1);
 assert.equal(visibleItems(s.items,'partner','personal').some(x=>x.id==='personal-private'),false);
 assert.equal(visibleItems(s.items,'you','personal','partner').some(x=>x.owner==='both'),true);
 assert.equal(canAccess(s.items.find(x=>x.id==='personal-dinner'),'you'),true);
});
test('monthly equivalent handles yearly and quarterly subscriptions',()=>{
 assert.equal(monthlyTotal([{amount:1200,cycle:'yearly'},{amount:300,cycle:'quarterly'},{amount:100,cycle:'monthly'}]),300);
});
test('reminders exclude other subscriptions, past one-time events, completed and previously sent reminders',()=>{
 const s=seed('2026-10-18');
 s.items.push({id:'old',name:'Old event',kind:'personal',date:'2026-10-01',repeat:'once',owner:'you',lead:30});
 const first=reminderCandidates(s.items,'you','2026-10-18',{});
 assert.ok(first.some(({item})=>item.id==='sub-netflix'));
 assert.ok(!first.some(({item})=>item.id==='sub-partner'||item.id==='old'));
 const ledger=Object.fromEntries(first.map(({item,due})=>[`you:${item.id}:${due}`,true]));
 assert.equal(reminderCandidates(s.items,'you','2026-10-18',ledger).length,0);
});
