/* ClassPulse: import students from an Excel (.xlsx) or CSV file into a chosen class.
   Reads .xlsx directly in the browser (no library, works offline). */
(function(){
"use strict";
/* ---------- file readers ---------- */
const dec=s=>s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g,(m,e)=>e[0]==="#"?String.fromCodePoint(/^#[xX]/.test(e)?parseInt(e.slice(2),16):parseInt(e.slice(1),10)):({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"})[e]);
const u16=(b,o)=>b[o]|b[o+1]<<8,u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
async function inflate(u8){const ds=new DecompressionStream("deflate-raw"),w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
async function unzip(buf){
  const b=new Uint8Array(buf);let e=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(u32(b,i)===0x06054b50){e=i;break}
  if(e<0)throw new Error("not a zip");
  const n=u16(b,e+10),files={};let p=u32(b,e+16);
  for(let i=0;i<n&&u32(b,p)===0x02014b50;i++){
    const method=u16(b,p+10),csize=u32(b,p+20),nl=u16(b,p+28),el=u16(b,p+30),cl=u16(b,p+32),lo=u32(b,p+42);
    const name=new TextDecoder().decode(b.subarray(p+46,p+46+nl));
    files[name]=async()=>{const s=lo+30+u16(b,lo+26)+u16(b,lo+28),raw=b.subarray(s,s+csize);
      if(method===0)return raw;if(method===8)return inflate(raw);throw new Error("unsupported zip method")};
    p+=46+nl+el+cl;
  }
  return files;
}
const txt=async f=>new TextDecoder("utf-8").decode(await f());
async function openXlsx(buf){
  const z=await unzip(buf);
  if(!z["xl/workbook.xml"])throw new Error("not an Excel workbook");
  const wb=await txt(z["xl/workbook.xml"]),rels=z["xl/_rels/workbook.xml.rels"]?await txt(z["xl/_rels/workbook.xml.rels"]):"",relMap={};
  for(const m of rels.matchAll(/<Relationship\b[^>]*>/g)){const id=/\bId="([^"]*)"/.exec(m[0]),tg=/\bTarget="([^"]*)"/.exec(m[0]);if(id&&tg)relMap[id[1]]=tg[1]}
  const sheets=[...wb.matchAll(/<sheet\b[^>]*>/g)].map((m,i)=>{
    const nm=/\bname="([^"]*)"/.exec(m[0]),rid=/\br:id="([^"]*)"/.exec(m[0]);let tg=rid&&relMap[rid[1]];
    tg=tg?(tg[0]==="/"?tg.slice(1):"xl/"+tg):"xl/worksheets/sheet"+(i+1)+".xml";
    return{name:nm?dec(nm[1]):"Sheet "+(i+1),path:tg};
  });
  let ss=[];
  if(z["xl/sharedStrings.xml"]){const x=await txt(z["xl/sharedStrings.xml"]);
    ss=[...x.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g,"").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>dec(t[1])).join(""))}
  const read=async i=>{
    if(!z[sheets[i].path])throw new Error("sheet not found");
    const x=await txt(z[sheets[i].path]),rows=[];
    for(const rm of x.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
      const row=[];
      for(const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
        const ref=/\br="([A-Z]+)\d+"/.exec(cm[1]);if(!ref)continue;
        let col=0;for(const ch of ref[1])col=col*26+ch.charCodeAt(0)-64;col--;
        const t=(/\bt="([^"]*)"/.exec(cm[1])||[])[1],body=cm[2]||"";let v="";
        if(t==="inlineStr")v=[...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>dec(m[1])).join("");
        else{const vm=/<v>([\s\S]*?)<\/v>/.exec(body);if(vm)v=t==="s"?(ss[+vm[1]]??""):dec(vm[1])}
        row[col]=v;
      }
      rows.push(Array.from(row,c=>c??""));
    }
    return rows;
  };
  return{sheets:sheets.map(s=>s.name),read};
}
function parseCSV(str){
  str=str.replace(/^\uFEFF/,"");
  const line=str.split(/\r?\n/,1)[0]||"",count=c=>line.split(c).length-1;
  const d=[";","\t",","].sort((a,b)=>count(b)-count(a))[0],rows=[];let row=[],cell="",q=false;
  for(let i=0;i<str.length;i++){
    const ch=str[i];
    if(q){if(ch==='"'){if(str[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;
    else if(ch===d){row.push(cell);cell=""}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&str[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell=""}
    else cell+=ch;
  }
  if(cell!==""||row.length){row.push(cell);rows.push(row)}
  return rows;
}
/* ---------- finding the names ---------- */
const LAST=/^(last\s*name|lastname|surname|family\s*name)\W*$/i,FIRST=/^(first\s*name|firstname|given\s*name)\W*$/i,
  MID=/^(middle\s*(name|initial)?|mi)\W*$/i,
  FULL=/^(full\s*name|name|names|student|students|student\s*name|learner|learners|learner'?s?\s*name|name of (student|learner)s?)\W*$/i;
const SKIP=/^(male|female|boys|girls|men|women|sex|total.*|number of .*)\W*$/i,LETTERS=/[A-Za-zÀ-ɏ]{2,}/;
const clean=s=>String(s??"").replace(/\s+/g," ").trim().replace(/^\d+\s*[.)\-:]\s*/,"");
function pickNames(rows){
  rows=rows.filter(r=>r.some(c=>String(c).trim()));
  let h=-1;
  for(let i=0;i<Math.min(rows.length,12)&&h<0;i++)if(rows[i].some(c=>LAST.test(String(c).trim())||FIRST.test(String(c).trim())||FULL.test(String(c).trim())))h=i;
  const body=h>=0?rows.slice(h+1):rows,hdr=h>=0?rows[h].map(c=>String(c).trim()):[];
  const idx=re=>hdr.findIndex(c=>re.test(c)),li=idx(LAST),fi=idx(FIRST),mi=idx(MID),ni=idx(FULL);
  let get,label;
  if(li>=0&&fi>=0){get=r=>{const l=clean(r[li]),f=clean(r[fi]),m=mi>=0?clean(r[mi]):"";return l&&f?l+", "+f+(m?" "+m:""):""};label="Last name + First name columns"}
  else if(ni>=0){get=r=>clean(r[ni]);label='Column "'+hdr[ni]+'"'}
  else{
    const width=Math.max(0,...body.map(r=>r.length));let best=-1,bc=0;
    for(let c=0;c<width;c++){let n=0;body.forEach(r=>{const v=clean(r[c]);if(LETTERS.test(v)&&!SKIP.test(v))n++});
      if(n>bc){best=c;bc=n}}
    if(best<0)return{names:[],label:""};
    get=r=>clean(r[best]);label="Column "+(best+1);
  }
  const seen=new Set(),names=[];
  body.forEach(r=>{const v=get(r);if(!v||v.length<2||!LETTERS.test(v)||SKIP.test(v))return;const k=v.toLowerCase();if(seen.has(k))return;seen.add(k);names.push(v.slice(0,80))});
  return{names,label};
}
window.CPImport={openXlsx,parseCSV,pickNames};

/* ---------- dialog (browser only) ---------- */
if(typeof document==="undefined"||!document.getElementById("addStudentBtn"))return;
const $=id=>document.getElementById(id),key=s=>s.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g," ").trim();
document.body.insertAdjacentHTML("beforeend",`
<dialog id="importDialog" class="modal"><form onsubmit="return false">
  <div class="modal-heading"><h3>Import students from Excel</h3><button type="button" class="icon-button" id="impClose" aria-label="Close">×</button></div>
  <div class="modal-field"><label for="impClass">Add students to this class</label><select id="impClass" class="input-control"></select></div>
  <div class="modal-field"><label for="impFile">Excel (.xlsx) or CSV file</label><input id="impFile" type="file" class="input-control" accept=".xlsx,.csv,.txt"></div>
  <div class="modal-field" id="impSheetWrap" hidden><label for="impSheet">Sheet to read</label><select id="impSheet" class="input-control"></select></div>
  <div class="modal-field"><label for="impGroup">Groups</label><select id="impGroup" class="input-control"><option value="spread">Spread evenly across the class's groups</option><option value="first">Put everyone in the first group</option></select></div>
  <div class="callout" id="impInfo">One student per row. A column titled <b>Name</b> (or separate <b>Last name</b> and <b>First name</b> columns) works best. Students already in the class are skipped.</div>
  <ul id="impList" class="imp-list" hidden></ul>
  <div class="modal-actions"><button type="button" class="btn btn-outline" id="impTemplate">Download sample file</button><button type="button" class="btn btn-outline" id="impCancel">Cancel</button><button type="button" class="btn btn-primary" id="impGo" disabled>Import</button></div>
</form></dialog>`);
let book=null,found=[],fresh=[];
const dlg=$("importDialog"),cls=()=>data.classes.find(c=>c.id===$("impClass").value);
function preview(){
  const c=cls(),have=new Set((c?c.students:[]).map(s=>key(s.name)));
  fresh=found.filter(n=>!have.has(key(n)));const skipped=found.length-fresh.length;
  $("impList").hidden=!found.length;
  $("impList").innerHTML=fresh.slice(0,6).map(n=>`<li>${escapeHTML(n)}</li>`).join("")+(fresh.length>6?`<li class="muted">…and ${fresh.length-6} more</li>`:"");
  $("impGo").disabled=!fresh.length;$("impGo").textContent=fresh.length?`Import ${fresh.length} student${fresh.length===1?"":"s"}`:"Import";
  if(found.length)$("impInfo").innerHTML=`Found <b>${found.length}</b> name${found.length===1?"":"s"}. <b>${fresh.length}</b> new for “${escapeHTML(c?c.name:"")}”${skipped?`, ${skipped} already in the class (skipped)`:""}.`;
}
function setRows(rows){const r=pickNames(rows);found=r.names;if(!found.length){$("impInfo").textContent="No student names were found. Put one name per row, ideally under a column titled “Name”.";$("impList").hidden=true;$("impGo").disabled=true;return}preview()}
async function onFile(){
  found=[];fresh=[];book=null;$("impSheetWrap").hidden=true;$("impList").hidden=true;$("impGo").disabled=true;$("impGo").textContent="Import";
  const f=$("impFile").files[0];if(!f)return;
  try{
    const buf=await f.arrayBuffer(),b=new Uint8Array(buf.slice(0,4));
    if(b[0]===0xD0&&b[1]===0xCF){$("impInfo").textContent="This is an old Excel (.xls) file. In Excel choose File > Save As > Excel Workbook (.xlsx), then upload that file.";return}
    if(b[0]===0x50&&b[1]===0x4B){
      if(typeof DecompressionStream==="undefined"){$("impInfo").textContent="This browser cannot open .xlsx files. Save the sheet as CSV, or use a recent Chrome or Edge.";return}
      book=await openXlsx(buf);
      $("impSheet").innerHTML=book.sheets.map((s,i)=>`<option value="${i}">${escapeHTML(s)}</option>`).join("");$("impSheetWrap").hidden=book.sheets.length<2;
      setRows(await book.read(0));
    }else setRows(parseCSV(new TextDecoder("utf-8").decode(buf)));
  }catch(e){$("impInfo").textContent="That file could not be read. Make sure it is an .xlsx or .csv file with student names.";}
}
$("impFile").onchange=onFile;
$("impSheet").onchange=async()=>{try{setRows(await book.read(+$("impSheet").value))}catch(e){$("impInfo").textContent="That sheet could not be read."}};
$("impClass").onchange=()=>{if(found.length)preview()};
$("impClose").onclick=$("impCancel").onclick=()=>dlg.close();
$("impTemplate").onclick=()=>{
  const csv="\uFEFFName\r\n\"Dela Cruz, Juan A.\"\r\n\"Santos, Maria B.\"\r\n\"Reyes, Ana C.\"\r\n",a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="student-list-sample.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
$("impGo").onclick=()=>{
  const c=cls();if(!c||!fresh.length)return;
  const gl=(data.classGroups&&data.classGroups[c.id])||data.groups,spread=$("impGroup").value==="spread"&&gl.length>1,start=c.students.length;
  fresh.forEach((name,i)=>c.students.push({id:uid(),name,group:gl.length?gl[spread?(start+i)%gl.length:0].id:1}));
  const n=fresh.length;
  if(data.activeClassId!==c.id)switchClass(c.id);else save();
  renderStudents();renderDashboard();dlg.close();
  toast(`${n} student${n===1?"":"s"} added to ${c.name}.`);
};
$("importStudentsBtn").onclick=()=>{
  $("impClass").innerHTML=data.classes.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${c.students.length})</option>`).join("");
  $("impClass").value=data.activeClassId;$("impFile").value="";found=[];fresh=[];book=null;
  $("impSheetWrap").hidden=true;$("impList").hidden=true;$("impGo").disabled=true;$("impGo").textContent="Import";
  $("impInfo").innerHTML="One student per row. A column titled <b>Name</b> (or separate <b>Last name</b> and <b>First name</b> columns) works best. Students already in the class are skipped.";
  dlg.showModal();
};
})();
