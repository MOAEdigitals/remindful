import {dateKey,nextDate,parseDate} from './model.js';

export function upcomingBirthdays(items,today=dateKey()) {
  return items.map(item=>({item,date:nextDate({...item,repeat:'yearly'},today)}))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.item.name.localeCompare(b.item.name));
}

export function birthdayMonth(items,year,month) {
  const days=new Date(year,month+1,0).getDate();
  const first=dateKey(new Date(year,month,1,12));
  const entries=upcomingBirthdays(items,first).filter(x=>x.date.slice(0,7)===first.slice(0,7));
  const offset=(new Date(year,month,1).getDay()+6)%7;
  return {days,offset,entries};
}

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function birthdayCalendar(items,month,expanded,icon) {
  const year=month.getFullYear(),m=month.getMonth();
  const {days,offset,entries}=birthdayMonth(items,year,m);
  const monthName=month.toLocaleDateString('en-PH',{month:'long',year:'numeric'});
  const count=Math.ceil((offset+days)/7)*7;
  const cells=Array.from({length:count},(_,i)=>{
    const day=i-offset+1;
    if(day<1||day>days)return '<div class="birthday-blank" aria-hidden="true"></div>';
    const date=dateKey(new Date(year,m,day,12)),birthdays=entries.filter(x=>x.date===date),today=date===dateKey();
    const label=`${parseDate(date).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}, ${birthdays.length} birthday${birthdays.length===1?'':'s'}`;
    if(!expanded)return `<button type="button" class="birthday-day ${today?'is-today':''} ${birthdays.length?'has-birthday':''}" data-birthday-day="${date}" aria-label="${escape(label)}" ${today?'aria-current="date"':''}><span>${day}</span><span class="birthday-dots" aria-hidden="true">${birthdays.length?'<i></i>':''}</span></button>`;
    return `<div class="birthday-cell ${today?'is-today':''}" aria-label="${escape(label)}"><span class="birthday-number" ${today?'aria-current="date"':''}>${day}</span>${birthdays.map(({item})=>`<div class="calendar-birthday"><button type="button" data-edit="${escape(item.id)}" aria-label="Edit ${escape(item.name)}">${escape(item.name)}</button><button type="button" data-delete="${escape(item.id)}" aria-label="Delete ${escape(item.name)}">${icon('trash')}</button></div>`).join('')}</div>`;
  }).join('');
  return `<section class="birthday-calendar ${expanded?'expanded':'compact'}" aria-label="Birthday calendar"><div class="birthday-monthbar"><h2 aria-live="polite">${monthName}</h2><div class="birthday-month-actions"><button class="text-button" type="button" data-birthday-today>Today</button><button class="icon-button" type="button" data-birthday-month="-1" aria-label="Previous month">‹</button><button class="icon-button" type="button" data-birthday-month="1" aria-label="Next month">›</button></div></div><div class="birthday-weekdays" aria-hidden="true">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="birthday-days">${cells}</div></section>`;
}
