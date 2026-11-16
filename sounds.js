/* =====================================================================
   Sound engine: every sound is synthesized live with the Web Audio API
   (no audio files, works offline). Three themes, volume, mute.
   Hooks into app features by wrapping functions that are called by name,
   plus a few explicit sfx() calls placed in the code.
   ===================================================================== */
window.SFX=(()=>{
  let AC=null,master,dry,delay,wetBus,noiseBuf=null;
  const api={debug:false,log:[]};
  const PENTA=[523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51];

  /* ---------- themes ---------- */
  const THEMES={
    marimba:{label:"Marimba · warm wood",parts:[[1,1,"sine",1],[4,.2,"sine",.35],[9.2,.05,"sine",.15]],atk:.003,dur:1,gain:1,wet:.08,env:"exp"},
    arcade:{label:"Arcade · 8-bit chiptune",parts:[[1,.5,"square",1],[2,.1,"square",.5]],atk:.002,dur:.75,gain:1.05,wet:0,env:"lin"},
    crystal:{label:"Crystal · glass bells",parts:[[1,1,"sine",1],[2.76,.16,"sine",.6],[5.4,.06,"sine",.3]],atk:.004,dur:1.8,gain:.85,wet:.42,env:"exp"}
  };
  const cfg=()=>{const s=(typeof data!=="undefined"&&data&&data.settings)||{};if(!s.sound)s.sound={on:true,vol:70,theme:"marimba"};return s.sound;};
  const theme=()=>THEMES[cfg().theme]||THEMES.marimba;
  const level=()=>cfg().on?Math.pow(Math.max(0,Math.min(100,cfg().vol))/100,1.6)*.9:0;

  /* ---------- audio graph ---------- */
  function ctx(){
    if(!AC){
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
      AC=new C();
      master=AC.createGain();
      const comp=AC.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.2;
      master.connect(comp);comp.connect(AC.destination);
      dry=AC.createGain();dry.connect(master);
      delay=AC.createDelay(1);delay.delayTime.value=.17;
      const fb=AC.createGain();fb.gain.value=.38;delay.connect(fb);fb.connect(delay);
      wetBus=AC.createGain();wetBus.gain.value=.8;delay.connect(wetBus);wetBus.connect(master);
    }
    if(AC.state==="suspended"&&AC.resume)AC.resume();
    return AC;
  }
  function noiseBuffer(a){
    if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;
    const len=a.sampleRate*2,b=a.createBuffer(1,len,a.sampleRate),ch=b.getChannelData(0);
    for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;
    return noiseBuf=b;
  }

  /* ---------- building blocks ---------- */
  function note(f,o={}){
    const a=ctx();if(!a)return;
    const {t=0,d=.18,v=.4,glide=0}=o,th=theme(),t0=a.currentTime+t+.004;
    th.parts.forEach(([r,pv,wave,dm])=>{
      if(f*r>15000)return;
      const osc=a.createOscillator(),g=a.createGain(),dur=Math.max(.03,d*th.dur*dm),pk=Math.max(.0002,v*pv*th.gain);
      osc.type=wave;osc.frequency.setValueAtTime(f*r,t0);
      if(glide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,f*r*glide),t0+dur*.85);
      g.gain.setValueAtTime(.0001,t0);
      if(th.env==="lin"){g.gain.linearRampToValueAtTime(pk,t0+th.atk);g.gain.setValueAtTime(pk,t0+Math.min(dur*.5,.06));g.gain.linearRampToValueAtTime(.0001,t0+dur);}
      else{g.gain.exponentialRampToValueAtTime(pk,t0+th.atk);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);}
      osc.connect(g);g.connect(dry);
      if(th.wet){const s=a.createGain();s.gain.value=th.wet;g.connect(s);s.connect(delay);}
      osc.start(t0);osc.stop(t0+dur+.05);
    });
  }
  function noise(o={}){
    const a=ctx();if(!a)return;
    const {t=0,d=.1,v=.25,type="bandpass",f=2000,f2=0,q=1}=o,t0=a.currentTime+t+.003;
    const s=a.createBufferSource();s.buffer=noiseBuffer(a);
    const fl=a.createBiquadFilter();fl.type=type;fl.Q.value=q;fl.frequency.setValueAtTime(f,t0);
    if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t0+d);
    const g=a.createGain();g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),t0+Math.min(.02,d/3));g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    s.connect(fl);fl.connect(g);g.connect(dry);
    s.start(t0,Math.random()*1.5,d+.03);
  }

  /* ---------- the sound library ---------- */
  const S={
    /* interface */
    tick(){note(780,{d:.05,v:.34});noise({d:.012,f:3200,q:1.2,v:.12});},
    nav(){note(PENTA[2],{d:.1,v:.2});note(PENTA[3],{t:.07,d:.15,v:.2});},
    select(){note(PENTA[1],{d:.09,v:.22});note(PENTA[3],{t:.04,d:.07,v:.1});},
    pop(){note(PENTA[4],{d:.1,v:.22,glide:1.25});},
    toggle(){note(660,{d:.07,v:.2});note(495,{t:.06,d:.11,v:.2});},
    save(){[0,2,3].forEach((n,i)=>note(PENTA[n],{t:i*.07,d:.22,v:.3}));},
    apply(){note(392,{d:.12,v:.3});note(587.33,{t:.09,d:.14,v:.3});note(783.99,{t:.18,d:.45,v:.32});noise({t:.04,d:.45,f:400,f2:3500,v:.1,q:.8});},
    export(){noise({d:.28,f:500,f2:4200,v:.14,q:.8});note(PENTA[3],{t:.22,d:.3,v:.28});note(PENTA[5],{t:.3,d:.45,v:.22});},
    warn(){note(196,{d:.13,v:.32});note(165,{t:.13,d:.2,v:.32});},
    skip(){noise({d:.15,f:2500,f2:600,v:.12});note(440,{d:.12,v:.2,glide:.75});},
    switch(){noise({d:.14,f:700,f2:1800,v:.12,q:.8});note(PENTA[1],{d:.1,v:.16});},
    hello(){[0,2,3,5].forEach((n,i)=>note(PENTA[n],{t:i*.08,d:.25,v:.3}));},

    /* attendance */
    present(){note(PENTA[2],{d:.12,v:.3});note(PENTA[4],{t:.07,d:.22,v:.32});},
    absent(){note(196,{d:.3,v:.5,glide:.85});noise({d:.07,type:"lowpass",f:500,v:.14});},
    late(){note(659.25,{d:.12,v:.28});note(523.25,{t:.09,d:.22,v:.28});},
    excused(){note(659.25,{d:.22,v:.26});note(987.77,{t:.1,d:.22,v:.14});},
    clear(){noise({d:.13,f:3200,f2:700,v:.38,q:.6});},
    sweep(){PENTA.slice(0,6).forEach((f,i)=>note(f,{t:i*.045,d:.22,v:.24}));},

    /* recitation */
    oral(){note(392,{d:.14,v:.3,glide:1.4});note(587.33,{t:.1,d:.2,v:.22});},
    chalk(){noise({d:.035,f:4500,q:2,v:.28});noise({t:.06,d:.03,f:5200,q:2,v:.24});note(196,{t:.01,d:.12,v:.3});},
    rate(n){const f=[329.63,392,440,523.25,659.25][Math.max(0,Math.min(4,(n|0)-1))];note(f,{d:.22,v:.34});if(n===5)note(f*2,{t:.05,d:.3,v:.16});},
    score(n){
      const R={5:[523.25,659.25,783.99,1046.5],4:[523.25,659.25,783.99],3:[440,523.25],2:[392,349.23],1:[293.66]}[n]||[523.25];
      R.forEach((f,i)=>note(f,{t:i*(n>=4?.07:.1),d:n===1?.4:.28,v:.34}));
      if(n===5){for(let i=0;i<5;i++)note(PENTA[3+(i%4)]*2,{t:.32+i*.05,d:.25,v:.13});noise({t:.28,d:.5,type:"highpass",f:6000,v:.05,q:.5});}
    },

    /* wheel of names */
    spinStart(){noise({d:.55,f:300,f2:3200,v:.2,q:.7});note(330,{d:.5,v:.2,glide:2.2});},
    winner(){
      [0,2,3,5,7].forEach((n,i)=>note(PENTA[n],{t:i*.09,d:.3,v:.36}));
      [523.25,659.25,783.99].forEach(f=>note(f,{t:.52,d:.9,v:.26}));
      for(let i=0;i<8;i++)note(PENTA[3+Math.floor(Math.random()*5)]*2,{t:.55+i*.06,d:.3,v:.11});
      noise({t:.45,d:.8,type:"highpass",f:6000,v:.05,q:.5});
    },

    /* group generator */
    shuffleStart(){for(let i=0;i<9;i++)noise({t:i*.034,d:.026,f:3500+Math.random()*1500,q:1.4,v:.4});},
    shuffleTick(){noise({d:.022,f:2500+Math.random()*2500,q:1.4,v:.4});},
    deal(i){noise({d:.06,type:"highpass",f:2600,f2:6500,v:.3});note(PENTA[(i||0)%6],{d:.16,v:.3});},
    tada(){[523.25,659.25,783.99].forEach(f=>note(f,{d:.5,v:.28}));note(1046.5,{t:.1,d:.6,v:.26});for(let i=0;i<4;i++)note(PENTA[4+i]*1.5,{t:.2+i*.05,d:.25,v:.1});},
    dice(){for(let i=0;i<5;i++)note(500+Math.random()*700,{t:i*.045,d:.05,v:.16});},

    /* group points */
    coin(){note(987.77,{d:.08,v:.3});note(1318.51,{t:.07,d:.42,v:.32});},
    down(){note(349.23,{d:.12,v:.3,glide:.8});note(261.63,{t:.1,d:.26,v:.3});},
    sweepDown(){noise({d:.4,f:3500,f2:300,v:.18,q:.7});note(392,{d:.4,v:.24,glide:.5});}
  };

  /* wheel pointer tick: pitch and loudness follow the spin speed */
  function tickWheel(vel){const f=520+vel*820;note(f,{d:.045,v:.3-.12*vel});noise({d:.012,f:3000,q:2,v:.18});}
  function wheelDemo(){S.spinStart();let t=0,gap=40;for(let i=0;i<14;i++){const v=1-i/14;setTimeout(()=>tickWheel(v),t);t+=gap;gap*=1.2;}setTimeout(()=>S.winner(),t+250);}

  /* ---------- play (with tiny rate limit) ---------- */
  const last={};
  function play(name,arg){
    if(!cfg().on)return;
    const fn=S[name];if(!fn)return;
    const now=performance.now();if(last[name]&&now-last[name]<28)return;last[name]=now;
    if(!ctx())return;
    master.gain.value=level();
    if(api.debug)api.log.push(name+(arg!==undefined?":"+arg:""));
    try{fn(arg);}catch(e){console.warn("sound error",name,e);}
  }
  api.play=play;api.themes=THEMES;api.names=()=>Object.keys(S);
  api.tickWheel=v=>{if(cfg().on&&ctx()){master.gain.value=level();if(api.debug)api.log.push("wheelTick:"+v.toFixed(2));tickWheel(v);}};
  api._reset=()=>{AC=null;noiseBuf=null;};api._ctx=()=>AC;api._demoWheel=wheelDemo;
  return api;
})();

/* ---------- wiring into the app ---------- */
(function(){
  const play=(n,a)=>SFX.play(n,a);
  const cfg=()=>{if(!data.settings.sound)data.settings.sound={on:true,vol:70,theme:"marimba"};return data.settings.sound;};
  function hook(name,after,before){
    const o=window[name];if(typeof o!=="function")return;
    window[name]=function(){const st=before?before(arguments):undefined;const r=o.apply(this,arguments);try{after(arguments,r,st);}catch(e){}return r;};
  }

  /* wheel: tick every time the pointer crosses a slice */
  let lastIdx=null,lastAng=0,lastTick=0;
  hook("drawWheel",()=>{
    if(!wheelSpinning||!cfg().on){lastIdx=null;return;}
    const n=wheelPool.length;if(n<2)return;
    const TAU=Math.PI*2,seg=TAU/n,a=(((-wheelAngle)%TAU)+TAU)%TAU,i=Math.floor(a/seg);
    if(lastIdx!==null&&i!==lastIdx){const now=performance.now();if(now-lastTick>22){lastTick=now;SFX.tickWheel(Math.min(1,Math.abs(wheelAngle-lastAng)/.22));}}
    lastIdx=i;lastAng=wheelAngle;
  });
  hook("finishSpin",()=>play("winner"));

  /* recitation rubric + record grid */
  hook("recOpen",a=>{if(recType===a[0])play(a[0]==="oral"?"oral":"chalk");});
  hook("recPick",a=>play("rate",a[0]));
  hook("recSetRating",a=>play(a[3]?"rate":"clear",a[3]));

  /* attendance */
  hook("applyCell",a=>play(a[1]?{P:"present",A:"absent",L:"late",E:"excused"}[a[1]]:"clear"));
  hook("attMenuAction",(a,r,t)=>{if(t&&t.type==="col")play(a[0]==="P"?"sweep":a[0]==="off"?"toggle":"clear");},()=>attTarget);

  /* misc */
  hook("switchClass",()=>play("switch"));
  hook("openDialog",()=>play("pop"));

  /* toast messages -> sounds (errors get a soft "bonk") */
  const TOAST=[
    [/^(Oral Recitation|Boardwork):/,null],
    [/^(Need |Add students|Pick a student|Choose |Spin the wheel|Switch to|No student|No group|Plain numbering|Please complete|Could not|Allow pop)/i,"warn"],
    [/downloaded/i,"export"],[/^Groups saved/,"save"],[/teams sent to Group Activity/i,"apply"],
    [/^(Group points reset|Class deleted)/,"sweepDown"],[/^Student skipped/,"skip"],[/^(Marked as no class|Class day restored)/,"toggle"],
    [/^Selected:/,"tada"],
    [/^(Student|Class) (added|updated)|^Settings saved|^Team renamed|^Backup restored|^Demo data restored/,"save"]
  ];
  const _toast=window.toast;
  window.toast=function(m){for(const [re,s] of TOAST){if(re.test(String(m))){if(s)play(s);break;}}return _toast.apply(this,arguments);};

  /* declarative clicks: first matching rule wins (null = this control makes its own sound) */
  const CLICKS=[
    ["#soundToggle",null],["[data-sfx]",null],
    ["[data-group-rename]","tick"],["[data-group-add]","coin"],["[data-group-sub]","down"],
    [".nav-link","nav"],
    ["#spinWheelBtn,#genGo,#genAgain,#saveRatingBtn,.likert-row,.rec-type,#genSave,#genApply,#genXlsx,#genPdf,#dialogSave,#attMenu button,#recMenu button",null],
    [".gen-dice[data-g],#genRename","dice"],["#genSkip","skip"],
    [".att-cell:not(.off),.dayhead","tick"],
    ["#genLeaderPool .gen-chip,.lead-btn","coin"],[".gen-seg button,.gen-chips button,.gen-chip,.gen-stepper button","select"],
    ["button,.btn,.icon-button","tick"]
  ];
  document.addEventListener("click",e=>{
    if(!e.target.closest)return;
    for(const [sel,s] of CLICKS){if(e.target.closest(sel)){if(s)play(s);return;}}
  },true);
  document.addEventListener("change",e=>{if(e.target.matches&&e.target.matches('select,input[type=checkbox],input[type=month]')&&!e.target.id.startsWith("sound"))play("select");});

  /* ---------- sound controls: topbar mute + settings panel ---------- */
  function syncUI(){
    const c=cfg(),b=$("soundToggle");
    if(b){b.textContent=c.on?"🔊":"🔇";b.title=c.on?"Sounds on (click to mute)":"Sounds off (click to turn on)";b.setAttribute("aria-pressed",String(c.on));}
    const on=$("soundOn");if(!on)return;
    on.checked=c.on;$("soundVol").value=c.vol;$("soundVolLabel").textContent=c.vol+"%";
    const th=$("soundTheme");if(!th.options.length)th.innerHTML=Object.entries(SFX.themes).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("");
    th.value=c.theme;
  }
  hook("showView",a=>{if(a[0]==="settings")syncUI();});
  $("soundToggle").addEventListener("click",()=>{const c=cfg();c.on=!c.on;save();syncUI();if(c.on)play("hello");});
  $("soundOn").addEventListener("change",e=>{cfg().on=e.target.checked;save();syncUI();if(cfg().on)play("hello");});
  $("soundVol").addEventListener("input",e=>{cfg().vol=+e.target.value;$("soundVolLabel").textContent=e.target.value+"%";});
  $("soundVol").addEventListener("change",()=>{save();play("coin");});
  $("soundTheme").addEventListener("change",e=>{cfg().theme=e.target.value;save();play("hello");});
  $("soundPreview").addEventListener("click",e=>{
    const b=e.target.closest("[data-sfx]");if(!b)return;
    if(!cfg().on)return toast("Turn sounds on to preview.");
    const [name,arg]=b.dataset.sfx.split(":");
    if(name==="wheel")SFX._demoWheel();else play(name,arg===undefined?undefined:+arg);
  });
  syncUI();
})();
