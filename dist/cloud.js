import {createClient} from './vendor/supabase.js';
import {fromDatabase,toDatabase} from './cloud-model.js';
export const supabase=createClient('https://kfdohhtqyboffcvgvjei.supabase.co','sb_publishable_hbsp1m7DoQEIRcGirT1jzg_kh0NID9C',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const checked=result=>{if(result.error)throw result.error;return result.data};
export const cloud={user:null,partnerId:null,connectionId:null,admin:false,username:'',
 async init(){const {data,error}=await supabase.auth.getSession();if(error)throw error;this.user=data.session?.user||null;return this.user},
 async login(username,password){const name=username.trim().toLowerCase();if(!/^[a-z0-9_]{3,30}$/.test(name))throw new Error('Enter your username.');const data=checked(await supabase.auth.signInWithPassword({email:`${name}@accounts.remindful.invalid`,password}));this.user=data.user;return data.user},
 async logout(){checked(await supabase.auth.signOut({scope:'local'}));this.user=null;this.partnerId=null;this.connectionId=null;this.admin=false;this.username=''},
 async load(){
  const id=this.user?.id;if(!id)throw new Error('Sign in first.');
  const results=await Promise.all([supabase.from('subscriptions').select('*'),supabase.from('events').select('*'),supabase.from('user_preferences').select('*').eq('user_id',id).maybeSingle(),supabase.from('partner_memberships').select('*'),supabase.from('user_accounts').select('username').eq('user_id',id).maybeSingle(),supabase.rpc('is_app_admin')]);
  const [subs,events,prefs,members,account,isAdmin]=results.map(checked);
  if(this.user?.id!==id)throw new Error('Your session changed.');
  this.connectionId=members.find(m=>m.user_id===id)?.connection_id||null;
  this.partnerId=members.find(m=>m.user_id!==id)?.user_id||null;this.username=account?.username||this.user.user_metadata?.username||'Account';this.admin=isAdmin===true;
  return {items:[...subs.map(r=>fromDatabase(r,'subscriptions',id)),...events.map(r=>fromDatabase(r,r.kind,id))],preferences:{layout:prefs?.layout||'focus',theme:prefs?.theme||'system',notifications:prefs?.notifications||false}};
 },
 async put(item){const table=item.kind==='subscriptions'?'subscriptions':'events';const row=toDatabase(item,this.user.id,this.partnerId,this.connectionId);const rows=checked(await supabase.from(table).upsert(row,{onConflict:'id'}).select('id'));if(rows.length!==1)throw new Error('This item is no longer available.');},
 async remove(item){const rows=checked(await supabase.from(item.kind==='subscriptions'?'subscriptions':'events').delete().eq('id',item.id).select('id'));if(rows.length!==1)throw new Error('This item is no longer available.');},
 async preferences(values){checked(await supabase.from('user_preferences').upsert({user_id:this.user.id,...values},{onConflict:'user_id'}));},
 async rpc(name,args={}){return checked(await supabase.rpc(name,args));},
 async accounts(body){const {data:{session}}=await supabase.auth.getSession();const response=await fetch('https://kfdohhtqyboffcvgvjei.supabase.co/functions/v1/manage-accounts',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_hbsp1m7DoQEIRcGirT1jzg_kh0NID9C',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify(body)});const result=await response.json();if(!response.ok||result.error)throw new Error(result.error||'Account service is unavailable.');return result;},
 async password(currentPassword,newPassword){checked(await supabase.auth.signInWithPassword({email:this.user.email,password:currentPassword}));checked(await supabase.auth.updateUser({password:newPassword}));}
};
