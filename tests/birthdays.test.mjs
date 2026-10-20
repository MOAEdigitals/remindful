import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingBirthdays,birthdayMonth} from '../dist/birthdays.js';
const birthday=(id,date)=>({id,name:id,date,kind:'birthdays',repeat:'yearly'});
test('upcoming birthdays cross the year boundary and include today first',()=>{
 const sorted=upcomingBirthdays([birthday('January','1990-01-02'),birthday('Past','1990-10-01'),birthday('Today','1990-10-20')],'2026-10-20');
 assert.deepEqual(sorted.map(x=>[x.item.id,x.date]),[['Today','2026-10-20'],['January','2027-01-02'],['Past','2027-10-01']]);
});
test('month calendar places recurring leap birthdays consistently with reminders',()=>{
 const items=[birthday('Leap','2000-02-29'),birthday('March','1990-03-01')];
 assert.equal(birthdayMonth(items,2026,1).entries[0].date,'2026-02-28');
 assert.equal(birthdayMonth(items,2028,1).entries[0].date,'2028-02-29');
 assert.equal(birthdayMonth(items,2026,1).entries.length,1);
 assert.equal(birthdayMonth(items,2026,1).offset,6);
 assert.equal(birthdayMonth(items,2028,1).days,29);
});
