const $=id=>document.getElementById(id);let isAdmin=false,adminLockers=[];
const fa=n=>Number(n).toLocaleString('fa-IR');
function say(msg,error=false){$('feedback').textContent=msg;$('feedback').classList.toggle('error',error)}
function updateClock(){const now=new Date();$('clock').textContent=new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);$('date').textContent=new Intl.DateTimeFormat('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(now)}
setInterval(updateClock,1000);updateClock();
async function api(url,options={}){const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});let data={};try{data=await res.json()}catch{}if(!res.ok)throw Error(data.error||'خطایی رخ داد.');return data}
let state=null;
function renderTiles(){if(!state)return;const ts=$('tableSearch').value.trim(),ls=$('lockerSearch').value.trim();
$('tablesGrid').innerHTML=state.tables.filter(x=>!ts||String(x.number).includes(ts)||fa(x.number).includes(ts)).map(x=>`<div class="tile ${x.occupied?'occupied':''}"><b>میز ${fa(x.number)}</b><small>${x.occupied?'🔴 اشغال':'🟢 آزاد'}</small></div>`).join('')||'<p>میزی پیدا نشد.</p>';
$('lockersGrid').innerHTML=state.lockers.filter(x=>!ls||String(x.number).includes(ls)||fa(x.number).includes(ls)).map(x=>`<div class="tile ${x.occupied?'locker-used':''}"><b>کمد ${fa(x.number)}</b><small>${x.occupied?'🟠 استفاده‌شده':'🟢 آزاد'}</small></div>`).join('')||'<p>کمدی پیدا نشد.</p>';
const ot=state.tables.filter(x=>x.occupied).length,ol=state.lockers.filter(x=>x.occupied).length;
$('occupiedTables').textContent=`${fa(ot)} از ۳۰`;$('freeTables').textContent=fa(30-ot);$('occupiedLockers').textContent=`${fa(ol)} از ۸۹`;$('freeLockers').textContent=fa(89-ol);
$('powerText').textContent=state.power==='on'?'وصل است':'قطع است';$('powerHeadline').textContent=state.power==='on'?'برق سالن وصل است':'برق سالن قطع است';$('powerNote').textContent=state.power_note|| (state.power==='on'?'همه‌چیز برای مطالعه روشن است.':'لطفاً برای اطلاع از جزئیات با مسئول سالن هماهنگ کنید.');
$('powerBadge').textContent=state.power==='on'?'● برق وصل است':'● برق قطع است';$('powerBadge').classList.toggle('off',state.power!=='on');
$('updatedAt').textContent=new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(state.updated));
$('notices').innerHTML=state.notices.length?state.notices.map(n=>`<article class="notice"><p>${esc(n.text)}</p><small>${new Date(n.created_at).toLocaleString('fa-IR')}</small>${isAdmin?`<button class="btn logout" onclick="removeNotice(${n.id})">حذف اطلاعیه</button>`:''}</article>`).join(''):'<p class="muted">هنوز اطلاعیه‌ای ثبت نشده است.</p>';
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function refresh(){try{state=await api('/api/status');renderTiles()}catch(e){say(e.message,true)}}
async function refreshAdminLockers(){if(!isAdmin)return;try{adminLockers=(await api('/api/admin/lockers')).lockers}catch{}}
$('tableSearch').addEventListener('input',renderTiles);$('lockerSearch').addEventListener('input',renderTiles);
$('loginBtn').onclick=async()=>{try{await api('/api/login',{method:'POST',body:JSON.stringify({password:$('password').value})});isAdmin=true;$('adminBox').hidden=false;$('loginBox').hidden=true;$('adminStatus').textContent='واردشده به‌عنوان مدیر';$('adminStatus').classList.add('on');$('password').value='';await refreshAdminLockers();say('با موفقیت وارد پنل مدیریت شدید.');renderTiles()}catch(e){say(e.message,true)}};
$('password').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
$('saveTable').onclick=async()=>{try{await api('/api/tables',{method:'POST',body:JSON.stringify({number:$('editTableNo').value,occupied:$('editTableState').value==='1'})});await refresh();say('وضعیت میز ذخیره شد.')}catch(e){say(e.message,true)}};
$('saveLocker').onclick=async()=>{try{await api('/api/lockers',{method:'POST',body:JSON.stringify({number:$('editLockerNo').value,occupied:$('editLockerState').value==='1',person:$('editLockerPerson').value})});await refresh();await refreshAdminLockers();say('اطلاعات کمد ذخیره شد.')}catch(e){say(e.message,true)}};
$('editLockerState').onchange=()=>{if($('editLockerState').value==='0')$('editLockerPerson').value=''};
$('viewLocker').onclick=async()=>{try{await refreshAdminLockers();const n=Number($('viewLockerNo').value),x=adminLockers.find(a=>a.number===n);if(!x)throw Error('شماره کمد معتبر نیست.');$('lockerDetails').textContent=x.occupied?`کمد ${fa(n)} — استفاده‌کننده: ${x.person||'نام ثبت نشده'}`:`کمد ${fa(n)} — آزاد است.`}catch(e){say(e.message,true)}};
$('savePower').onclick=async()=>{try{await api('/api/power',{method:'POST',body:JSON.stringify({power:$('editPower').value,note:$('editPowerNote').value})});await refresh();say('وضعیت برق ذخیره شد.')}catch(e){say(e.message,true)}};
$('addNotice').onclick=async()=>{try{await api('/api/notices',{method:'POST',body:JSON.stringify({text:$('noticeText').value})});$('noticeText').value='';await refresh();say('اطلاعیه منتشر شد.')}catch(e){say(e.message,true)}};
async function removeNotice(id){try{await api('/api/notices/'+id,{method:'DELETE'});await refresh();say('اطلاعیه حذف شد.')}catch(e){say(e.message,true)}}
$('logoutBtn').onclick=async()=>{try{await api('/api/logout',{method:'POST'});isAdmin=false;$('adminBox').hidden=true;$('loginBox').hidden=false;$('adminStatus').textContent='خارج‌شده';$('adminStatus').classList.remove('on');await refresh();say('از پنل مدیریت خارج شدید.')}catch(e){say(e.message,true)}};
$('supportCopy').onclick=async()=>{const phone='09942925491';try{await navigator.clipboard.writeText(phone)}catch{const t=document.createElement('textarea');t.value=phone;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}$('copyFeedback').textContent='شماره پشتیبانی کپی شد ✓'};
refresh();setInterval(refresh,15000);
