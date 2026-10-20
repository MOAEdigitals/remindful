export const CYCLES = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDate = value => new Date(`${value}T12:00:00`);
export function addDays(value, days) { const d = parseDate(value); d.setDate(d.getDate()+days); return dateKey(d); }
function monthDate(anchor, months) {
  const d = parseDate(anchor), day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth()+months, 1, 12);
  const max = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  target.setDate(Math.min(day,max)); return dateKey(target);
}
export function nextDate(item, today = dateKey()) {
  const anchor = item.date;
  const cycle = item.kind === 'subscriptions' ? item.cycle : item.repeat;
  if (anchor >= today || !cycle || cycle === 'once') return anchor;
  if (cycle === 'weekly') {
    const days = daysBetween(anchor,today);
    return addDays(anchor, Math.ceil(days/7)*7);
  }
  const step = {monthly:1,quarterly:3,yearly:12}[cycle];
  if (!step) return anchor;
  const a=parseDate(anchor), t=parseDate(today);
  let count=Math.max(0,Math.floor(((t.getFullYear()-a.getFullYear())*12+t.getMonth()-a.getMonth())/step));
  let next=monthDate(anchor,count*step);
  if(next<today) next=monthDate(anchor,++count*step);
  return next;
}
export function daysBetween(a,b) {
  const x=parseDate(a),y=parseDate(b);
  return Math.round((Date.UTC(y.getFullYear(),y.getMonth(),y.getDate())-Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()))/86400000);
}
export function canAccess(item,user) {
  if(item.kind==='subscriptions') return item.owner===user;
  return !item.private || item.owner===user || (item.owner==='both' && item.creator===user);
}
export function visibleItems(items,user,kind,scope='together') {
  return items.filter(x=>x.kind===kind && canAccess(x,user) && (kind==='subscriptions'||scope==='together'||x.owner==='both'||x.owner===(scope==='mine'?user:otherUser(user))));
}
export const otherUser = user => user==='you'?'partner':'you';
export const monthlyTotal = items => items.reduce((s,x)=>s+Number(x.amount||0)*(CYCLES[x.cycle]||0),0);
export function reminderCandidates(items,user,today=dateKey(),ledger={}) {
  return items.filter(x=>canAccess(x,user)&&!x.completed).map(x=>({item:x,due:nextDate(x,today)})).filter(({item,due})=>{
    const days=daysBetween(today,due);
    return days>=0 && days<=Number(item.lead) && !ledger[`${user}:${item.id}:${due}`];
  });
}
export function seed(today=dateKey()) {
  const record=(id,kind,name,offset,extras={})=>({id,kind,name,date:addDays(today,offset),owner:'you',creator:'you',private:false,lead:3,repeat:'once',notes:'',time:'',...extras});
  return {
    version:1,user:'you',preferences:{you:{layout:'focus',theme:'system',notifications:false},partner:{layout:'focus',theme:'system',notifications:false}},ledger:{},
    items:[
      record('sub-netflix','subscriptions','Netflix',3,{amount:549,cycle:'monthly',private:true,category:'Entertainment',notes:'Sample subscription. Update with your actual plan.'}),
      record('sub-spotify','subscriptions','Spotify',7,{amount:149,cycle:'monthly',private:true,category:'Music'}),
      record('sub-cloud','subscriptions','Cloud storage',15,{amount:1490,cycle:'yearly',private:true,category:'Storage',lead:7}),
      record('sub-partner','subscriptions','YouTube Premium',6,{amount:159,cycle:'monthly',owner:'partner',creator:'partner',private:true,category:'Entertainment'}),
      record('birthday-mom','birthdays','Mom’s birthday',6,{repeat:'yearly',lead:7,notes:'Plan a family dinner.'}),
      record('birthday-friend','birthdays','Best friend’s birthday',10,{repeat:'yearly',owner:'partner',creator:'partner'}),
      record('church-rehearsal','church','Worship rehearsal',6,{repeat:'weekly',time:'16:00',owner:'partner',creator:'partner',location:'Main hall',lead:1}),
      record('church-service','church','Sunday service',7,{repeat:'weekly',time:'09:00',owner:'both',location:'Sanctuary',lead:1}),
      record('personal-dentist','personal','Dental appointment',4,{time:'10:00',location:'Dental clinic',lead:1}),
      record('personal-dinner','personal','Team dinner',5,{time:'19:00',owner:'partner',creator:'partner',lead:1}),
      record('personal-date','personal','Date night',6,{time:'18:30',owner:'both',location:'Pick somewhere together',lead:1}),
      record('personal-private','personal','Personal journal time',2,{time:'20:00',private:true,lead:0})
    ]
  };
}
