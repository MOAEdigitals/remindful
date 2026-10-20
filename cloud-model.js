export function fromDatabase(row,kind,userId){
 const sub=kind==='subscriptions';
 const label=id=>id===userId?'you':'partner';
 return {id:row.id,kind:sub?kind:row.kind,name:row.name,date:sub?row.renewal_date:row.event_date,
 owner:!sub&&row.applies_to_both?'both':label(row.owner_id),dbOwner:row.owner_id,
 creator:label(row.created_by||row.owner_id),updatedBy:label(row.updated_by||row.owner_id),updatedAt:row.updated_at,
 private:sub||row.is_private,lead:row.reminder_days,notes:row.notes,
 ...(sub?{amount:Number(row.amount),cycle:row.cycle,category:row.category}:{repeat:row.repeat,time:row.event_time?.slice(0,5)||'',location:row.location,completed:row.completed})};
}
export function toDatabase(item,userId,partnerId,connectionId){
 const common={id:item.id,name:item.name,reminder_days:Number(item.lead),notes:item.notes||''};
 if(item.kind==='subscriptions')return {...common,owner_id:userId,amount:item.amount,currency:'PHP',cycle:item.cycle,renewal_date:item.date,category:item.category||''};
 if((item.owner==='partner'||item.owner==='both')&&!connectionId)throw new Error('Connect a partner first.');
 if(item.private&&item.owner!=='you')throw new Error('Private events must use your own schedule.');
 return {...common,owner_id:item.owner==='partner'?partnerId:item.owner==='both'?(item.dbOwner||userId):userId,
 connection_id:item.private?null:connectionId,applies_to_both:item.owner==='both',is_private:!!item.private,
 kind:item.kind,event_date:item.date,event_time:item.time||null,repeat:item.kind==='birthdays'?'yearly':item.repeat,
 location:item.location||'',completed:!!item.completed};
}
