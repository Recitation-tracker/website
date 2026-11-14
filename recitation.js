/* =====================================================================
   Recitation scoring (Oral Recitation / Boardwork, 5-point Likert rubric)
   and the Recitation Record grid in Reports (same format as Attendance).
   Shared constants (REC_RUBRICS, REC_LEVELS, recTypeLabel) live in app.js.
   ===================================================================== */
const REC_DAYLET={0:"Su",1:"M",2:"T",3:"W",4:"Th",5:"F",6:"Sa"};
let recType=null, recRating=null, recMonth=todayISO().slice(0,7), recTab="oral", recMenuTarget=null;

/* ---------- live scoring panel ---------- */
function recTodayChips(){
  const box=$("todayChips");if(!box)return;
  const rs=currentStudentId?todayRecords().filter(r=>r.studentId===currentStudentId):[];
  box.innerHTML=rs.map(r=>`<span class="pill green">${REC_RUBRICS[r.type]?.icon||""} ${recTypeLabel(r.type)} · ${r.rating}/5 recorded today</span>`).join("");
}
function recResetPanel(){
  recType=null;recRating=null;
  const p=$("rubricPanel");if(!p)return;
  p.hidden=true;$("teacherRemark").value="";
  document.querySelectorAll("#recTypes .rec-type").forEach(b=>b.classList.remove("active"));
  recTodayChips();
}
function recOpen(type){
  if(!currentStudentId)return toast("Spin the wheel to pick a student first.");
  if(recType===type){recResetPanel();return;}
  recType=type;recRating=null;
  const rb=REC_RUBRICS[type];
  document.querySelectorAll("#recTypes .rec-type").forEach(b=>b.classList.toggle("active",b.dataset.type===type));
  $("rubricTitle").textContent=rb.icon+" "+rb.label+" Rubric";
  $("rubricCriterion").innerHTML="<b>General criterion:</b> "+escapeHTML(rb.criterion);
  $("likert").innerHTML=[5,4,3,2,1].map(n=>`<button type="button" class="likert-row" role="radio" aria-checked="false" data-rating="${n}"><span class="lk-num rt-${n}">${n}</span><span class="lk-body"><strong>${REC_LEVELS[n]}</strong><small>${escapeHTML(rb.desc[n])}</small></span><span class="lk-check">✓</span></button>`).join("");
  $("rubricPanel").hidden=false;recSyncSave();
  $("rubricPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function recPick(n){
  recRating=n;
  document.querySelectorAll("#likert .likert-row").forEach(b=>{const on=+b.dataset.rating===n;b.classList.toggle("selected",on);b.setAttribute("aria-checked",on);});
  recSyncSave();
}
function recSyncSave(){
  const b=$("saveRatingBtn");b.disabled=!recRating;
  b.textContent=recRating?`Save ${REC_RUBRICS[recType].label}: ${recRating} · ${REC_LEVELS[recRating]}`:"Select a rating to save";
}
function recSave(){
  const s=students().find(x=>x.id===currentStudentId);
  if(!s)return toast("Pick a student first.");
  if(!recType||!recRating)return toast("Choose a rating first.");
  data.records.push({id:uid(),classId:activeClass().id,studentId:s.id,date:todayISO(),type:recType,rating:recRating,remark:$("teacherRemark").value.trim(),createdAt:new Date().toISOString()});
  save();
  sfx("score",recRating);
  toast(`${recTypeLabel(recType)}: ${recRating} (${REC_LEVELS[recRating]}) saved for ${s.name}`);
  recResetPanel();renderQueue();renderDashboard();
  $("currentStudentMeta").textContent=`Seat ${s.seat} · ${groupName(s)} · ${recordsFor(s.id).length} previous recitations`;
}

/* ---------- Recitation Record grid (Reports) ---------- */
function recFmt(v){return Number.isInteger(v)?String(v):v.toFixed(1);}
function recDays(ym,recs){
  const [y,m]=ym.split("-").map(Number),have=new Set(recs.map(r=>r.date)),n=new Date(y,m,0).getDate(),out=[];
  for(let d=1;d<=n;d++){const iso=ym+"-"+String(d).padStart(2,"0"),dow=new Date(y,m-1,d).getDay();if((dow>=1&&dow<=5)||have.has(iso))out.push({date:iso,dow,day:d});}
  return out;
}
function recGridData(){
  const cls=activeClass();if(!cls)return null;
  const recs=data.records.filter(r=>r.classId===cls.id),days=recDays(recMonth,recs);
  const types=recTab==="all"?["oral","boardwork"]:[recTab];
  const idx=new Map();
  recs.forEach(r=>{if(!types.includes(r.type))return;const k=r.studentId+"|"+r.date;if(!idx.has(k))idx.set(k,[]);idx.get(k).push(r);});
  const list=cls.students.slice().sort((a,b)=>(a.seat||0)-(b.seat||0));
  return {cls,days,idx,list,types};
}
function renderRecGrid(){
  if(!$("recTable"))return;
  const G=recGridData();if(!G)return;
  populateClassSelects();
  const {days,idx,list}=G,off=new Set(noClassDates()),today=todayISO();
  $("recMonth").value=recMonth;
  document.querySelectorAll("#recTabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===recTab));
  $("recHint").textContent=recTab==="all"?"Combined shows each day’s average · O / B = source":"Click a cell to set or fix a rating";
  const weeks=[];days.forEach(d=>{let w=weeks[weeks.length-1];if(!w||d.dow===1){w={days:[]};weeks.push(w);}w.days.push(d);});
  const startCol=new Set(weeks.map(w=>w.days[0].date)),mon=MONTHS[+recMonth.slice(5,7)-1];
  let h1=`<th rowspan="3" class="c-no">No.</th><th rowspan="3" class="c-name">LEARNER'S NAME</th>`;
  weeks.forEach((w,i)=>{const a=w.days[0].day,b=w.days[w.days.length-1].day;h1+=`<th colspan="${w.days.length}" class="wk-start">${w.days.length<3?"Wk "+(i+1):"Week "+(i+1)+" · "+mon+" "+a+(b!==a?"–"+b:"")}</th>`;});
  h1+=`<th colspan="2" class="wk-start">Summary</th>`;
  let h2="",h3="";
  days.forEach(d=>{const ws=startCol.has(d.date)?" wk-start":"";h2+=`<th class="${ws.trim()}">${REC_DAYLET[d.dow]}</th>`;h3+=`<th class="${(ws+(d.date===today?" today":"")).trim()}">${d.day}</th>`;});
  h2+=`<th rowspan="2" class="wk-start">Times</th><th rowspan="2">Avg</th>`;
  let body="";
  list.forEach((s,r)=>{
    body+=`<tr><td class="c-no">${r+1}</td><td class="c-name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</td>`;
    const all=[];
    days.forEach((d,c)=>{
      const ws=startCol.has(d.date)?" wk-start":"",es=idx.get(s.id+"|"+d.date);
      if(!es){body+=`<td class="att-cell${off.has(d.date)?" off":""}${ws}" data-r="${r}" data-c="${c}" data-s="${s.id}" data-d="${d.date}" ${off.has(d.date)?'data-off="1"':""}></td>`;return;}
      es.forEach(e=>all.push(e.rating));
      const v=es.reduce((a,e)=>a+e.rating,0)/es.length;
      const src=recTab==="all"?`<i class="rt-src">${[...new Set(es.map(e=>REC_RUBRICS[e.type].short))].sort().join("")}</i>`:"";
      const tip=es.map(e=>`${recTypeLabel(e.type)}: ${e.rating} – ${REC_LEVELS[e.rating]}${e.remark?" ("+e.remark+")":""}`).join("\n");
      body+=`<td class="att-cell rt-${Math.round(v)}${ws}" data-r="${r}" data-c="${c}" data-s="${s.id}" data-d="${d.date}" title="${escapeHTML(tip)}">${recFmt(v)}${src}</td>`;
    });
    body+=`<td class="sum-cell wk-start">${all.length||""}</td><td class="sum-cell">${all.length?recFmt(Math.round(all.reduce((a,b)=>a+b,0)/all.length*10)/10):""}</td></tr>`;
  });
  if(!list.length)body=`<tr><td colspan="${days.length+4}" class="empty-state">No students in this class yet.</td></tr>`;
  let foot="";
  [["ANSWERED",rs=>rs.length?new Set(rs.map(e=>e.studentId)).size:""],["CLASS AVG",rs=>rs.length?recFmt(Math.round(rs.reduce((a,e)=>a+e.rating,0)/rs.length*10)/10):""]].forEach(([label,fn])=>{
    foot+=`<tr class="att-total"><td class="c-no"></td><td class="c-name">${label}</td>`;
    days.forEach(d=>{const ws=startCol.has(d.date)?" wk-start":"";const rs=[];list.forEach(s=>(idx.get(s.id+"|"+d.date)||[]).forEach(e=>rs.push(e)));foot+=`<td class="${ws.trim()}">${fn(rs)}</td>`;});
    foot+=`<td colspan="2" class="wk-start"></td></tr>`;
  });
  const wrap=$("recGrid"),sl=wrap.scrollLeft,st=wrap.scrollTop;
  $("recTable").innerHTML=`<thead><tr>${h1}</tr><tr>${h2}</tr><tr>${h3}</tr></thead><tbody>${body}</tbody>${list.length?`<tfoot>${foot}</tfoot>`:""}`;
  wrap.scrollLeft=sl;wrap.scrollTop=st;
}
function recSetRating(studentId,date,type,rating){
  const id=activeClass().id;
  const old=data.records.filter(r=>r.classId===id&&r.studentId===studentId&&r.date===date&&r.type===type);
  const last=old[old.length-1];
  data.records=data.records.filter(r=>!old.includes(r));
  if(rating)data.records.push({id:uid(),classId:id,studentId,date,type,rating,remark:last?.remark||"",createdAt:last?.createdAt||(date===todayISO()?new Date().toISOString():date+"T12:00:00.000Z")});
  save();renderRecGrid();renderDashboard();renderQueue();
}
function recCloseMenu(){$("recMenu").hidden=true;recMenuTarget=null;}
function recGridClick(e){
  const td=e.target.closest(".att-cell");if(!td||td.dataset.off)return;
  if(recTab==="all")return toast("Switch to Oral or Boardwork to add or fix a rating.");
  recMenuTarget={studentId:td.dataset.s,date:td.dataset.d,type:recTab};
  const m=$("recMenu");
  m.innerHTML=[5,4,3,2,1].map(n=>`<button type="button" data-r="${n}"><b class="kc rt-${n}">${n}</b>${REC_LEVELS[n]}</button>`).join("")+`<button type="button" data-r="0">Clear</button>`;
  m.hidden=false;
  const r=td.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
  m.style.left=Math.max(8,Math.min(r.left,innerWidth-mw-8))+"px";
  m.style.top=(r.bottom+mh+8>innerHeight?Math.max(8,r.top-mh):r.bottom)+"px";
}
function recShift(n){const [y,m]=recMonth.split("-").map(Number),d=new Date(y,m-1+n,1);recMonth=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");renderRecGrid();}
function recExport(){
  const G=recGridData();if(!G)return;
  const {days,idx,list}=G,off=new Set(noClassDates());
  const rows=[["No.","Learner's Name",...days.map(d=>d.date+(off.has(d.date)?" (No class)":"")),"Times","Avg (1-5)"]];
  list.forEach((s,i)=>{
    const all=[];
    const cells=days.map(d=>{const es=idx.get(s.id+"|"+d.date);if(!es)return"";es.forEach(e=>all.push(e.rating));return recFmt(es.reduce((a,e)=>a+e.rating,0)/es.length);});
    rows.push([i+1,s.name,...cells,all.length||"",all.length?(all.reduce((a,b)=>a+b,0)/all.length).toFixed(2):""]);
  });
  const label=recTab==="all"?"combined":recTab;
  csvDownload("recitation-"+label+"-"+recMonth+"-"+G.cls.name.replace(/[^A-Za-z0-9]+/g,"_")+".csv",rows);toast("Recitation record downloaded.");
}

/* ---------- events ---------- */
function recInit(){
  $("recTypes").addEventListener("click",e=>{const b=e.target.closest(".rec-type");if(b)recOpen(b.dataset.type);});
  $("likert").addEventListener("click",e=>{const b=e.target.closest(".likert-row");if(b)recPick(+b.dataset.rating);});
  $("saveRatingBtn").onclick=recSave;
  document.addEventListener("keydown",e=>{
    if(!/^[1-5]$/.test(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$("rubricPanel").hidden||!$("view-recitation").classList.contains("active"))return;
    recPick(+e.key);
  });
  $("recTabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b){recTab=b.dataset.tab;recCloseMenu();renderRecGrid();}});
  $("recMonth").onchange=e=>{if(e.target.value){recMonth=e.target.value;renderRecGrid();}};
  $("recPrev").onclick=()=>recShift(-1);$("recNext").onclick=()=>recShift(1);$("recToday").onclick=()=>{recMonth=todayISO().slice(0,7);renderRecGrid();};
  $("recGrid").addEventListener("click",recGridClick);
  $("recMenu").addEventListener("click",e=>{const b=e.target.closest("[data-r]");if(!b||!recMenuTarget)return;const t=recMenuTarget;recCloseMenu();recSetRating(t.studentId,t.date,t.type,+b.dataset.r||null);});
  document.addEventListener("click",e=>{if(!e.target.closest("#recMenu,#recGrid"))recCloseMenu();});
  $("recExport").onclick=recExport;
  $("recPrint").onclick=()=>{document.body.classList.add("print-rec");window.print();setTimeout(()=>document.body.classList.remove("print-rec"),500);};
}
recInit();
