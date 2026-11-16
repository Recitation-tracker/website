/* =====================================================================
   Random Group Generator module
   - Random groups by size / number of groups / partners
   - Creative team names (themes), shuffle-and-deal reveal animation
   - Avoid repeating past pairings (uses saved groupings as memory)
   - Save groupings, export to real .xlsx and .pdf (no libraries needed)
   Relies on globals from app.js: data, $, save, toast, students, activeClass,
   todayISO, uid, escapeHTML, wheelLabel, downloadBlob
   ===================================================================== */
const GEN_COLORS = ["#123f91","#16834b","#7c3aed","#b45309","#be185d","#0e7490","#b91c1c","#4338ca","#0f766e","#a16207"];
const GEN_THEMES = {
  romblon:{label:"Romblon pride",names:["Marble Masters","Guiting-Guiting Giants","Sibuyan Sunrise","Tablas Titans","Bonbon Breakers","Banton Voyagers","Cobrador Comets","Odiongan Owls","Simara Stars","Sibale Sailors","Looc Lightning","Calatrava Chargers","Magdiwang Mavericks","Cajidiocan Champions","Corcuera Corsairs","Romblon Rockets","Ferrol Falcons","Alcantara Aces","Santa Fe Flames","San Jose Sharks"]},
  math:{label:"Math squad",names:["Prime Time","Pythagoras Pack","Pi Patrol","Integer Icons","Sigma Squad","Vector Vikings","Probability Pros","Mean Machines","Median Mavericks","Normal Curve Crew","Z-Score Zealots","Slovin Squad","Fraction Force","Parabola Pioneers","Function Fighters","Matrix Mavens","Domain Dynamos","Quartile Queens"]},
  animals:{label:"Philippine wildlife",names:["Tamaraw Titans","Tarsier Troop","Eagle Eyes","Whale Shark Wave","Pawikan Pals","Butanding Bunch","Bangus Brigade","Carabao Crew","Maya Marvels","Dugong Dynamos","Hornbill Heroes","Pangolin Posse","Kalaw Knights","Lapu-Lapu Fish Squad","Mayon Monitors","Tamsi Team"]},
  gems:{label:"Gems & colors",names:["Ruby Rockets","Emerald Eagles","Sapphire Sharks","Amber Aces","Topaz Titans","Opal Owls","Jade Jaguars","Pearl Panthers","Coral Crew","Onyx Orcas","Garnet Giants","Citrine Comets","Amethyst Army"]},
  numbered:{label:"Plain: Group 1, 2, 3…",names:null}
};
let genCurrent = null, genTimers = [], genRevealing = false, genExcluded = new Set(), genExcludedClass = null;

/* ---------- settings & data helpers ---------- */
function genCfg(){const s=data.settings||(data.settings={});if(!s.gen)s.gen={mode:"size",size:4,count:4,theme:"romblon",avoid:true,skipAbsent:true,animate:true};const c=s.gen;if(c.leaderOn===undefined)c.leaderOn=false;if(!c.leaders)c.leaders={};return c;}
/* leaders (advanced learners picked by the teacher; remembered per class) */
function genLeaderSet(){return new Set(genCfg().leaders[activeClass()?.id]||[]);}
function genSaveLeaderSet(set){genCfg().leaders[activeClass().id]=[...set];}
function genLeadersActive(){const c=genCfg();return c.leaderOn&&c.mode!=="pairs";}
function genChosenLeaders(pool){if(!genLeadersActive())return [];const set=genLeaderSet();return pool.filter(s=>set.has(s.id)).map(s=>s.id);}
function genSets(){return data.groupSets||(data.groupSets=[]);}
function genAbsentIds(){const id=activeClass()?.id,t=todayISO();return new Set((data.attendance||[]).filter(a=>a.classId===id&&a.date===t&&a.status==="Absent").map(a=>a.studentId));}
function genPool(){const cfg=genCfg(),absent=cfg.skipAbsent?genAbsentIds():new Set();return students().filter(s=>!genExcluded.has(s.id)&&!absent.has(s.id));}
function genShuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function genDate(iso){return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}
function genTime(iso){return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});}

/* ---------- group sizes ---------- */
function genSizes(n,cfg){
  if(n<1)return [];
  let g;
  if(cfg.mode==="pairs")g=Math.floor(n/2);
  else if(cfg.mode==="count")g=cfg.count;
  else g=Math.ceil(n/cfg.size);
  g=Math.max(1,Math.min(g,n));
  const base=Math.floor(n/g),extra=n%g;
  return Array.from({length:g},(_,i)=>base+(i<extra?1:0));
}
function genModeLabel(cfg,groups){
  if(cfg.mode==="pairs")return "Random partners";
  if(cfg.mode==="count")return groups+" groups";
  return "Groups of up to "+cfg.size;
}

/* ---------- avoid repeating: pair history ---------- */
function genPairKey(a,b){return a<b?a+"|"+b:b+"|"+a;}
function genPairCounts(){
  const id=activeClass()?.id,m=new Map();
  genSets().filter(x=>x.classId===id).forEach(set=>set.groups.forEach(g=>{
    const ids=g.members.map(x=>x.id);
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=genPairKey(ids[i],ids[j]);m.set(k,(m.get(k)||0)+1);}
  }));
  return m;
}
function genBuild(pool,sizes,counts,avoid,leaders){
  leaders=leaders||[];
  const ids=pool.map(s=>s.id).filter(id=>!leaders.includes(id));
  const sz=genShuffle(sizes.slice()),G=sz.length;
  const slot=genShuffle(Array.from({length:G},(_,i)=>i)).slice(0,leaders.length);
  const fixed=new Array(G).fill(0);slot.forEach(i=>{fixed[i]=1;});
  const w=(a,b)=>{const c=counts.get(genPairKey(a,b))||0;return c*c;};
  const cost=gr=>{let c=0;for(let i=0;i<gr.length;i++)for(let j=i+1;j<gr.length;j++)c+=w(gr[i],gr[j]);return c;};
  const make=()=>{
    const rest=genShuffle(ids.slice()),groups=sz.map(()=>[]);let p=0;
    slot.forEach((gi,k)=>groups[gi].push(leaders[k]));
    groups.forEach((gr,i)=>{const need=sz[i]-gr.length;for(let k=0;k<need;k++)gr.push(rest[p++]);});
    return groups;
  };
  const useHistory=avoid&&counts.size>0&&G>1,restarts=useHistory?20:1;
  let best=null,bestCost=Infinity;
  for(let r=0;r<restarts;r++){
    const groups=make();
    if(!useHistory)return groups;
    const costs=groups.map(cost);let total=costs.reduce((x,y)=>x+y,0);
    for(let it=0;it<5000&&total>0;it++){
      const a=Math.floor(Math.random()*G),b=Math.floor(Math.random()*G);if(a===b)continue;
      const na=groups[a].length-fixed[a],nb=groups[b].length-fixed[b];if(na<1||nb<1)continue;
      const i=fixed[a]+Math.floor(Math.random()*na),j=fixed[b]+Math.floor(Math.random()*nb);
      [groups[a][i],groups[b][j]]=[groups[b][j],groups[a][i]];
      const ca=cost(groups[a]),cb=cost(groups[b]);
      if(ca+cb<=costs[a]+costs[b]){total+=ca+cb-costs[a]-costs[b];costs[a]=ca;costs[b]=cb;}
      else [groups[a][i],groups[b][j]]=[groups[b][j],groups[a][i]];
    }
    if(total<bestCost){bestCost=total;best=groups;}
    if(total===0)break;
  }
  return best;
}
function genRepeatInfo(groups,counts,nameOf){
  const withIds={};let pairs=0;
  groups.forEach(g=>{for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){
    const c=counts.get(genPairKey(g[i],g[j]))||0;
    if(c>0){pairs++;(withIds[g[i]]||(withIds[g[i]]=[])).push(nameOf(g[j]));(withIds[g[j]]||(withIds[g[j]]=[])).push(nameOf(g[i]));}
  }});
  return {pairs,withIds};
}

/* ---------- team names ---------- */
function genNames(theme,n){
  if(theme==="numbered"||!GEN_THEMES[theme]?.names)return Array.from({length:n},(_,i)=>"Group "+(i+1));
  const pool=genShuffle(GEN_THEMES[theme].names.slice()),out=[];
  for(let i=0;i<n;i++){const round=Math.floor(i/pool.length);out.push(pool[i%pool.length]+(round?" "+(round+1):""));}
  return out;
}
function genOneName(theme,used){
  if(theme==="numbered"||!GEN_THEMES[theme]?.names)return null;
  const free=GEN_THEMES[theme].names.filter(n=>!used.has(n));
  const src=free.length?free:GEN_THEMES[theme].names;
  return src[Math.floor(Math.random()*src.length)];
}

/* ---------- generate ---------- */
function genGenerate(){
  genClearTimers();
  const pool=genPool();
  if(pool.length<2)return toast("Need at least 2 learners in the pool.");
  const cfg=genCfg(),sizes=genSizes(pool.length,cfg),counts=genPairCounts();
  const chosen=genChosenLeaders(pool),leaders=genShuffle(chosen.slice()).slice(0,sizes.length);
  const groups=genBuild(pool,sizes,counts,cfg.avoid,leaders);
  const byId=new Map(pool.map(s=>[s.id,s]));
  const names=genNames(cfg.theme,groups.length);
  const historyCount=genSets().filter(x=>x.classId===activeClass().id).length;
  genCurrent={
    id:uid(),classId:activeClass().id,createdAt:new Date().toISOString(),mode:cfg.mode,theme:cfg.theme,
    label:genModeLabel(cfg,groups.length),savedId:null,title:"",historyCount,
    groups:groups.map((g,i)=>({name:names[i],leader:leaders.includes(g[0])?g[0]:null,members:g.map(id=>({id,name:byId.get(id).name}))})),
    extraLeaders:Math.max(0,chosen.length-leaders.length),
    repeats:cfg.avoid?genRepeatInfo(groups,counts,id=>wheelLabel(byId.get(id).name)):null
  };
  genRenderResults(cfg.animate);
  if(cfg.animate)genAnimate();else sfx("tada");
}

/* ---------- reveal animation (shuffle, then deal one by one) ---------- */
function genClearTimers(){genTimers.forEach(t=>{clearTimeout(t);clearInterval(t);});genTimers=[];genRevealing=false;$("genGo").disabled=false;}
function genBanner(html){const b=$("genBanner");b.hidden=!html;b.innerHTML=html||"";}
function genAnimate(){
  const groups=genCurrent.groups,max=Math.max(...groups.map(g=>g.members.length)),order=[];
  for(let k=0;k<max;k++)groups.forEach((g,gi)=>{if(k<g.members.length)order.push(document.querySelector(`#genResults li[data-g="${gi}"][data-m="${k}"]`));});
  const tickerNames=groups.flatMap(g=>g.members.map(m=>wheelLabel(m.name)));
  genRevealing=true;sfx("shuffleStart");
  genBanner(`<span class="gen-spin">🎲</span><b id="genBannerText">Shuffling the class…</b><em id="genTicker"></em><button class="btn btn-soft" id="genSkip">Skip ⏭</button>`);
  const tick=setInterval(()=>{sfx("shuffleTick");const el=$("genTicker");if(el)el.textContent=tickerNames[Math.floor(Math.random()*tickerNames.length)];},70);
  genTimers.push(tick);
  genTimers.push(setTimeout(()=>{
    clearInterval(tick);const t=$("genTicker");if(t)t.textContent="";
    const step=Math.max(70,Math.min(260,4500/order.length));let n=0;
    const deal=()=>{
      if(n>=order.length){sfx("tada");return genFinish();}
      const li=order[n++];sfx("deal",n);li.classList.remove("hid");li.classList.add("pop");
      const bt=$("genBannerText");if(bt)bt.textContent=`Dealing learners… ${n} / ${order.length}`;
      genTimers.push(setTimeout(deal,step));
    };
    deal();
  },1100));
}
function genFinish(){genClearTimers();document.querySelectorAll("#genResults li.hid").forEach(l=>l.classList.remove("hid"));genBanner("");}

/* ---------- rendering ---------- */
function genSetupRender(){
  const cfg=genCfg(),cls=activeClass();
  if(cls&&genExcludedClass!==cls.id){genExcluded=new Set();genExcludedClass=cls.id;}
  document.querySelectorAll("#genMode button").forEach(b=>b.classList.toggle("active",b.dataset.mode===cfg.mode));
  $("genSizeField").hidden=cfg.mode!=="size";$("genCountField").hidden=cfg.mode!=="count";$("genPairsHint").hidden=cfg.mode!=="pairs";
  document.querySelectorAll("#genSizeChips button").forEach(b=>b.classList.toggle("active",+b.dataset.size===cfg.size));
  $("genCount").value=cfg.count;
  const sel=$("genTheme");if(!sel.options.length)sel.innerHTML=Object.entries(GEN_THEMES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("");
  sel.value=cfg.theme;$("genAvoid").checked=cfg.avoid;$("genSkipAbsent").checked=cfg.skipAbsent;$("genAnimate").checked=cfg.animate;
  $("genLeadersOn").checked=cfg.leaderOn;
  const lbox=$("genLeaderBox"),pairs=cfg.mode==="pairs";
  lbox.hidden=!cfg.leaderOn;
  if(cfg.leaderOn){
    const poolNow=genPool(),lset=genLeaderSet(),G=genSizes(poolNow.length,cfg).length,L=poolNow.filter(s=>lset.has(s.id)).length;
    $("genLeaderPool").innerHTML=pairs?"":poolNow.map(s=>`<button type="button" class="gen-chip${lset.has(s.id)?" lead":""}" data-id="${s.id}" title="${lset.has(s.id)?"Click to remove as leader":"Click to make a leader"}">${lset.has(s.id)?"★ ":""}${escapeHTML(wheelLabel(s.name))}</button>`).join("")||'<span class="muted">No learners in the pool.</span>';
    let msg="";
    if(pairs)msg="Leaders are not used with Random partners. Switch to Group size or No. of groups.";
    else if(!L)msg="Tap the advanced learners below to make them leaders.";
    else if(L===G)msg=`✓ ${L} leaders for ${G} groups: one per group.`;
    else if(L>G)msg=`${L} leaders for ${G} groups: ${L-G} randomly chosen leader${L-G>1?"s":""} will join as regular members.`;
    else msg=`${L} leader${L>1?"s":""} for ${G} groups: ${G-L} group${G-L>1?"s":""} will have no leader (you can set one with ☆ after).`;
    $("genLeaderNote").textContent=msg;
    $("genLeaderMatch").hidden=pairs||L<2||L===G;
  }
  const nSaved=genSets().filter(x=>x.classId===cls?.id).length;
  $("genAvoidNote").textContent=nSaved?`Using ${nSaved} saved grouping${nSaved>1?"s":""} as memory.`:"Save a grouping to start building memory.";
  const all=students(),absent=cfg.skipAbsent?genAbsentIds():new Set(),pool=genPool(),sizes=genSizes(pool.length,cfg);
  $("genPreview").innerHTML=pool.length<2?"Need at least 2 learners in the pool.":`<strong>${pool.length}</strong> learners → <strong>${sizes.length}</strong> group${sizes.length>1?"s":""} <span>(${sizes.join(" · ")})</span>`;
  $("genPoolNote").textContent=`${pool.length} of ${all.length} learners included`+(absent.size?` · ${[...absent].filter(id=>all.some(s=>s.id===id)).length} absent today`:"");
  $("genPool").innerHTML=all.map(s=>{
    const isAbs=absent.has(s.id),isEx=genExcluded.has(s.id);
    return `<button type="button" class="gen-chip${isEx?" off":""}${isAbs?" absent":""}" data-id="${s.id}" ${isAbs?"disabled":""} title="${isAbs?"Marked absent today":isEx?"Click to include":"Click to leave out"}">${escapeHTML(wheelLabel(s.name))}</button>`;
  }).join("")||`<span class="muted">No learners in this class yet.</span>`;
}
function genRenderResults(hide){
  const box=$("genResults"),c=genCurrent;
  if(!c){box.innerHTML=`<div class="gen-empty"><div class="gen-empty-dice">🎲</div><h3>Ready when you are</h3><p>Pick a grouping style on the left, then press <b>Generate groups</b>.</p></div>`;return;}
  const used=c.groups.map(g=>g.members.length),total=used.reduce((a,b)=>a+b,0);
  let badge="";
  if(c.repeats){badge=c.repeats.pairs===0
    ?(c.historyCount?`<span class="pill green">✓ No repeated pairs · checked against ${c.historyCount} saved grouping${c.historyCount>1?"s":""}</span>`:`<span class="pill gray">No saved history yet · save groups to avoid repeats next time</span>`)
    :`<span class="pill yellow">↻ ${c.repeats.pairs} pair${c.repeats.pairs>1?"s":""} worked together before (marked ↻)</span>`;}
  const cards=c.groups.map((g,gi)=>{
    const col=GEN_COLORS[gi%GEN_COLORS.length];
    const lis=g.members.map((m,mi)=>{
      const rep=c.repeats?.withIds[m.id];
      const lead=g.leader===m.id;
      return `<li class="${hide?"hid ":""}${lead?"leader":""}" data-g="${gi}" data-m="${mi}"><span class="no">${mi+1}</span><span class="nm">${escapeHTML(m.name)}</span>${rep?`<i class="rep" title="Has worked with: ${escapeHTML(rep.join(", "))}">↻</i>`:""}<button type="button" class="lead-btn" data-g="${gi}" data-id="${m.id}" title="${lead?"Group leader (click to remove)":"Make group leader"}" aria-label="${lead?"Remove leader":"Make leader"}">${lead?"★":"☆"}</button></li>`;
    }).join("");
    return `<article class="gen-card" style="--c:${col}"><header><input class="gen-name" data-g="${gi}" value="${escapeHTML(g.name)}" maxlength="40" aria-label="Group name"><button type="button" class="gen-dice" data-g="${gi}" title="New team name">🎲</button></header><ol>${lis}</ol><footer>${g.members.length} members${g.leader?` · ★ ${escapeHTML(wheelLabel(g.members.find(m=>m.id===g.leader)?.name||""))}`:""}</footer></article>`;
  }).join("");
  box.innerHTML=`
    <div class="gen-head">
      <div><h3>${c.groups.length} groups · ${total} learners</h3><p class="muted">${escapeHTML(c.label)} · sizes ${used.join(", ")}${c.groups.some(x=>x.leader)?` · ${c.groups.filter(x=>x.leader).length} leader${c.groups.filter(x=>x.leader).length>1?"s":""} ★`:""}</p></div>
      <div class="gen-badges">${badge}${genIsApplied()?`<span class="pill green">👥 Active in Group Activity</span>`:""}</div>
    </div>
    <div class="gen-actions">
      <input id="genTitle" class="input-control" placeholder="Activity title (optional)" value="${escapeHTML(c.title||"")}" maxlength="60">
      <button class="btn btn-primary" id="genSave">💾 ${c.savedId?"Update saved":"Save groups"}</button>
      <button class="btn ${genIsApplied()?"btn-soft":"btn-primary gen-apply"}" id="genApply">👥 ${genIsApplied()?"Update Group Activity":"Use in Group Activity"}</button>
      <button class="btn btn-outline" id="genXlsx">⇩ Excel</button>
      <button class="btn btn-outline" id="genPdf">⇩ PDF</button>
      <button class="btn btn-soft" id="genRename">🎲 New names</button>
      <button class="btn btn-soft" id="genAgain">↻ Shuffle again</button>
    </div>
    <div class="gen-grid">${cards}</div>`;
}
function genRenderSaved(){
  const cls=activeClass(),sets=genSets().filter(x=>x.classId===cls?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $("genClearAll").hidden=!sets.length;
  $("genSaved").innerHTML=sets.length?sets.map(s=>`
    <div class="gen-saved-row" data-id="${s.id}">
      <div class="gen-saved-info"><strong>${escapeHTML(s.title)}</strong><small>${genDate(s.createdAt)} · ${genTime(s.createdAt)} · ${escapeHTML(s.label)} · ${s.groups.length} groups</small>
        <div class="gen-minis">${s.groups.map((g,i)=>`<span class="gen-mini" style="--c:${GEN_COLORS[i%GEN_COLORS.length]}">${escapeHTML(g.name)}</span>`).join("")}</div></div>
      <div class="gen-saved-btns"><button class="btn btn-soft" data-act="view">View</button><button class="btn btn-soft" data-act="apply">Use in Group Activity</button><button class="btn btn-outline" data-act="xlsx">Excel</button><button class="btn btn-outline" data-act="pdf">PDF</button><button class="btn btn-danger" data-act="del">Delete</button></div>
    </div>`).join(""):`<div class="empty-state">No saved groupings yet. Generate groups and press <b>Save groups</b> — saved groupings help the generator avoid repeating teammates.</div>`;
}
function renderGenerator(){populateClassSelects();if(genCurrent&&genCurrent.classId!==activeClass()?.id){genClearTimers();genBanner("");genCurrent=null;}genSetupRender();if(!genRevealing)genRenderResults();genRenderSaved();}


/* ---------- send teams to Group Activity ---------- */
function genKey(){return genCurrent?(genCurrent.savedId||genCurrent.id):null;}
function genIsApplied(){const m=(data.groupMeta||{})[activeClass()?.id];return !!(m&&genCurrent&&m.key===genKey());}
function genApplySet(set,key,title){
  const cls=activeClass();if(!cls||!set?.groups?.length)return false;
  const pts=classGroups().reduce((a,x)=>a+(x.points||0),0);
  if(pts>0&&!confirm(`Replace the current teams for ${cls.name}?\nTheir ${pts} point${pts>1?"s":""} will be reset to zero.`))return false;
  ensureGroupData();
  data.classGroups[cls.id]=set.groups.map((x,i)=>({id:i+1,name:x.name,points:0,leader:x.leader||null}));
  cls.students.forEach(s=>{s.group=null;});
  set.groups.forEach((x,i)=>x.members.forEach(m=>{const s=cls.students.find(y=>y.id===m.id);if(s)s.group=i+1;}));
  data.groupMeta[cls.id]={key,title,at:new Date().toISOString()};
  save();renderDashboard();
  toast(`${set.groups.length} teams sent to Group Activity.`);
  return true;
}
function genApplyCurrent(){
  const c=genCurrent;if(!c)return;
  if(genRevealing)genFinish();
  const t=($("genTitle")?.value||"").trim()||c.title||genDefaultTitle(c);c.title=t;
  if(genApplySet(c,genKey(),t)){genRenderResults();genFinish();}
}
function genPushNames(){
  if(!genCurrent||!genIsApplied())return;
  const arr=classGroups();genCurrent.groups.forEach((x,i)=>{if(arr[i])arr[i].name=x.name;});save();
}
function genPushLeaders(){
  if(!genCurrent||!genIsApplied())return;
  const arr=classGroups();genCurrent.groups.forEach((x,i)=>{if(arr[i])arr[i].leader=x.leader||null;});save();
}
function genSetLeader(gi,id){
  const c=genCurrent;if(!c||!c.groups[gi])return;
  if(genRevealing)genFinish();
  const gr=c.groups[gi];
  if(gr.leader===id)gr.leader=null;
  else{gr.leader=id;const i=gr.members.findIndex(m=>m.id===id);if(i>0){const [m]=gr.members.splice(i,1);gr.members.unshift(m);}}
  genPushLeaders();genRenderResults();
}
function genSyncFromGroups(){
  // a team was renamed in Group Activity: mirror it in the generator's current groups
  if(!genCurrent||!genIsApplied())return;
  classGroups().forEach((x,i)=>{if(genCurrent.groups[i])genCurrent.groups[i].name=x.name;});
  if(!genRevealing&&$("genResults"))genRenderResults();
}

/* ---------- save / load / delete ---------- */
function genDefaultTitle(c){return "Groups – "+genDate(c.createdAt)+" "+genTime(c.createdAt);}
function genSave(){
  const c=genCurrent;if(!c)return;
  if(genRevealing)genFinish();
  c.title=($("genTitle").value||"").trim()||genDefaultTitle(c);
  const rec={id:c.savedId||c.id,classId:c.classId,title:c.title,createdAt:c.createdAt,label:c.label,mode:c.mode,theme:c.theme,groups:JSON.parse(JSON.stringify(c.groups))};
  const sets=genSets(),i=sets.findIndex(s=>s.id===rec.id);
  if(i>=0)sets[i]=rec;else sets.push(rec);
  c.savedId=rec.id;save();genRenderResults();genFinish();genSetupRender();genRenderSaved();toast("Groups saved.");
}
function genLoad(id){
  const s=genSets().find(x=>x.id===id);if(!s)return;
  genClearTimers();genBanner("");
  genCurrent={id:s.id,savedId:s.id,classId:s.classId,createdAt:s.createdAt,mode:s.mode,theme:s.theme,label:s.label,title:s.title,historyCount:0,repeats:null,groups:JSON.parse(JSON.stringify(s.groups))};
  genRenderResults();genFinish();window.scrollTo({top:0,behavior:"smooth"});
}
function genExportObj(s){const cls=activeClass();return {title:s.title||genDefaultTitle(s),className:cls?.name||"",createdAt:s.createdAt,label:s.label,groups:s.groups.map(g=>({name:g.name,members:g.members.map(m=>({name:m.name,lead:g.leader===m.id}))}))};}
function genFileName(obj,ext){const d=new Date(obj.createdAt),p=n=>String(n).padStart(2,"0");return ("Groups_"+(obj.className||"class")+"_"+d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())).replace(/[^A-Za-z0-9_-]+/g,"_")+"."+ext;}
function genExport(kind,source){
  const s=source||genCurrent;if(!s)return;
  if(s===genCurrent){if(genRevealing)genFinish();const t=$("genTitle");if(t)s.title=t.value.trim();}
  const obj=genExportObj(s);
  if(kind==="xlsx")downloadBlob(genFileName(obj,"xlsx"),genBuildXlsx(obj));
  else downloadBlob(genFileName(obj,"pdf"),genBuildPdf(obj));
  toast(kind==="xlsx"?"Excel file downloaded.":"PDF downloaded.");
}

/* ---------- Excel (.xlsx) writer: minimal OOXML in a stored ZIP ---------- */
const GEN_CRC=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function genCrc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=GEN_CRC[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function genZip(files,mime){
  const enc=new TextEncoder(),chunks=[],central=[],now=new Date();let offset=0;
  const dt=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),tm=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
  files.forEach(f=>{
    const name=enc.encode(f.name),data=enc.encode(f.text),crc=genCrc32(data),size=data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,tm,true);lh.setUint16(12,dt,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,size,true);lh.setUint32(22,size,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
    chunks.push(new Uint8Array(lh.buffer),name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,tm,true);ch.setUint16(14,dt,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,size,true);ch.setUint32(24,size,true);ch.setUint16(28,name.length,true);ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),name);
    offset+=30+name.length+size;
  });
  const cdSize=central.reduce((a,c)=>a+c.length,0),end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cdSize,true);end.setUint32(16,offset,true);
  return new Blob([...chunks,...central,new Uint8Array(end.buffer)],{type:mime});
}
function genXmlEsc(s){return String(s).replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));}
function genColName(i){let s="";i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function genSheetXml(rows,widths){
  let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  x+="<cols>"+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")+"</cols><sheetData>";
  rows.forEach((r,ri)=>{
    x+=`<row r="${ri+1}">`;
    r.forEach((c,ci)=>{
      if(c===null||c===undefined||c==="")return;
      const cell=typeof c==="object"?c:{v:c},ref=genColName(ci)+(ri+1),st=cell.s?` s="${cell.s}"`:"";
      x+=typeof cell.v==="number"?`<c r="${ref}"${st}><v>${cell.v}</v></c>`:`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${genXmlEsc(cell.v)}</t></is></c>`;
    });
    x+="</row>";
  });
  return x+"</sheetData></worksheet>";
}
function genBuildXlsx(o){
  const maxM=Math.max(...o.groups.map(g=>g.members.length));
  const grid=[[{v:o.title,s:2}],[o.className+" · "+o.label+" · "+genDate(o.createdAt)],[]];
  grid.push(o.groups.map((g,i)=>({v:g.name,s:3+(i%GEN_COLORS.length)})));
  for(let k=0;k<maxM;k++)grid.push(o.groups.map(g=>g.members[k]?{v:g.members[k].name+(g.members[k].lead?" (Leader)":""),s:g.members[k].lead?3+GEN_COLORS.length:1}:null));
  grid.push([]);grid.push(o.groups.map(g=>({v:g.members.length+" members",s:2})));
  const list=[[{v:"Group",s:3},{v:"No.",s:3},{v:"Learner",s:3},{v:"Role",s:3}]];
  o.groups.forEach(g=>g.members.forEach((m,i)=>list.push([{v:g.name,s:1},{v:i+1,s:1},{v:m.name,s:1},{v:m.lead?"Leader":"Member",s:1}])));
  const fills=GEN_COLORS.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join("");
  const xfs=GEN_COLORS.map((_,i)=>`<xf numFmtId="0" fontId="2" fillId="${2+i}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`).join("");
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
   +'<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
   +`<fills count="${3+GEN_COLORS.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills}<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2C2"/><bgColor indexed="64"/></patternFill></fill></fills>`
   +'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF9AA5B4"/></left><right style="thin"><color rgb="FF9AA5B4"/></right><top style="thin"><color rgb="FF9AA5B4"/></top><bottom style="thin"><color rgb="FF9AA5B4"/></bottom><diagonal/></border></borders>'
   +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
   +`<cellXfs count="${4+GEN_COLORS.length}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>${xfs}<xf numFmtId="0" fontId="1" fillId="${2+GEN_COLORS.length}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs>`
   +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files=[
   {name:"[Content_Types].xml",text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
   {name:"_rels/.rels",text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
   {name:"xl/workbook.xml",text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Groups" sheetId="1" r:id="rId1"/><sheet name="List" sheetId="2" r:id="rId2"/></sheets></workbook>'},
   {name:"xl/_rels/workbook.xml.rels",text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
   {name:"xl/styles.xml",text:styles},
   {name:"xl/worksheets/sheet1.xml",text:genSheetXml(grid,o.groups.map(()=>32))},
   {name:"xl/worksheets/sheet2.xml",text:genSheetXml(list,[30,7,38,12])}
  ];
  return genZip(files,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* ---------- PDF writer: plain PDF 1.4 with built-in Helvetica ---------- */
function genPdfEsc(s){
  let o="";
  for(const ch of String(s)){
    let c=ch.charCodeAt(0);
    if(c===0x2013)c=0x96;else if(c===0x2014)c=0x97;else if(c===0x2018||c===0x2019)c=0x27;else if(c===0x201c||c===0x201d)c=0x22;else if(c===0x2022||c===0xB7)c=c===0xB7?0xB7:0x95;
    if(c>255)c=63;
    if(c===40||c===41||c===92)o+="\\"+String.fromCharCode(c);
    else if(c<32||c>126)o+="\\"+c.toString(8).padStart(3,"0");
    else o+=String.fromCharCode(c);
  }
  return o;
}
function genBuildPdf(o){
  const W=612,H=792,M=40,GAP=16,COLW=(W-2*M-GAP)/2,HEAD=24,ROW=15,PAD=8,BOT=M+16;
  const hex=h=>[1,3,5].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(3)).join(" ");
  const T=(s,x,y,size,bold,rgb)=>`BT /${bold?"F2":"F1"} ${size} Tf ${rgb||"0 0 0"} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${genPdfEsc(s)}) Tj ET`;
  const cut=(s,n)=>String(s).length>n?String(s).slice(0,n-3)+"...":String(s);
  const pages=[];let ops=[],ycol=[0,0];
  const finish=()=>{ops.push(T("Generated with Recitation Tracker · Page "+(pages.length+1),M,24,8,false,"0.55 0.6 0.66"));pages.push(ops.join("\n"));};
  const newPage=first=>{
    if(ops.length)finish();
    ops=[];let y=H-M;
    ops.push(T(cut(o.title,first?60:80),M,y-14,first?18:11,true,"0.07 0.14 0.23"));
    if(first){ops.push(T(cut([o.className,o.label,genDate(o.createdAt)].filter(Boolean).join("  ·  "),95),M,y-31,9,false,"0.44 0.5 0.58"));y-=50;}
    else y-=28;
    ycol=[y,y];
  };
  newPage(true);
  o.groups.forEach((g,gi)=>{
    const h=HEAD+g.members.length*ROW+PAD;
    let c=ycol[0]>=ycol[1]?0:1;
    if(ycol[c]-h<BOT){c=1-c;if(ycol[c]-h<BOT){newPage(false);c=0;}}
    const x=M+c*(COLW+GAP),top=ycol[c],col=GEN_COLORS[gi%GEN_COLORS.length];
    ops.push(`${hex(col)} rg ${x} ${top-HEAD} ${COLW} ${HEAD} re f`);
    ops.push(`0.75 w ${hex(col)} RG ${x} ${top-h} ${COLW} ${h} re S`);
    ops.push(T(cut(g.name,30),x+8,top-HEAD+8,11,true,"1 1 1"));
    const cnt=g.members.length+" members";ops.push(T(cnt,x+COLW-8-cnt.length*4.3,top-HEAD+8,8,false,"1 1 1"));
    g.members.forEach((m,j)=>ops.push(m.lead?T((j+1)+".  "+cut(m.name,24)+"  (Leader)",x+8,top-HEAD-ROW*(j+1)+4,10,true,"0.48 0.32 0"):T((j+1)+".  "+cut(m.name,34),x+8,top-HEAD-ROW*(j+1)+4,10,false,"0.1 0.13 0.2")));
    ycol[c]-=h+10;
  });
  finish();
  let out="%PDF-1.4\n";const offs=[];
  const add=(n,body)=>{offs[n]=out.length;out+=`${n} 0 obj\n${body}\nendobj\n`;};
  add(1,"<< /Type /Catalog /Pages 2 0 R >>");
  add(2,`<< /Type /Pages /Kids [${pages.map((_,p)=>`${5+2*p} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  add(3,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add(4,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((c,p)=>{
    add(5+2*p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+2*p} 0 R >>`);
    add(6+2*p,`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
  });
  const total=5+pages.length*2,xref=out.length;
  out+=`xref\n0 ${total}\n0000000000 65535 f \n`;
  for(let n=1;n<total;n++)out+=String(offs[n]).padStart(10,"0")+" 00000 n \n";
  out+=`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes=new Uint8Array(out.length);for(let i=0;i<out.length;i++)bytes[i]=out.charCodeAt(i)&255;
  return new Blob([bytes],{type:"application/pdf"});
}

/* ---------- events ---------- */
function genInit(){
  const cfg=()=>genCfg(),touch=()=>{save();genSetupRender();};
  $("genMode").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(!b)return;cfg().mode=b.dataset.mode;touch();});
  $("genSizeChips").addEventListener("click",e=>{const b=e.target.closest("[data-size]");if(!b)return;cfg().size=+b.dataset.size;touch();});
  const setCount=v=>{cfg().count=Math.max(2,Math.min(30,Math.round(+v)||2));touch();};
  $("genCountMinus").onclick=()=>setCount(cfg().count-1);$("genCountPlus").onclick=()=>setCount(cfg().count+1);$("genCount").onchange=e=>setCount(e.target.value);
  $("genTheme").onchange=e=>{cfg().theme=e.target.value;save();};
  [["genAvoid","avoid"],["genSkipAbsent","skipAbsent"],["genAnimate","animate"]].forEach(([id,k])=>$(id).onchange=e=>{cfg()[k]=e.target.checked;touch();});
  $("genPool").addEventListener("click",e=>{const b=e.target.closest(".gen-chip");if(!b||b.disabled)return;const id=b.dataset.id;genExcluded.has(id)?genExcluded.delete(id):genExcluded.add(id);genSetupRender();});
  $("genPoolAll").onclick=()=>{genExcluded=new Set();genSetupRender();};
  $("genLeadersOn").onchange=e=>{cfg().leaderOn=e.target.checked;touch();};
  $("genLeaderPool").addEventListener("click",e=>{const b=e.target.closest(".gen-chip");if(!b)return;const set=genLeaderSet();set.has(b.dataset.id)?set.delete(b.dataset.id):set.add(b.dataset.id);genSaveLeaderSet(set);touch();});
  $("genLeaderClear").onclick=()=>{genSaveLeaderSet(new Set());touch();};
  $("genLeaderMatch").onclick=()=>{const L=genChosenLeaders(genPool()).length;if(L<2)return;cfg().mode="count";cfg().count=Math.min(30,L);touch();toast(`Groups set to ${cfg().count}, one per leader.`);};
  $("genGo").onclick=genGenerate;
  $("genBanner").addEventListener("click",e=>{if(e.target.closest("#genSkip"))genFinish();});
  const res=$("genResults");
  res.addEventListener("input",e=>{const i=e.target.closest(".gen-name");if(i&&genCurrent){genCurrent.groups[+i.dataset.g].name=i.value;genPushNames();}});
  res.addEventListener("change",e=>{if(e.target.id==="genTitle"&&genCurrent)genCurrent.title=e.target.value.trim();});
  res.addEventListener("click",e=>{
    if(!genCurrent)return;
    const star=e.target.closest(".lead-btn");
    if(star){genSetLeader(+star.dataset.g,star.dataset.id);return;}
    const dice=e.target.closest(".gen-dice");
    if(dice){const used=new Set(genCurrent.groups.map(g=>g.name)),n=genOneName(genCurrent.theme,used);if(n){genCurrent.groups[+dice.dataset.g].name=n;dice.parentElement.querySelector(".gen-name").value=n;genPushNames();}else toast("Plain numbering is on. Choose a name theme first.");return;}
    const id=e.target.closest("button")?.id;
    if(id==="genSave")genSave();
    else if(id==="genApply")genApplyCurrent();
    else if(id==="genXlsx")genExport("xlsx");
    else if(id==="genPdf")genExport("pdf");
    else if(id==="genAgain")genGenerate();
    else if(id==="genRename"){const nm=genNames(genCurrent.theme==="numbered"?genCfg().theme:genCurrent.theme,genCurrent.groups.length);genCurrent.theme=genCurrent.theme==="numbered"?genCfg().theme:genCurrent.theme;genCurrent.groups.forEach((g,i)=>g.name=nm[i]);document.querySelectorAll("#genResults .gen-name").forEach((inp,i)=>inp.value=nm[i]);genPushNames();}
  });
  $("genSaved").addEventListener("click",e=>{
    const b=e.target.closest("[data-act]");if(!b)return;const row=b.closest(".gen-saved-row"),s=genSets().find(x=>x.id===row.dataset.id);if(!s)return;
    if(b.dataset.act==="view")genLoad(s.id);
    else if(b.dataset.act==="apply"){if(genApplySet(s,s.id,s.title)){if(genCurrent&&genKey()===s.id&&!genRevealing)genRenderResults();}}
    else if(b.dataset.act==="xlsx")genExport("xlsx",s);
    else if(b.dataset.act==="pdf")genExport("pdf",s);
    else if(b.dataset.act==="del"&&confirm("Delete this saved grouping?")){data.groupSets=genSets().filter(x=>x.id!==s.id);if(genCurrent&&genCurrent.savedId===s.id)genCurrent.savedId=null;save();genRenderSaved();genSetupRender();if(genCurrent&&!genRevealing)genRenderResults();}
  });
  $("genClearAll").onclick=()=>{const id=activeClass()?.id;if(!confirm("Delete ALL saved groupings for this class? The generator will forget who has worked together."))return;data.groupSets=genSets().filter(x=>x.classId!==id);if(genCurrent)genCurrent.savedId=null;save();genRenderSaved();genSetupRender();if(genCurrent&&!genRevealing)genRenderResults();};
}
genInit();
