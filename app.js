/* Recitation Tracker starter app
   Local-first demo: data is stored in this browser using localStorage.
   For a production release, migrate storage to IndexedDB and add authenticated Supabase sync.
*/
const STORAGE_KEY = "recitation_tracker_v1";
const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
const initials = (name="") => name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "?";
const escapeHTML = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const demoNames = ["Maria Santos","Sofia Garcia","Juan Dela Cruz","Pedro Lim","Ana Reyes","Miguel Cruz","Angela Mendoza","Carlo Rivera","Bea Flores","Mark Villanueva","Liza Ramos","Daniel Torres","Ella Castillo","Paolo Navarro","Nina Bautista","Rafael Gomez","Kimberly Diaz","Joshua Fernandez","Patricia Lopez","Gabriel Aquino","Trisha Mercado","Nathaniel Perez","Jasmine Tan","Christian David","Andrea Silva","Lorenzo Castro","Mikaela Robles","Adrian Santiago","Camille Valdez","Francis Yu","Leah Cabrera","Enzo Morales","Bianca Herrera","Noah Aguilar","Samantha Ortiz"];
const ROSTER = ["CATIGMOT, JAMES KEVIN D.","DAVID, JHAN ALLEN N.","DECIN, RENZ JOHN T.","ENORE, JOHN KERBY A.","FAJILAGOT, RHYNJAY D.","FILLARCA, JOHN GABRIEL","FERNANDEZ, ALEXANDER G.","GALANG, KIAN VINCE M.","GALICIA, IVAN KHURL T.","GALICIA, MAYNARD G.","MERANO, FEDIE B.","MESANA, CJ E.","SIA, CHRIS JOHN M.","TAMAYO, RON ALLEN G.","VENERACION, KEVIN LAWRENZ"];
function rosterClass(){return {id:"class-roster",name:"Grade 11 – Class List",subject:"General Mathematics",grade:"Grade 11",students:ROSTER.map((name,i)=>({id:uid(),name,seat:i+1,group:i%4+1}))};}
function makeDemo(){
  const students = demoNames.map((name,i)=>({id:uid(),name,seat:i+1,group:i%4+1}));
  return {
    settings:{teacher:"Teacher",school:"Alcantara National High School"},
    classes:[{id:"class-1",name:"Grade 11 – Sampaguita",subject:"General Mathematics",grade:"Grade 11",students},rosterClass()],
    activeClassId:"class-roster",attendance:[],records:[],
    groups:[{id:1,name:"Magigiting",points:85},{id:2,name:"Masipag",points:92},{id:3,name:"Matatag",points:78},{id:4,name:"Masinop",points:88}]
  };
}
let data;
try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeDemo(); } catch { data = makeDemo(); }
let currentStudentId=null, queueFilter="all", timerSeconds=90, timerInterval=null, selectedAttendance={};
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
function activeClass(){return data.classes.find(c=>c.id===data.activeClassId)||data.classes[0];}
function students(){return activeClass()?.students||[];}
function todayRecords(){return data.records.filter(r=>r.classId===activeClass()?.id && r.date===todayISO());}
function recordsFor(studentId){return data.records.filter(r=>r.classId===activeClass()?.id && r.studentId===studentId);}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2500);}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===name));const labels={dashboard:"Dashboard",classes:"My Classes",attendance:"Attendance",recitation:"Recitation",groups:"Group Activity",generator:"Group Generator",students:"Students",reports:"Reports",settings:"Settings & Backup"};$("pageTitle").textContent=labels[name]||"Dashboard";$("sidebar").classList.remove("open");if(name==="dashboard")renderDashboard();if(name==="classes")renderClasses();if(name==="attendance")renderAttendance();if(name==="recitation")renderRecitation();if(name==="groups")renderGroups();if(name==="generator")renderGenerator();if(name==="students")renderStudents();if(name==="reports")renderReports();if(name==="settings")loadSettings();}
function populateClassSelects(){const selects=["dashboardClassSelect","attendanceClassSelect","recitationClassSelect","studentsClassSelect","generatorClassSelect"];selects.forEach(id=>{const el=$(id);if(!el)return;el.innerHTML=data.classes.map(c=>`<option value="${c.id}" ${c.id===data.activeClassId?"selected":""}>${escapeHTML(c.name)}</option>`).join("");});}
function switchClass(id){if(data.classes.some(c=>c.id===id)){data.activeClassId=id;currentStudentId=null;save();populateClassSelects();renderDashboard();}}
function renderDashboard(){
  populateClassSelects();const list=students(), rec=todayRecords(), scored=data.records.filter(r=>r.classId===activeClass()?.id);
  $("statStudents").textContent=list.length;$("statRecited").textContent=new Set(rec.map(r=>r.studentId)).size;$("statWaiting").textContent=Math.max(0,list.length-new Set(rec.map(r=>r.studentId)).size)+" waiting";
  $("statAverage").textContent=scored.length?Math.round(avg(scored.map(r=>r.score))*10)/10+"/10":"—";
  const top=[...data.groups].sort((a,b)=>b.points-a.points)[0];$("statTopGroup").textContent=top?.name||"—";
  const sorted=list.map(s=>({s,rs:recordsFor(s.id)})).sort((a,b)=>avg(b.rs.map(r=>r.score))-avg(a.rs.map(r=>r.score)));
  $("leaderboardBody").innerHTML=sorted.slice(0,8).map((x,i)=>`<tr><td>${i+1}</td><td><div class="student-cell"><span class="student-avatar">${initials(x.s.name)}</span>${escapeHTML(x.s.name)}</div></td><td><strong>${x.rs.length?avg(x.rs.map(r=>r.score)).toFixed(1)+"/10":"—"}</strong></td><td>${x.rs.length}</td><td><span class="pill ${x.rs.length?"green":"yellow"}">${x.rs.length?"Recorded":"Waiting"}</span></td></tr>`).join("")||`<tr><td colspan="5" class="empty-state">No students in this class.</td></tr>`;
  const count=list.filter(s=>recordsFor(s.id).length>0).length;const pct=list.length?Math.round(count/list.length*100):0;$("balancePercent").textContent=pct+"%";$("balanceBar").style.width=pct+"%";$("neverRecited").textContent=list.filter(s=>recordsFor(s.id).length===0).length;$("lowParticipation").textContent=list.filter(s=>{const n=recordsFor(s.id).length;return n>0&&n<=2}).length;
  const recent=[...data.records].filter(r=>r.classId===activeClass()?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  $("recentActivity").innerHTML=recent.map(r=>{const s=list.find(x=>x.id===r.studentId);return `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHTML(s?.name||"Former student")} · ${r.result} (${r.score}/10)</strong><small>${new Date(r.createdAt).toLocaleString()}</small></div></div>`}).join("")||`<div class="empty-state">No recitation records yet. Start a session to see activity here.</div>`;
}
function renderClasses(){ $("classGrid").innerHTML=data.classes.map(c=>`<article class="class-card ${c.id===data.activeClassId?"active-class":""}"><span class="pill ${c.id===data.activeClassId?"green":"gray"}">${c.id===data.activeClassId?"Active class":"Available class"}</span><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.subject||"Subject not set")}</p><div class="class-meta"><span>♙ ${c.students.length} students</span><span>${escapeHTML(c.grade||"")}</span></div><button class="btn btn-primary" data-class-select="${c.id}">Open Class</button><button class="btn btn-outline" data-class-edit="${c.id}">Edit</button></article>`).join("")||`<div class="empty-state">No classes yet.</div>`;}
/* ---------- Attendance grid (spreadsheet style) ---------- */
const ATT_STATUS={P:"Present",A:"Absent",L:"Late",E:"Excused"};
const ATT_CODE={Present:"P",Absent:"A",Late:"L",Excused:"E"};
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYLET={1:"M",2:"T",3:"W",4:"Th",5:"F"};
let attMonth=todayISO().slice(0,7), attTarget=null;
function noClassDates(){const id=activeClass()?.id;if(!data.noClass)data.noClass={};if(!data.groupSets)data.groupSets=[];return data.noClass[id]||(data.noClass[id]=[]);}
function monthDays(ym){const [y,m]=ym.split("-").map(Number);const out=[];const n=new Date(y,m,0).getDate();for(let d=1;d<=n;d++){const dow=new Date(y,m-1,d).getDay();if(dow>=1&&dow<=5)out.push({date:ym+"-"+String(d).padStart(2,"0"),dow,day:d});}return out;}
function attMap(){const id=activeClass()?.id;const m=new Map();data.attendance.forEach(a=>{if(a.classId===id)m.set(a.studentId+"|"+a.date,a);});return m;}
function studentTotals(s,days,off,map){const t={P:0,A:0,L:0,E:0};days.forEach(d=>{if(off.has(d.date))return;const r=map.get(s.id+"|"+d.date);if(r&&ATT_CODE[r.status])t[ATT_CODE[r.status]]++;});const marked=t.P+t.A+t.L+t.E;t.rate=marked?Math.round((t.P+t.L)/marked*100):null;return t;}
function cellAt(r,c){return document.querySelector(`#attendanceTable .att-cell[data-r="${r}"][data-c="${c}"]`);}
function renderAttendance(){
  populateClassSelects();const cls=activeClass();if(!cls)return;
  $("attendanceMonth").value=attMonth;
  const wrap=$("attendanceGrid"),sl=wrap.scrollLeft,st=wrap.scrollTop;
  const days=monthDays(attMonth),weeks=[];
  days.forEach(d=>{let w=weeks[weeks.length-1];if(!w||d.dow===1){w={days:[]};weeks.push(w);}w.days.push(d);});
  const off=new Set(noClassDates()),map=attMap(),list=cls.students.slice().sort((a,b)=>(a.seat||0)-(b.seat||0));
  const mon=MONTHS[+attMonth.slice(5,7)-1];
  const startCol=new Set(weeks.map(w=>w.days[0].date));
  let h1=`<th rowspan="3" class="c-no">No.</th><th rowspan="3" class="c-name">LEARNER'S NAME</th>`;
  weeks.forEach((w,i)=>{const a=w.days[0].day,b=w.days[w.days.length-1].day;h1+=`<th colspan="${w.days.length}" class="wk-start">${w.days.length<3?"Wk "+(i+1):"Week "+(i+1)+" · "+mon+" "+a+(b!==a?"–"+b:"")}</th>`;});
  h1+=`<th colspan="5" class="wk-start">Monthly Summary</th>`;
  let h2="",h3="";
  days.forEach(d=>{const ws=startCol.has(d.date)?" wk-start":"";h2+=`<th class="${ws.trim()}">${DAYLET[d.dow]}</th>`;h3+=`<th class="dayhead${ws}${off.has(d.date)?" off":""}" data-date="${d.date}" title="Column options">${d.day}</th>`;});
  const sums=["P","A","L","E","Rate"];
  h2+=sums.map((x,i)=>`<th rowspan="2" class="${i===0?"wk-start":""}">${x}</th>`).join("");
  let body="";
  list.forEach((s,r)=>{
    body+=`<tr><td class="c-no">${r+1}</td><td class="c-name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</td>`;
    days.forEach((d,c)=>{const ws=startCol.has(d.date)?" wk-start":"";
      if(off.has(d.date)){body+=`<td class="att-cell off${ws}" data-r="${r}" data-c="${c}" data-off="1"></td>`;return;}
      const rec=map.get(s.id+"|"+d.date),code=rec?ATT_CODE[rec.status]:"";
      body+=`<td class="att-cell${code?" st-"+code:""}${ws}" tabindex="-1" data-r="${r}" data-c="${c}" data-s="${s.id}" data-d="${d.date}">${code}</td>`;});
    const t=studentTotals(s,days,off,map);
    body+=`<td class="sum-cell wk-start">${t.P||""}</td><td class="sum-cell">${t.A||""}</td><td class="sum-cell">${t.L||""}</td><td class="sum-cell">${t.E||""}</td><td class="sum-cell">${t.rate===null?"":t.rate+"%"}</td></tr>`;
  });
  if(!list.length)body=`<tr><td colspan="${days.length+7}" class="empty-state">No students in this class yet. Add them under Students.</td></tr>`;
  let foot="";
  [["PRESENT",s=>s==="P"||s==="L"],["ABSENT",s=>s==="A"]].forEach(([label,test])=>{
    foot+=`<tr class="att-total"><td class="c-no"></td><td class="c-name">${label}</td>`;
    days.forEach(d=>{const ws=startCol.has(d.date)?" wk-start":"";if(off.has(d.date)){foot+=`<td class="${ws.trim()}"></td>`;return;}
      let n=0,any=false;list.forEach(s=>{const rec=map.get(s.id+"|"+d.date);if(rec){any=true;if(test(ATT_CODE[rec.status]))n++;}});foot+=`<td class="${ws.trim()}">${any?n:""}</td>`;});
    foot+=`<td colspan="5" class="wk-start"></td></tr>`;
  });
  $("attendanceTable").innerHTML=`<thead><tr>${h1}</tr><tr>${h2}</tr><tr>${h3}</tr></thead><tbody>${body}</tbody>${list.length?`<tfoot>${foot}</tfoot>`:""}`;
  const first=document.querySelector("#attendanceTable .att-cell:not([data-off])");if(first)first.tabIndex=0;
  wrap.scrollLeft=sl;wrap.scrollTop=st;
  $("attendanceCount").textContent=`${list.length} learners · ${days.length-days.filter(d=>off.has(d.date)).length} class days`;
}
function setAttendance(studentId,date,code){const id=activeClass().id;const old=data.attendance.find(a=>a.classId===id&&a.studentId===studentId&&a.date===date);data.attendance=data.attendance.filter(a=>!(a.classId===id&&a.studentId===studentId&&a.date===date));if(code)data.attendance.push({id:uid(),classId:id,studentId,date,status:ATT_STATUS[code],note:old?.note||"",createdAt:new Date().toISOString()});}
function applyCell(td,code,moveDown){const r=+td.dataset.r,c=+td.dataset.c;setAttendance(td.dataset.s,td.dataset.d,code);save();renderAttendance();let el=cellAt(moveDown?r+1:r,c);while(el&&el.dataset.off){el=cellAt(+el.dataset.r+1,c);}(el||cellAt(r,c))?.focus();}
function closeAttMenu(){$("attMenu").hidden=true;attTarget=null;}
function openAttMenu(anchor,items,target){attTarget=target;const m=$("attMenu");m.innerHTML=items.map(i=>`<button type="button" data-act="${i.act}">${i.chip?`<b class="kc st-${i.chip}">${i.chip}</b>`:""}${i.label}</button>`).join("");m.hidden=false;const r=anchor.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;m.style.left=Math.max(8,Math.min(r.left,innerWidth-mw-8))+"px";m.style.top=(r.bottom+mh+8>innerHeight?Math.max(8,r.top-mh):r.bottom)+"px";}
function attMenuAction(act){const t=attTarget;if(!t)return;closeAttMenu();
  if(t.type==="cell"){applyCell(t.td,act==="clear"?"":act,false);return;}
  const date=t.date,cls=activeClass();
  if(act==="off"){const arr=noClassDates();const i=arr.indexOf(date);if(i>=0)arr.splice(i,1);else arr.push(date);save();renderAttendance();toast(i>=0?"Class day restored.":"Marked as no class.");return;}
  cls.students.forEach(s=>setAttendance(s.id,date,act==="P"?"P":""));save();renderAttendance();toast(act==="P"?"All learners marked present.":"Column cleared.");}
function attGridClick(e){
  const th=e.target.closest(".dayhead");
  if(th){openAttMenu(th,[{act:"P",chip:"P",label:"Mark all present"},{act:"clear",label:"Clear this day"},{act:"off",label:th.classList.contains("off")?"Restore class day":"No class (holiday / suspension)"}],{type:"col",date:th.dataset.date});return;}
  const td=e.target.closest(".att-cell");if(!td||td.dataset.off)return;
  td.focus();
  openAttMenu(td,[{act:"P",chip:"P",label:"Present"},{act:"A",chip:"A",label:"Absent"},{act:"L",chip:"L",label:"Late"},{act:"E",chip:"E",label:"Excused"},{act:"clear",label:"Clear"}],{type:"cell",td});
}
function attGridKey(e){const td=e.target.closest(".att-cell");if(!td||td.dataset.off)return;const k=e.key,r=+td.dataset.r,c=+td.dataset.c;
  const go=(dr,dc)=>{let nr=r+dr,nc=c+dc,el=cellAt(nr,nc);while(el&&el.dataset.off){nr+=dr;nc+=dc;el=cellAt(nr,nc);}if(el){closeAttMenu();el.focus();}};
  if(k==="ArrowDown"||k==="Enter"){e.preventDefault();go(1,0);}
  else if(k==="ArrowUp"){e.preventDefault();go(-1,0);}
  else if(k==="ArrowLeft"){e.preventDefault();go(0,-1);}
  else if(k==="ArrowRight"||k==="Tab"&&!e.shiftKey&&cellAt(r,c+1)){e.preventDefault();go(0,1);}
  else if(k===" "||k==="F2"){e.preventDefault();td.click();}
  else if(k==="Backspace"||k==="Delete"){e.preventDefault();applyCell(td,"",false);}
  else if(/^[pale]$/i.test(k)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();applyCell(td,k.toUpperCase(),true);}
  else if(k==="Escape")closeAttMenu();
}
function shiftMonth(n){const [y,m]=attMonth.split("-").map(Number);const d=new Date(y,m-1+n,1);attMonth=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");renderAttendance();}
/* ---------- Wheel of Names (random picker) ---------- */
const WHEEL_COLORS=["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#FF6B9D","#A29BFE","#6C5CE7"];
let wheelAngle=0, wheelSpinning=false, wheelPool=[];
function wheelLabel(name){const n=(name||"").trim();const m=n.match(/^([^,]+),\s*(\S+)/);const t=m?m[1].trim()+", "+m[2]:n.split(/\s+/).slice(0,2).join(" ");return t.length>22?t.slice(0,21)+"…":t;}
function wheelCandidates(){const all=students();if(!$("wheelSkipDone").checked)return all;const done=new Set(todayRecords().map(r=>r.studentId));const left=all.filter(s=>!done.has(s.id));return left.length?left:all;}
function drawWheel(){
  const cv=$("wheelCanvas");if(!cv)return;const dpr=window.devicePixelRatio||1,S=440;
  if(cv.width!==Math.round(S*dpr)){cv.width=cv.height=Math.round(S*dpr);}
  const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,S,S);
  const cx=S/2,cy=S/2,R=S/2-16,n=wheelPool.length,TAU=Math.PI*2;
  ctx.beginPath();ctx.arc(cx,cy,S/2-6,0,TAU);ctx.fillStyle="#fff";ctx.fill();ctx.lineWidth=9;ctx.strokeStyle="#d8c8ff";ctx.stroke();
  if(!n){ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fillStyle="#eef1f6";ctx.fill();ctx.fillStyle="#8a97aa";ctx.font="700 15px 'DM Sans',Arial,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("Add students to this class",cx,cy);return;}
  const seg=TAU/n;
  wheelPool.forEach((s,i)=>{
    const a0=wheelAngle+i*seg;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a0,a0+seg);ctx.closePath();
    let ci=i%WHEEL_COLORS.length;if(i===n-1&&n>1&&ci===0)ci=2;
    ctx.fillStyle=WHEEL_COLORS[ci];ctx.fill();ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=1.5;ctx.stroke();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(a0+seg/2);ctx.textAlign="right";ctx.textBaseline="middle";
    const fs=Math.max(8,Math.min(15,R*.62*seg*.62));ctx.font=`700 ${fs}px 'DM Sans',Arial,sans-serif`;
    ctx.fillStyle="#fff";ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=2;ctx.fillText(wheelLabel(s.name),R-12,0,R-56);ctx.restore();
  });
  ctx.beginPath();ctx.arc(cx,cy,24,0,TAU);ctx.fillStyle="#2d3748";ctx.fill();ctx.lineWidth=4;ctx.strokeStyle="#fff";ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+R-16,cy);ctx.lineTo(S-3,cy-15);ctx.lineTo(S-3,cy+15);ctx.closePath();ctx.fillStyle="#e53e3e";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#fff";ctx.stroke();
}
function pickWinnerIndex(pool){
  if(!$("wheelFair").checked)return Math.floor(Math.random()*pool.length);
  const weights=pool.map(s=>1/(1+recordsFor(s.id).length));const total=weights.reduce((a,b)=>a+b,0);let r=Math.random()*total;
  for(let i=0;i<pool.length;i++){r-=weights[i];if(r<=0)return i;}return pool.length-1;
}
function spinWheel(){
  if(wheelSpinning)return;
  wheelPool=wheelCandidates();if(!wheelPool.length)return toast("Add students first.");
  const n=wheelPool.length,seg=Math.PI*2/n,TAU=Math.PI*2,w=pickWinnerIndex(wheelPool);
  const jitter=(Math.random()-.5)*.7;
  const finalMod=((-(w+.5+jitter)*seg)%TAU+TAU)%TAU,startMod=((wheelAngle%TAU)+TAU)%TAU;
  let delta=((finalMod-startMod)%TAU+TAU)%TAU;delta+=TAU*(5+Math.floor(Math.random()*3));
  const start=wheelAngle,dur=4800+Math.random()*800,t0=performance.now(),winner=wheelPool[w];
  wheelSpinning=true;$("spinWheelBtn").disabled=true;$("wheelSkipDone").disabled=$("wheelFair").disabled=true;$("winnerCard").hidden=true;
  const step=now=>{const t=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-t,4);wheelAngle=start+delta*e;drawWheel();
    if(t<1)requestAnimationFrame(step);
    else{wheelAngle=start+delta;wheelSpinning=false;$("spinWheelBtn").disabled=false;$("wheelSkipDone").disabled=$("wheelFair").disabled=false;finishSpin(winner);}};
  requestAnimationFrame(step);
}
function finishSpin(s){
  chooseStudent(s);resetTimer();
  $("winnerName").textContent=s.name;$("winnerTime").textContent="Selected at "+new Date().toLocaleTimeString();
  const card=$("winnerCard");card.hidden=false;card.classList.remove("pop");void card.offsetWidth;card.classList.add("pop");
}
function chooseStudent(s){if(!s)return;currentStudentId=s.id;$("currentStudentName").textContent=s.name;$("currentAvatar").textContent=initials(s.name);$("currentStudentMeta").textContent=`Seat ${s.seat} · Group ${s.group||"Unassigned"} · ${recordsFor(s.id).length} previous recitations`;renderQueue();}
function renderRecitation(){populateClassSelects();$("wheelSkipDone").checked=data.settings.wheelSkipDone!==false;$("wheelFair").checked=data.settings.wheelFair!==false;$("sessionDate").textContent=new Date().toLocaleDateString();if(currentStudentId&&!students().some(s=>s.id===currentStudentId))currentStudentId=null;if(currentStudentId){const s=students().find(x=>x.id===currentStudentId);if(s)chooseStudent(s);}else{$("currentStudentName").textContent="Choose a student";$("currentAvatar").textContent="?";$("currentStudentMeta").textContent="Use Random Picker to begin.";}if(!currentStudentId)$("winnerCard").hidden=true;renderQueue();resetTimer();}
function renderQueue(){if(!$("wheelCanvas"))return;if(!wheelSpinning)wheelPool=wheelCandidates();const list=students(),done=new Set(todayRecords().map(r=>r.studentId));$("wheelSummary").textContent=`${done.size} recited · ${list.length-done.size} waiting today · ${wheelPool.length} on the wheel`;drawWheel();}
function recordScore(result){const s=students().find(x=>x.id===currentStudentId);if(!s)return toast("Pick a student first.");const content=+$("rubricContent").value,confidence=+$("rubricConfidence").value,participation=+$("rubricParticipation").value;const rubricAvg=(content+confidence+participation)/3;const base={Correct:10,Partial:6,Wrong:2}[result];const score=Math.max(0,Math.min(10,Math.round((base*.7+rubricAvg*2)*10)/10));data.records.push({id:uid(),classId:activeClass().id,studentId:s.id,date:todayISO(),result,score,content,confidence,participation,remark:$("teacherRemark").value.trim(),createdAt:new Date().toISOString()});save();$("teacherRemark").value="";toast(`${result} recorded for ${s.name}: ${score}/10`);renderQueue();renderDashboard();}
function nextStudent(){spinWheel();}
function startTimer(){if(timerInterval)return;timerInterval=setInterval(()=>{timerSeconds=Math.max(0,timerSeconds-1);updateTimer();if(timerSeconds===0){clearInterval(timerInterval);timerInterval=null;toast("Time is up.");}},1000);$("startTimerBtn").textContent="Ⅱ Pause";}
function pauseTimer(){clearInterval(timerInterval);timerInterval=null;$("startTimerBtn").textContent="▶ Start";}
function resetTimer(){pauseTimer();timerSeconds=+$("timerLength").value||90;updateTimer();}
function updateTimer(){$("timerDisplay").textContent=String(Math.floor(timerSeconds/60)).padStart(2,"0")+":"+String(timerSeconds%60).padStart(2,"0");}
function renderGroups(){const list=students();$("groupGrid").innerHTML=data.groups.map(g=>{const members=list.filter(s=>+s.group===g.id);return `<article class="group-card ${g.id===[...data.groups].sort((a,b)=>b.points-a.points)[0]?.id?"leader":""}"><div class="group-top"><h3>${escapeHTML(g.name)}</h3>${g.id===[...data.groups].sort((a,b)=>b.points-a.points)[0]?.id?"🏆":""}</div><div class="group-points">${g.points} <small style="font-size:11px;color:#8290a5">pts</small></div><p>${members.length} members</p><div class="group-members">${members.slice(0,8).map(s=>`<span title="${escapeHTML(s.name)}">${initials(s.name)}</span>`).join("")}</div><div class="group-actions"><button class="btn btn-soft" data-group-add="${g.id}">＋10 Points</button><button class="btn btn-outline" data-group-sub="${g.id}">−5</button></div></article>`}).join("");}
function renderStudents(){populateClassSelects();const term=($("studentSearch").value||"").toLowerCase();const list=students().filter(s=>s.name.toLowerCase().includes(term));$("studentsBody").innerHTML=list.map(s=>{const rs=recordsFor(s.id);return `<tr><td><div class="student-cell"><span class="student-avatar">${initials(s.name)}</span>${escapeHTML(s.name)}</div></td><td>${s.seat}</td><td>Group ${s.group||"—"}</td><td>${rs.length}</td><td>${rs.length?avg(rs.map(r=>r.score)).toFixed(1)+"/10":"—"}</td><td><button class="btn btn-outline" data-student-edit="${s.id}">Edit</button></td></tr>`}).join("")||`<tr><td colspan="6" class="empty-state">No matching students.</td></tr>`;}
function renderReports(){const list=students(),rec=data.records.filter(r=>r.classId===activeClass()?.id),att=data.attendance.filter(a=>a.classId===activeClass()?.id);$("individualStudentSelect").innerHTML=list.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");$("reportPreview").innerHTML=`<div class="preview-stat"><strong>${list.length}</strong><span>Enrolled students</span></div><div class="preview-stat"><strong>${rec.length}</strong><span>Recitation records</span></div><div class="preview-stat"><strong>${att.length}</strong><span>Attendance entries</span></div>`;}
function csvDownload(filename,rows){const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});downloadBlob(filename,blob);}
function downloadBlob(filename,blob){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportRecitation(){const rows=[["No.","Student Name","Seat","Group","Number of Recitations","Average Score","Total Points"],...students().map((s,i)=>{const rs=recordsFor(s.id);return[i+1,s.name,s.seat,s.group,rs.length,rs.length?avg(rs.map(r=>r.score)).toFixed(2):"",rs.reduce((a,r)=>a+r.score,0)]})];csvDownload("recitation-masterlist-"+todayISO()+".csv",rows);toast("Recitation CSV downloaded.");}
function exportAttendance(){const cls=activeClass();if(!cls)return;const days=monthDays(attMonth),off=new Set(noClassDates()),map=attMap();const list=cls.students.slice().sort((a,b)=>(a.seat||0)-(b.seat||0));
  const rows=[["No.","Learner's Name",...days.map(d=>d.date+(off.has(d.date)?" (No class)":"")),"Present","Absent","Late","Excused","Rate %"]];
  list.forEach((s,i)=>{const t=studentTotals(s,days,off,map);rows.push([i+1,s.name,...days.map(d=>{if(off.has(d.date))return"";const r=map.get(s.id+"|"+d.date);return r?ATT_CODE[r.status]||"":"";}),t.P,t.A,t.L,t.E,t.rate===null?"":t.rate]);});
  csvDownload("attendance-"+attMonth+"-"+cls.name.replace(/[^A-Za-z0-9]+/g,"_")+".csv",rows);toast("Attendance grid downloaded.");}
function exportGroups(){const rows=[["Group","Points","Members"],...data.groups.map(g=>[g.name,g.points,students().filter(s=>+s.group===g.id).map(s=>s.name).join("; ")])];csvDownload("group-performance-"+todayISO()+".csv",rows);toast("Group report downloaded.");}
function exportIndividual(){const id=$("individualStudentSelect").value,s=students().find(x=>x.id===id);if(!s)return toast("No student selected.");const rs=recordsFor(s.id);const att=data.attendance.filter(a=>a.classId===activeClass().id&&a.studentId===s.id);const w=window.open("","_blank");if(!w)return toast("Allow pop-ups to print the report.");w.document.write(`<html><head><title>Student Progress Report</title><style>body{font:14px Arial;padding:35px;color:#17243b}h1{color:#123f91}table{border-collapse:collapse;width:100%;margin-top:20px}td,th{border:1px solid #ccd4df;padding:8px;text-align:left}</style></head><body><h1>Recitation Tracker</h1><h2>Individual Student Progress Report</h2><p>${escapeHTML(data.settings.school)} · ${escapeHTML(activeClass().name)}</p><h3>${escapeHTML(s.name)}</h3><p>Seat: ${s.seat} | Group: ${s.group} | Recitations: ${rs.length} | Average: ${rs.length?avg(rs.map(r=>r.score)).toFixed(2):"—"}/10</p><h3>Recitation History</h3><table><tr><th>Date</th><th>Result</th><th>Score</th><th>Remark</th></tr>${rs.map(r=>`<tr><td>${r.date}</td><td>${r.result}</td><td>${r.score}/10</td><td>${escapeHTML(r.remark)}</td></tr>`).join("")}</table><h3>Attendance History</h3><table><tr><th>Date</th><th>Status</th><th>Note</th></tr>${att.map(a=>`<tr><td>${a.date}</td><td>${a.status}</td><td>${escapeHTML(a.note)}</td></tr>`).join("")}</table><p style="margin-top:40px">Teacher's signature: ____________________</p><script>window.print()<\/script></body></html>`);w.document.close();}
function loadSettings(){$("teacherName").value=data.settings.teacher||"";$("schoolName").value=data.settings.school||"";}
function openDialog(title,fields,onSave){$("dialogTitle").textContent=title;$("dialogBody").innerHTML=fields.map(f=>`<div class="modal-field"><label for="modal-${f.name}">${f.label}</label>${f.type==="select"?`<select class="input-control" id="modal-${f.name}">${f.options.map(o=>`<option value="${o.value}">${o.label}</option>`).join("")}</select>`:`<input class="input-control" id="modal-${f.name}" type="${f.type||"text"}" placeholder="${f.placeholder||""}" ${f.value!==undefined?`value="${escapeHTML(f.value)}"`:""}>`}</div>`).join("");const dlg=$("simpleDialog");const saveBtn=$("dialogSave");saveBtn.onclick=(e)=>{e.preventDefault();const values={};fields.forEach(f=>values[f.name]=$("modal-"+f.name).value.trim());if(fields.some(f=>f.required&&!values[f.name]))return toast("Please complete the required fields.");onSave(values);dlg.close();};dlg.showModal();}
function addClass(){openDialog("Add Class",[{name:"name",label:"Class / Section Name",placeholder:"Grade 11 – Sampaguita",required:true},{name:"subject",label:"Subject",placeholder:"General Mathematics"},{name:"grade",label:"Grade Level",placeholder:"Grade 11"}],v=>{const c={id:uid(),name:v.name,subject:v.subject||"General Mathematics",grade:v.grade||"Grade 11",students:[]};data.classes.push(c);data.activeClassId=c.id;save();renderClasses();populateClassSelects();toast("Class added.");});}
function addStudent(){openDialog("Add Student",[{name:"name",label:"Complete name",required:true},{name:"seat",label:"Seat number",type:"number",value:students().length+1},{name:"group",label:"Group",type:"select",options:data.groups.map(g=>({value:g.id,label:g.name}))}],v=>{activeClass().students.push({id:uid(),name:v.name,seat:+v.seat||students().length+1,group:+v.group||1});save();renderStudents();renderDashboard();toast("Student added.");});}
function editStudent(id){const s=students().find(x=>x.id===id);if(!s)return;openDialog("Edit Student",[{name:"name",label:"Complete name",value:s.name,required:true},{name:"seat",label:"Seat number",type:"number",value:s.seat},{name:"group",label:"Group",type:"select",options:data.groups.map(g=>({value:g.id,label:g.name}))}],v=>{s.name=v.name;s.seat=+v.seat||s.seat;s.group=+v.group||s.group;save();renderStudents();renderDashboard();toast("Student updated.");});}
function backup(){downloadBlob("recitation-tracker-backup-"+todayISO()+".json",new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));toast("Backup downloaded.");}
function restore(){const file=$("restoreFile").files[0];if(!file)return toast("Choose a JSON backup file first.");const reader=new FileReader();reader.onload=()=>{try{const restored=JSON.parse(reader.result);if(!restored.classes||!restored.records||!restored.attendance)throw Error("Invalid backup");data=restored;save();populateClassSelects();showView("dashboard");toast("Backup restored.");}catch(e){toast("Could not restore: invalid backup file.");}};reader.readAsText(file);}
function bindEvents(){
 document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
 $("mobileMenu").onclick=()=>$("sidebar").classList.toggle("open");
 $("todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
 ["dashboardClassSelect","attendanceClassSelect","recitationClassSelect","studentsClassSelect","generatorClassSelect"].forEach(id=>$(id).addEventListener("change",e=>{switchClass(e.target.value);if(id==="generatorClassSelect")renderGenerator();if(id==="attendanceClassSelect")renderAttendance();if(id==="recitationClassSelect")renderRecitation();if(id==="studentsClassSelect")renderStudents();}));
 $("addClassBtn").onclick=addClass;$("addStudentBtn").onclick=addStudent;
 $("classGrid").addEventListener("click",e=>{const b=e.target.closest("[data-class-select],[data-class-edit]");if(!b)return;const c=data.classes.find(x=>x.id===(b.dataset.classSelect||b.dataset.classEdit));if(b.dataset.classSelect){switchClass(c.id);showView("dashboard");}else openDialog("Edit Class",[{name:"name",label:"Class name",value:c.name,required:true},{name:"subject",label:"Subject",value:c.subject},{name:"grade",label:"Grade",value:c.grade}],v=>{Object.assign(c,v);save();renderClasses();toast("Class updated.");});});
 $("attendanceMonth").onchange=e=>{if(e.target.value){attMonth=e.target.value;renderAttendance();}};$("attPrevMonth").onclick=()=>shiftMonth(-1);$("attNextMonth").onclick=()=>shiftMonth(1);$("attToday").onclick=()=>{attMonth=todayISO().slice(0,7);renderAttendance();};
 $("attendanceGrid").addEventListener("click",attGridClick);$("attendanceGrid").addEventListener("keydown",attGridKey);
 $("attMenu").addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(b)attMenuAction(b.dataset.act);});
 document.addEventListener("click",e=>{if(!e.target.closest("#attMenu,.att-cell,.dayhead"))closeAttMenu();});
 $("exportAttendanceGrid").onclick=exportAttendance;$("printAttendanceBtn").onclick=()=>window.print();


 $("randomPickerBtn").onclick=nextStudent;$("nextStudentBtn").onclick=nextStudent;$("skipStudentBtn").onclick=()=>{if(!currentStudentId)return toast("Pick a student first.");toast("Student skipped without a score.");nextStudent();};
 $("spinWheelBtn").onclick=spinWheel;["wheelSkipDone","wheelFair"].forEach(id=>$(id).onchange=()=>{data.settings[id]=$(id).checked;save();renderQueue();});

 document.querySelectorAll(".score-btn").forEach(b=>b.onclick=()=>recordScore(b.dataset.result));
 $("startTimerBtn").onclick=()=>timerInterval?pauseTimer():startTimer();$("resetTimerBtn").onclick=resetTimer;$("timerLength").onchange=resetTimer;
 $("groupGrid").addEventListener("click",e=>{const add=e.target.closest("[data-group-add]"),sub=e.target.closest("[data-group-sub]");if(!add&&!sub)return;const g=data.groups.find(x=>x.id===+(add?.dataset.groupAdd||sub.dataset.groupSub));g.points=Math.max(0,g.points+(add?10:-5));save();renderGroups();renderDashboard();toast("Group points updated.");});
 $("resetGroupPoints").onclick=()=>{if(confirm("Reset all group points to zero?")){data.groups.forEach(g=>g.points=0);save();renderGroups();renderDashboard();toast("Group points reset.");}};
 $("randomGroupStudent").onclick=()=>{const s=students().filter(x=>x.group);if(!s.length)return toast("No group members found.");const picked=s[Math.floor(Math.random()*s.length)];toast(`Selected: ${picked.name} · ${data.groups.find(g=>g.id===picked.group)?.name||"Group"}`);};
 $("studentSearch").oninput=renderStudents;$("studentsBody").addEventListener("click",e=>{const b=e.target.closest("[data-student-edit]");if(b)editStudent(b.dataset.studentEdit);});
 $("exportRecitation").onclick=exportRecitation;$("exportAttendance").onclick=exportAttendance;$("exportGroups").onclick=exportGroups;$("exportIndividual").onclick=exportIndividual;$("exportQuick").onclick=exportRecitation;
 $("saveSettings").onclick=()=>{data.settings.teacher=$("teacherName").value.trim();data.settings.school=$("schoolName").value.trim();save();toast("Settings saved.");};
 $("backupBtn").onclick=backup;$("restoreBtn").onclick=restore;
 $("resetAppBtn").onclick=()=>{if(confirm("This will delete all data in this browser and restore demo data. Continue?")){data=makeDemo();save();currentStudentId=null;showView("dashboard");toast("Demo data restored.");}};
}
function init(){if(!data.classes?.length)data=makeDemo();if(!data.groups)data.groups=makeDemo().groups;if(!data.noClass)data.noClass={};if(!data.classes.some(c=>c.id==="class-roster")){data.classes.push(rosterClass());data.activeClassId="class-roster";}save();bindEvents();populateClassSelects();renderDashboard();$("connectionLabel").textContent="Offline-ready · Saved on this device";window.addEventListener("online",()=>$("connectionLabel").textContent="Online · Local demo only");window.addEventListener("offline",()=>$("connectionLabel").textContent="Offline-ready · Saved on this device");}
init();
