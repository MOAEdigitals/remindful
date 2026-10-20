import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const origins=new Set(['https://moaedigitals.github.io','http://127.0.0.1:4173']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://moaedigitals.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST'||(origin&&!origins.has(origin)))return reply({error:'Not allowed'},403);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const body=await req.json();
  let owner=false;
  if(body.action==='setup'){
   if(typeof body.token!=='string'||! /^[0-9a-f-]{36}$/i.test(body.token))return reply({error:'Invalid setup link'},403);
   const {data,error}=await admin.rpc('owner_setup_valid',{setup_token:body.token});
   if(error||!data)return reply({error:'This setup link has expired or has already been used.'},403);
  }else{
   const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
   const {data,error}=await admin.auth.getUser(token);
   if(error||!data.user)return reply({error:'Sign in first'},401);
   const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
   const result=await caller.rpc('is_app_admin');owner=result.data===true&&!result.error;
   if(body.action==='status')return reply({admin:owner});
   if(!owner)return reply({error:'Only the owner can manage accounts.'},403);
  }
  if(body.action==='list'){
   const {data,error}=await admin.from('user_accounts').select('username').order('username');if(error)throw error;return reply({accounts:data});
  }
  const username=String(body.username||'').trim().toLowerCase();
  if(!/^[a-z0-9_]{3,30}$/.test(username))return reply({error:'Use 3–30 letters, numbers, or underscores.'},400);
  const password=body.password;
  if(typeof password!=='string'||password.length<12||password.length>128)return reply({error:'Use a password between 12 and 128 characters.'},400);
  if(body.action==='reset'){
   const {data}=await admin.from('user_accounts').select('user_id').eq('username',username).maybeSingle();
   if(!data)return reply({error:'Account not found'},404);
   const {data:requester}=await admin.auth.getUser(req.headers.get('authorization')!.replace(/^Bearer /i,''));
   if(data.user_id===requester.user?.id)return reply({error:'Use Change my password for your own account.'},400);
   const {error}=await admin.auth.admin.updateUserById(data.user_id,{password});if(error)throw error;return reply({ok:true});
  }
  if(!['create','setup'].includes(body.action))return reply({error:'Unknown action'},400);
  const {data,error}=await admin.auth.admin.createUser({email:`${username}@accounts.remindful.invalid`,password,email_confirm:true,user_metadata:{username}});
  if(error)return reply({error:'Could not create account. The username may already be taken.'},400);
  const id=data.user.id;
  try{
   const account=await admin.from('user_accounts').insert({user_id:id,username});if(account.error)throw account.error;
   const profile=await admin.from('profiles').insert({user_id:id,display_name:username});if(profile.error)throw profile.error;
   if(body.action==='setup'){
    const claim=await admin.rpc('claim_owner_setup',{setup_token:body.token,account_id:id});if(claim.error||claim.data!==true)throw new Error('Owner setup already completed.');
   }
  }catch(error){await admin.auth.admin.deleteUser(id);throw error}
  return reply({ok:true});
 }catch{return reply({error:'The request could not be completed. Please try again.'},400)}
});
