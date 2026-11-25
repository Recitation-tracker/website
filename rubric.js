/* ClassPulse: General Rubrics for Group Activities (1-5 per criterion, total /25).
   Group points are now earned by scoring an activity with this rubric. */
const GA_CRITERIA=[
  ["Cooperation and Teamwork","Demonstrates cooperation, active participation, and respect for group members."],
  ["Content and Accuracy","Shows understanding of the topic and presents correct and relevant information."],
  ["Creativity and Presentation","Demonstrates creativity, originality, and an organized presentation of outputs."],
  ["Task Completion","Completes the assigned activity according to the given instructions and requirements."],
  ["Time Management","Finishes and submits the activity within the allotted time."]
];
const GA_SCALE=[[5,"Excellent"],[4,"Very Satisfactory"],[3,"Satisfactory"],[2,"Fair"],[1,"Needs Improvement"]];
const gaLevel=t=>t>=22?"Excellent":t>=18?"Very Satisfactory":t>=14?"Satisfactory":t>=10?"Fair":"Needs Improvement";
(function(){
"use strict";
document.body.insertAdjacentHTML("beforeend",`
<dialog id="rubricDialog" class="modal rb-modal"><form onsubmit="return false">
  <div class="modal-heading"><h3 id="rbTitle">Score group activity</h3><button type="button" class="icon-button" id="rbClose" aria-label="Close">×</button></div>
  <div class="modal-field"><label for="rbActivity">Activity (optional)</label><input id="rbActivity" class="input-control" maxlength="60" placeholder="e.g., Problem-solving task"></div>
  <p class="rb-key">${GA_SCALE.map(s=>`<b>${s[0]}</b> ${s[1]}`).join(" · ")}</p>
  <div id="rbRows"></div>
  <div class="rb-total" id="rbTotal"></div>
  <div class="rb-hist" id="rbHist"></div>
  <div class="modal-actions"><button type="button" class="btn btn-outline" id="rbCancel">Cancel</button><button type="button" class="btn btn-primary" id="rbSave" disabled>Save score</button></div>
</form></dialog>`);
const $=id=>document.getElementById(id),dlg=$("rubricDialog");let gid=null;
$("rbRows").innerHTML=GA_CRITERIA.map((c,i)=>`<fieldset class="rb-row"><legend>${i+1}. ${c[0]}</legend><small>${c[1]}</small><div class="rb-scale" role="radiogroup" aria-label="${c[0]}">${[1,2,3,4,5].map(v=>`<label title="${GA_SCALE.find(s=>s[0]===v)[1]}"><input type="radio" name="rb${i}" value="${v}"><span>${v}</span></label>`).join("")}</div></fieldset>`).join("");
const picked=()=>GA_CRITERIA.map((_,i)=>{const r=document.querySelector(`input[name="rb${i}"]:checked`);return r?+r.value:0});
function refresh(){
  const r=picked(),sum=r.reduce((a,b)=>a+b,0),done=r.every(Boolean);
  $("rbTotal").innerHTML=done?`Total Score: <b>${sum}/25</b> · ${gaLevel(sum)}`:`Total Score: <b>${sum}/25</b> · rate all 5 criteria to save`;
  $("rbSave").disabled=!done;
}
function history(){
  const g=classGroups().find(x=>x.id===gid),rows=(data.groupScores||[]).filter(x=>x.classId===activeClass().id&&x.groupId===gid).slice(-5).reverse();
  $("rbHist").innerHTML=rows.length?`<h4>Recent scores</h4><ul>${rows.map(x=>`<li><span>${escapeHTML(x.date)} · ${escapeHTML(x.activity||"Group activity")}</span><b>${x.total}/25 · ${gaLevel(x.total)}</b><button type="button" class="rb-del" data-rb-del="${x.id}" aria-label="Remove this score" title="Remove this score">×</button></li>`).join("")}</ul>`:"";
}
$("rbRows").addEventListener("change",refresh);
$("rbHist").addEventListener("click",e=>{
  const b=e.target.closest("[data-rb-del]");if(!b)return;
  const i=(data.groupScores||[]).findIndex(x=>x.id===b.dataset.rbDel);if(i<0)return;
  if(!confirm("Remove this score? Its points will be taken off the group's total."))return;
  const s=data.groupScores[i],g=classGroups().find(x=>x.id===s.groupId);
  if(g)g.points=Math.max(0,g.points-s.total);data.groupScores.splice(i,1);
  save();renderGroups();renderDashboard();history();toast("Score removed.");
});
$("rbClose").onclick=$("rbCancel").onclick=()=>dlg.close();
$("rbSave").onclick=()=>{
  const r=picked();if(!r.every(Boolean))return;
  const g=classGroups().find(x=>x.id===gid);if(!g)return;
  const total=r.reduce((a,b)=>a+b,0);
  (data.groupScores=data.groupScores||[]).push({id:uid(),classId:activeClass().id,groupId:gid,activity:$("rbActivity").value.trim(),date:todayISO(),ratings:r,total});
  g.points+=total;save();renderGroups();renderDashboard();dlg.close();
  toast(`${g.name}: ${total}/25 · ${gaLevel(total)}`);
};
window.openGroupRubric=function(id){
  const g=classGroups().find(x=>x.id===id);if(!g)return;gid=id;
  $("rbTitle").textContent="Score "+g.name;$("rbActivity").value="";
  document.querySelectorAll("#rbRows input").forEach(i=>i.checked=false);
  refresh();history();dlg.showModal();
};
})();
