/* ClassPulse: Group Activity record (Reports page), listed by learner name like the Oral and Boardwork record.
   Every member of a team gets that team's rubric score (see rubric.js). View it, print it, or download it as CSV. */
let gaMonth=todayISO().slice(0,7),gaTab="day";
const gaNum=t=>t>=22?5:t>=18?4:t>=14?3:t>=10?2:1;
const gaF=v=>Number.isInteger(v)?String(v):v.toFixed(1);
const gaAvg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const gaR1=v=>Math.round(v*10)/10;
function gaMembers(x,students){return x.members||students.filter(s=>+s.group===x.groupId).map(s=>s.id)}
function gaModel(){
  const cls=activeClass();if(!cls)return null;
  const students=cls.students.slice(),idx=new Map(),per=new Map();
  const inMonth=(data.groupScores||[]).filter(x=>x.classId===cls.id&&String(x.date).slice(0,7)===gaMonth);
  inMonth.forEach(x=>gaMembers(x,students).forEach(id=>{
    const k=id+"|"+x.date;if(!idx.has(k))idx.set(k,[]);idx.get(k).push(x);
    if(!per.has(id))per.set(id,[]);per.get(id).push(x);
  }));
  return{cls,students,days:recDays(gaMonth,inMonth),inMonth,idx,per,off:new Set(noClassDates())};
}
/* plain rows used for the CSV and for the "By criteria" and "Activity log" views */
function gaRows(M,tab){
  const names=GA_CRITERIA.map(c=>c[0]),crit=(a,i)=>gaF(gaR1(gaAvg(a.map(x=>x.ratings[i]))));
  if(tab==="criteria"){
    const rows=M.students.map(s=>{
      const sc=M.per.get(s.id)||[];
      if(!sc.length)return[s.name,0,...names.map(()=>""),"",""];
      const t=gaAvg(sc.map(x=>x.total));
      return[s.name,sc.length,...names.map((_,i)=>crit(sc,i)),gaR1(t).toFixed(1),gaLevel(t)];
    });
    if(M.inMonth.length){const t=gaAvg(M.inMonth.map(x=>x.total));
      rows.push(["CLASS AVERAGE",M.inMonth.length,...names.map((_,i)=>crit(M.inMonth,i)),gaR1(t).toFixed(1),gaLevel(t)])}
    return{head:["Learner's Name","Activities",...names,"Average total (/25)","Performance level"],rows};
  }
  if(tab==="log"){
    const rows=[];
    M.inMonth.map((x,i)=>[x,i]).sort((a,b)=>a[0].date.localeCompare(b[0].date)||a[1]-b[1]).forEach(([x])=>{
      const ids=new Set(gaMembers(x,M.students));
      M.students.forEach(s=>{if(ids.has(s.id))rows.push([x.date,s.name,x.activity||"Group activity",...x.ratings,x.total,gaLevel(x.total)])});
    });
    return{head:["Date","Learner's Name","Activity",...names,"Total (/25)","Performance level"],rows};
  }
  const rows=M.students.map((s,i)=>{
    const sc=M.per.get(s.id)||[];
    return[i+1,s.name,...M.days.map(d=>{const es=M.idx.get(s.id+"|"+d.date);return es?gaF(gaR1(gaAvg(es.map(e=>e.total)))):""}),sc.length||"",sc.length?gaR1(gaAvg(sc.map(x=>x.total))).toFixed(1):""];
  });
  return{head:["No.","Learner's Name",...M.days.map(d=>d.date+(M.off.has(d.date)?" (No class)":"")),"Times","Avg (/25)"],rows};
}
function gaDayHTML(M){
  const {days,students,idx,off,per}=M,today=todayISO(),mon=MONTHS[+gaMonth.slice(5,7)-1],weeks=[];
  days.forEach(d=>{let w=weeks[weeks.length-1];if(!w||d.dow===1){w={days:[]};weeks.push(w)}w.days.push(d)});
  const start=new Set(weeks.map(w=>w.days[0].date));
  let h1=`<th rowspan="3" class="c-no">No.</th><th rowspan="3" class="c-name">LEARNER'S NAME</th>`;
  weeks.forEach((w,i)=>{const a=w.days[0].day,b=w.days[w.days.length-1].day;h1+=`<th colspan="${w.days.length}" class="wk-start">${w.days.length<3?"Wk "+(i+1):"Week "+(i+1)+" · "+mon+" "+a+(b!==a?"–"+b:"")}</th>`});
  h1+=`<th colspan="2" class="wk-start">Summary</th>`;
  let h2="",h3="";
  days.forEach(d=>{const ws=start.has(d.date)?"wk-start":"";h2+=`<th class="${ws}">${REC_DAYLET[d.dow]}</th>`;h3+=`<th class="${(ws+(d.date===today?" today":"")).trim()}">${d.day}</th>`});
  h2+=`<th rowspan="2" class="wk-start">Times</th><th rowspan="2">Avg /25</th>`;
  let body="";
  students.forEach((s,r)=>{
    body+=`<tr><td class="c-no">${r+1}</td><td class="c-name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</td>`;
    const all=per.get(s.id)||[];
    days.forEach(d=>{
      const ws=start.has(d.date)?" wk-start":"",es=idx.get(s.id+"|"+d.date);
      if(!es){body+=`<td class="att-cell${off.has(d.date)?" off":""}${ws}"></td>`;return}
      const v=gaAvg(es.map(e=>e.total)),tip=es.map(e=>`${e.activity||"Group activity"}: ${e.total}/25 – ${gaLevel(e.total)}`).join("\n");
      body+=`<td class="att-cell rt-${gaNum(Math.round(v))}${ws}" title="${escapeHTML(tip)}">${gaF(gaR1(v))}</td>`;
    });
    body+=`<td class="sum-cell wk-start">${all.length||""}</td><td class="sum-cell">${all.length?gaF(gaR1(gaAvg(all.map(x=>x.total)))):""}</td></tr>`;
  });
  if(!students.length)body=`<tr><td colspan="${days.length+4}" class="empty-state">No students in this class yet.</td></tr>`;
  const dayScores=d=>M.inMonth.filter(x=>x.date===d.date);
  let foot="";
  [["SCORED",d=>{const n=students.filter(s=>idx.has(s.id+"|"+d.date)).length;return n||""}],["CLASS AVG",d=>{const sc=dayScores(d);return sc.length?gaF(gaR1(gaAvg(sc.map(x=>x.total)))):""}]].forEach(([label,fn])=>{
    foot+=`<tr class="att-total"><td class="c-no"></td><td class="c-name">${label}</td>`;
    days.forEach(d=>{foot+=`<td class="${start.has(d.date)?"wk-start":""}">${fn(d)}</td>`});
    foot+=`<td colspan="2" class="wk-start"></td></tr>`;
  });
  return`<thead><tr>${h1}</tr><tr>${h2}</tr><tr>${h3}</tr></thead><tbody>${body}</tbody>${students.length?`<tfoot>${foot}</tfoot>`:""}`;
}
function renderGaReport(){
  if(!$("gaTable"))return;
  const M=gaModel();if(!M)return;
  populateClassSelects();
  $("gaMonth").value=gaMonth;
  document.querySelectorAll("#gaTabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===gaTab));
  $("gaLegend").hidden=gaTab!=="day";
  const n=M.inMonth.length;
  $("gaHint").textContent=n?`${n} group activit${n===1?"y":"ies"} scored this month · every member gets their team's score · hover a score for details`:"No group activities scored this month. Use “Score with rubric” on the Group Activity page.";
  const wrap=$("gaGrid"),sl=wrap.scrollLeft,st=wrap.scrollTop,tbl=$("gaTable");
  if(gaTab==="day"){tbl.className="att-grid";tbl.innerHTML=gaDayHTML(M)}
  else{
    const R=gaRows(M,gaTab);tbl.className="rb-table ga-simple";
    tbl.innerHTML=`<thead><tr>${R.head.map(h=>`<th>${escapeHTML(h)}</th>`).join("")}</tr></thead><tbody>${R.rows.length?R.rows.map(r=>`<tr${r[0]==="CLASS AVERAGE"?' class="ga-sum"':""}>${r.map(c=>`<td>${escapeHTML(c)}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${R.head.length}" class="empty-state">Nothing scored this month.</td></tr>`}</tbody>`;
  }
  wrap.scrollLeft=sl;wrap.scrollTop=st;
}
function gaExport(){
  const M=gaModel();if(!M)return;
  const R=gaRows(M,gaTab);
  csvDownload("group-activity-"+gaTab+"-"+gaMonth+"-"+M.cls.name.replace(/[^A-Za-z0-9]+/g,"_")+".csv",[R.head,...R.rows]);
  toast("Group activity record downloaded.");
}
function gaShift(n){const [y,m]=gaMonth.split("-").map(Number),d=new Date(y,m-1+n,1);gaMonth=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");renderGaReport()}
(function(){
  if(!$("gaTable"))return;
  $("gaTabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b){gaTab=b.dataset.tab;renderGaReport()}});
  $("gaMonth").onchange=e=>{if(e.target.value){gaMonth=e.target.value;renderGaReport()}};
  $("gaPrev").onclick=()=>gaShift(-1);$("gaNext").onclick=()=>gaShift(1);$("gaToday").onclick=()=>{gaMonth=todayISO().slice(0,7);renderGaReport()};
  $("gaExport").onclick=gaExport;
  $("gaPrint").onclick=()=>{document.body.classList.add("print-ga");window.print();setTimeout(()=>document.body.classList.remove("print-ga"),500)};
})();
