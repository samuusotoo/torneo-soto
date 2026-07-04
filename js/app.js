let ACCENTS, GROUPS, QUALIFY, TIMES, BRACKET, PALMARES;
const KEY="sotodelbarco_v1";
let DATA={}, active="A", dbRef=null, ONLINE=false, AUTH=null, isAdmin=false, koRef=null, KO={};
let MYTEAM=(function(){try{return localStorage.getItem("soto_myteam")||"";}catch(e){return"";}})();
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
let viewDate=null;
function todayStr(){const n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");}
function matchDays(){const s=new Set();bannerItems().forEach(m=>s.add(m.d.slice(0,10)));return [...s].sort();}
function activeDay(){if(viewDate)return viewDate;const t=todayStr(),days=matchDays(),next=days.find(d=>d>=t);return next||days[days.length-1];}
function navDay(dir){const days=matchDays(),idx=days.indexOf(activeDay()),ni=idx+dir;if(ni>=0&&ni<days.length){viewDate=days[ni];renderToday();}}

function canEdit(){ return !ONLINE || isAdmin; }
function setEditable(){
  const ed=canEdit();
  document.querySelectorAll("input[data-key]").forEach(i=>{i.disabled=!ed;});
  if(document.getElementById("ko-list")) renderKO();
  const kt=document.querySelector(".kotabs");
  if(kt){ if(canEdit()){ kt.style.display="flex"; } else { kt.style.display="none"; koView("bracket"); } }
  const mode=document.getElementById("mode"), btn=document.getElementById("adminBtn"), reset=document.getElementById("resetBtn"), exp=document.getElementById("exportBtn"), share=document.getElementById("shareCardBtn");
  const shareGs=document.querySelectorAll(".btn-share-group");
  if(!ONLINE){ mode.textContent="📝 Edición local"; mode.className="mode admin"; if(btn)btn.style.display="none"; if(reset)reset.style.display="inline-block"; if(exp)exp.style.display="inline-block"; if(share)share.style.display="block"; shareGs.forEach(b=>b.style.display="block"); return; }
  if(isAdmin){ mode.textContent="✏️ Administrador"; mode.className="mode admin"; btn.textContent="🔓 Salir de administrador"; reset.style.display="inline-block"; exp.style.display="inline-block"; if(share)share.style.display="block"; shareGs.forEach(b=>b.style.display="block"); }
  else { mode.textContent="👁 Solo lectura"; mode.className="mode view"; btn.textContent="🔒 Entrar como administrador"; reset.style.display="none"; exp.style.display="none"; if(share)share.style.display="none"; shareGs.forEach(b=>b.style.display="none"); }
}
function adminToggle(){
  if(!ONLINE||!AUTH) return;
  if(isAdmin){ AUTH.signOut(); return; }
  openLogin();
}
function openLogin(){
  const m=document.getElementById("loginModal"); if(!m)return;
  document.getElementById("login-email").value="";
  document.getElementById("login-pass").value="";
  document.getElementById("login-error").style.display="none";
  m.style.display="flex";
  setTimeout(()=>document.getElementById("login-email").focus(),50);
}
function closeLogin(){
  const m=document.getElementById("loginModal"); if(m)m.style.display="none";
}
function submitLogin(){
  const email=document.getElementById("login-email").value.trim();
  const pass=document.getElementById("login-pass").value;
  const err=document.getElementById("login-error");
  if(!email||!pass){ err.textContent="Rellena email y contraseña."; err.style.display="block"; return; }
  AUTH.signInWithEmailAndPassword(email,pass)
    .then(()=>closeLogin())
    .catch(e=>{ err.textContent="Credenciales incorrectas."; err.style.display="block"; });
}

function localLoad(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}}
function localSave(){localStorage.setItem(KEY,JSON.stringify(DATA))}
function koLoad(){try{return JSON.parse(localStorage.getItem(KEY+"_ko"))||{}}catch(e){return{}}}
function koSave(){localStorage.setItem(KEY+"_ko",JSON.stringify(KO))}
function initStorage(){
  const enabled = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey!=="PEGA_AQUI";
  if(enabled){
    try{
      firebase.initializeApp(FIREBASE_CONFIG);
      dbRef=firebase.database().ref("resultados");
      ONLINE=true; setConn("conectando…","off");
      AUTH=firebase.auth();
      AUTH.onAuthStateChanged(u=>{ isAdmin=!!u; setEditable(); });
      koRef=firebase.database().ref("eliminatorias");
      koRef.on("value",snap=>{ KO=snap.val()||{}; renderKO(); renderToday(); });
      dbRef.on("value",snap=>{ DATA=snap.val()||{}; applyInputs(); renderAllStandings(); renderToday(); setConn("● compartido en directo","on"); },
        err=>{ setConn("error de conexión","off"); console.error(err); });
      firebase.database().ref(".info/connected").on("value",s=>{ setConn(s.val()===true?"● compartido en directo":"sin conexión…", s.val()===true?"on":"off"); });
    }catch(e){ console.error(e); fallbackLocal(); }
  } else fallbackLocal();
}
function fallbackLocal(){
  ONLINE=false; DATA=localLoad(); KO=koLoad();
  document.getElementById("setup").style.display="block";
  setConn("● modo local","off");
  applyInputs(); renderAllStandings(); renderKO(); renderToday(); setEditable();
}
function setConn(txt,cls){const c=document.getElementById("conn");c.textContent=txt;c.className="conn "+cls;}
function writeMatch(g,key,obj){
  if(ONLINE){ if(obj===null) dbRef.child(g+"/"+key).remove(); else dbRef.child(g+"/"+key).set(obj); }
  else { DATA[g]=DATA[g]||{}; if(obj===null) delete DATA[g][key]; else DATA[g][key]=obj; localSave(); renderStandings(g); }
}

function schedule(n){
  let idx=[...Array(n).keys()]; if(n%2)idx.push(-1);
  const m=idx.length,rounds=[];
  for(let r=0;r<m-1;r++){const round=[];
    for(let k=0;k<m/2;k++){const a=idx[k],b=idx[m-1-k];if(a!==-1&&b!==-1)round.push(r%2?[b,a]:[a,b]);}
    rounds.push(round); idx.splice(1,0,idx.pop());}
  return rounds;
}
function mid(i,j){return i<j?`${i}-${j}`:`${j}-${i}`;}
function played(r){return r&&r.gh!==""&&r.ga!==""&&r.gh!=null&&r.ga!=null;}

function computeStats(g,subset){
  const teams=GROUPS[g],S={};
  teams.forEach((_,i)=>{if(!subset||subset.includes(i))S[i]={i,pj:0,g:0,e:0,p:0,gf:0,gc:0};});
  const data=DATA[g]||{};
  for(const key in data){const r=data[key];if(!played(r))continue;
    const a=+key.split("-")[0],b=+key.split("-")[1];const home=r.home,away=home===a?b:a;
    if(subset&&(!subset.includes(home)||!subset.includes(away)))continue;
    const gh=+r.gh,ga=+r.ga,H=S[home],A=S[away];
    H.pj++;A.pj++;H.gf+=gh;H.gc+=ga;A.gf+=ga;A.gc+=gh;
    if(gh>ga){H.g++;A.p++;}else if(gh<ga){A.g++;H.p++;}else{H.e++;A.e++;}}
  Object.values(S).forEach(t=>{t.pts=t.g*3+t.e;t.dg=t.gf-t.gc;});
  return S;
}
function standings(g){
  let arr=Object.values(computeStats(g)).sort((a,b)=>b.pts-a.pts);
  const out=[];let i=0;
  while(i<arr.length){let j=i;while(j+1<arr.length&&arr[j+1].pts===arr[i].pts)j++;
    let cl=arr.slice(i,j+1);
    if(cl.length>1){const sub=cl.map(t=>t.i),mini=computeStats(g,sub);
      cl.sort((a,b)=>{const ma=mini[a.i],mb=mini[b.i];
        if(mb.pts!==ma.pts)return mb.pts-ma.pts;            /* 1) enfrentamiento directo */
        if(b.dg!==a.dg)return b.dg-a.dg;                    /* 2) mayor diferencia de goles */
        if(a.gc!==b.gc)return a.gc-b.gc;                    /* 3) menos goles encajados */
        return GROUPS[g][a.i].localeCompare(GROUPS[g][b.i]);/* 4) tarjetas y 5) moneda: manual */});}
    out.push(...cl);i=j+1;}
  return out;
}
function renderStandings(g){
  const tb=document.getElementById("tb-"+g);if(!tb)return;
  tb.innerHTML=standings(g).map((t,idx)=>{
    const qc=idx<QUALIFY[g]?"q":"";const dg=(t.dg>0?"+":"")+t.dg;
    const mine=(GROUPS[g][t.i]===MYTEAM)?" myteam":"";
    return `<tr class="qual ${qc}${mine}"><td class="pos">${idx+1}</td><td class="team">${esc(GROUPS[g][t.i])}</td><td>${t.pj}</td><td>${t.g}</td><td>${t.e}</td><td>${t.p}</td><td>${t.gf}</td><td>${t.gc}</td><td>${dg}</td><td class="pts">${t.pts}</td></tr>`;
  }).join("");
}
function renderAllStandings(){Object.keys(GROUPS).forEach(renderStandings);}
function allMatches(){
  let out=[];
  Object.keys(GROUPS).forEach(g=>{ schedule(GROUPS[g].length).forEach(r=>r.forEach(([h,a])=>{
    const key=mid(h,a),info=(TIMES[g]&&TIMES[g][key])?TIMES[g][key]:null; out.push({g,h,a,key,info}); })); });
  return out;
}
function scoreText(g,h,a,key){
  const r=(DATA[g]||{})[key]; if(!played(r)) return null;
  const home=r.home; let gh,ga; if(home===h){gh=r.gh;ga=r.ga;}else{gh=r.ga;ga=r.gh;}
  return gh+" - "+ga;
}
function ordinal(p){return p+"º";}
function groupReady(g){const need=GROUPS[g].length*(GROUPS[g].length-1)/2;let c=0;const d=DATA[g]||{};for(const k in d)if(played(d[k]))c++;return c>=need;}
function matchById(id){for(const r of ["octavos","cuartos","semis","finales"]){const m=BRACKET[r].find(x=>x.id===id);if(m)return m;}return null;}
function koResult(id){
  const r=KO[id];if(!r)return {decided:false};
  const gh=r.gh,ga=r.ga;
  if(gh===""||ga===""||gh==null||ga==null)return {decided:false};
  const a=+gh,b=+ga;
  if(a>b)return {decided:true,winner:"a"};
  if(b>a)return {decided:true,winner:"b"};
  const ph=r.ph,pa=r.pa;
  if(ph===""||pa===""||ph==null||pa==null)return {decided:false,tie:true};
  const x=+ph,y=+pa;
  if(x>y)return {decided:true,winner:"a",pen:true};
  if(y>x)return {decided:true,winner:"b",pen:true};
  return {decided:false,tie:true};
}
function slotTeam(slot){
  if(slot.t==="g"){
    if(groupReady(slot.g)){const s=standings(slot.g);return {name:GROUPS[slot.g][s[slot.p-1].i],decided:true};}
    return {name:ordinal(slot.p)+" Grupo "+slot.g,decided:false};
  }
  const res=koResult(slot.m);
  if(!res.decided)return {name:(slot.t==="w"?"Ganador ":"Perdedor ")+slot.m,decided:false};
  const m=matchById(slot.m);
  if(!m) return {name:slot.m, decided:false};
  const which=slot.t==="w"?res.winner:(res.winner==="a"?"b":"a");
  return slotTeam(m[which]);
}
function bannerItems(){
  let out=[];
  allMatches().filter(m=>m.info).forEach(m=>{ out.push({d:m.info.d,hm:m.info.hm,day:m.info.day,accent:ACCENTS[m.g],badge:m.g,n1:GROUPS[m.g][m.h],n2:GROUPS[m.g][m.a],score:scoreText(m.g,m.h,m.a,m.key)}); });
  ["octavos","cuartos","semis","finales"].forEach(r=>BRACKET[r].forEach(m=>{
    const A=slotTeam(m.a),B=slotTeam(m.b),res=KO[m.id]||{};
    let sc=null; if(res.gh!==""&&res.ga!==""&&res.gh!=null&&res.ga!=null) sc=res.gh+" - "+res.ga;
    out.push({d:m.d,hm:m.hm,day:m.day,accent:"#d4a017",badge:"★",n1:A.name,n2:B.name,score:sc});
  }));
  return out;
}
function renderKO(){
  const root=document.getElementById("ko-list");if(!root)return;
  const ed=canEdit();
  const rounds=[["octavos","Octavos de final"],["cuartos","Cuartos de final"],["semis","Semifinales"],["finales","Final y 3.º/4.º puesto"]];
  root.innerHTML=rounds.map(([key,label])=>{
    const matches=BRACKET[key].map(m=>{
      const A=slotTeam(m.a),B=slotTeam(m.b),res=koResult(m.id),r=KO[m.id]||{};
      const wa=res.decided&&res.winner==="a",wb=res.decided&&res.winner==="b";
      const filled=r.gh!==""&&r.ga!==""&&r.gh!=null&&r.ga!=null;
      const tie=filled&&(+r.gh===+r.ga);
      const dis=ed?"":"disabled";
      const head=`${m.title||m.id} · ${m.day} · ${m.hm}`;
      return `<div class="komatch">
        <div class="kohead">${head}</div>
        <div class="korow ${wa?'win':''}"><span class="koname">${esc(A.name)}</span><input type="number" min="0" inputmode="numeric" ${dis} value="${r.gh!=null?r.gh:''}" onchange="setKO('${m.id}','gh',this.value)"></div>
        <div class="korow ${wb?'win':''}"><span class="koname">${esc(B.name)}</span><input type="number" min="0" inputmode="numeric" ${dis} value="${r.ga!=null?r.ga:''}" onchange="setKO('${m.id}','ga',this.value)"></div>
        ${tie?`<div class="kopen"><span>Penaltis</span><input type="number" min="0" inputmode="numeric" ${dis} value="${r.ph!=null?r.ph:''}" onchange="setKO('${m.id}','ph',this.value)"><span>-</span><input type="number" min="0" inputmode="numeric" ${dis} value="${r.pa!=null?r.pa:''}" onchange="setKO('${m.id}','pa',this.value)"></div>`:''}
        ${tie&&!res.decided?'<div class="koundec">Empate — define los penaltis</div>':''}
      </div>`;
    }).join('');
    return `<div class="sec-title">${label}</div><div class="card">${matches}</div>`;
  }).join('');
  renderBracket();
  renderChampion();
}
function renderChampion(){
  const host=document.getElementById("champion"); if(!host) return;
  const fin=koResult("FIN");
  if(!fin.decided){ host.style.display="none"; host.innerHTML=""; return; }
  const F=matchById("FIN");
  const champ=slotTeam(fin.winner==="a"?F.a:F.b).name;
  const sub=slotTeam(fin.winner==="a"?F.b:F.a).name;
  const t=koResult("T34"); let third="Por decidir";
  if(t.decided){ const T=matchById("T34"); third=slotTeam(t.winner==="a"?T.a:T.b).name; }
  host.innerHTML=`
    <div class="champ-title">🏆 ¡Campeón del III Torneo Soto del Barco!</div>
    <div class="podium">
      <div class="po po2"><div class="medal">🥈</div><div class="porole">Subcampeón</div><div class="poname">${esc(sub)}</div><div class="block">2</div></div>
      <div class="po po1"><div class="crown">👑</div><div class="medal">🥇</div><div class="porole">Campeón</div><div class="poname">${esc(champ)}</div><div class="block">1</div></div>
      <div class="po po3"><div class="medal">🥉</div><div class="porole">3.º puesto</div><div class="poname">${esc(third)}</div><div class="block">3</div></div>
    </div>`;
  host.style.display="block";
}
function allPlayedMatches(){
  let out=[];
  Object.keys(GROUPS).forEach(function(g){
    const d=DATA[g]||{};
    for(const key in d){ const r=d[key]; if(!played(r))continue;
      const a=+key.split("-")[0],b=+key.split("-")[1]; const home=r.home,away=home===a?b:a;
      out.push({a:GROUPS[g][home],b:GROUPS[g][away],ga:+r.gh,gb:+r.ga}); }
  });
  ["octavos","cuartos","semis","finales"].forEach(function(rnd){ BRACKET[rnd].forEach(function(m){
    const r=KO[m.id]; if(!r||r.gh===""||r.ga===""||r.gh==null||r.ga==null)return;
    const A=slotTeam(m.a),B=slotTeam(m.b); if(!A.decided||!B.decided)return;
    out.push({a:A.name,b:B.name,ga:+r.gh,gb:+r.ga}); });});
  return out;
}
function openStats(){closeMenu();renderStats();var m=document.getElementById("statsModal");if(m)m.style.display="flex";}
function closeStats(){var m=document.getElementById("statsModal");if(m)m.style.display="none";}
function renderStats(){
  const body=document.getElementById("stats-body"); if(!body)return;
  const M=allPlayedMatches();
  if(M.length===0){ body.innerHTML='<div class="stat-empty">Aún no hay partidos jugados.<br>Las estadísticas irán apareciendo según se disputen los encuentros.</div>'; return; }
  const T={};
  function add(n){ if(!T[n])T[n]={gf:0,gc:0,pj:0,cs:0}; return T[n]; }
  let totalGoals=0, most=M[0];
  M.forEach(function(m){
    const A=add(m.a),B=add(m.b);
    A.gf+=m.ga;A.gc+=m.gb;A.pj++; B.gf+=m.gb;B.gc+=m.ga;B.pj++;
    if(m.gb===0)A.cs++; if(m.ga===0)B.cs++;
    totalGoals+=m.ga+m.gb;
    if((m.ga+m.gb)>(most.ga+most.gb))most=m;
  });
  const teams=Object.keys(T).map(function(n){var t=T[n];return {n:n,gf:t.gf,gc:t.gc,pj:t.pj,cs:t.cs,avg:t.gc/t.pj};});
  const less=teams.slice().sort(function(a,b){ if(a.avg!==b.avg)return a.avg-b.avg; if(a.gc!==b.gc)return a.gc-b.gc; return b.pj-a.pj;});
  const scorer=teams.slice().sort(function(a,b){return b.gf-a.gf;})[0];
  const cs=teams.slice().sort(function(a,b){return b.cs-a.cs||a.gc-b.gc;})[0];
  const avg=(totalGoals/M.length).toFixed(2);
  const lg=less[0];
  function fm(m){return esc(m.a)+' '+m.ga+'-'+m.gb+' '+esc(m.b);}
  const ranking=less.slice(0,3).map(function(t,i){ return `<div class="rt"><span>${i+1}. ${esc(t.n)}</span><span><b>${t.gc}</b> encajados · ${t.avg.toFixed(2)}/p</span></div>`; }).join('');
  body.innerHTML=`
    <div class="stat-hero">
      <div class="lbl">🛡️ Equipo menos goleado</div>
      <div class="team">${esc(lg.n)}</div>
      <div class="sub">${lg.gc} goles encajados en ${lg.pj} partidos · media ${lg.avg.toFixed(2)} por partido</div>
    </div>
    <div class="stat-rank">${ranking}</div>
    <div class="stat-grid">
      <div class="stile"><div class="k">⚽ Goles totales</div><div class="v">${totalGoals}</div></div>
      <div class="stile"><div class="k">📊 Media goles/partido</div><div class="v">${avg}</div></div>
      <div class="stile"><div class="k">🔥 Equipo más goleador</div><div class="v">${esc(scorer.n)} (${scorer.gf})</div></div>
      <div class="stile"><div class="k">🧤 Más porterías a 0</div><div class="v">${esc(cs.n)} (${cs.cs})</div></div>
      <div class="stile"><div class="k">🥅 Partido + goles</div><div class="v">${fm(most)} (${most.ga+most.gb})</div></div>
      <div class="stile"><div class="k">🏟️ Partidos jugados</div><div class="v">${M.length}</div></div>
    </div>`;
}
function allTeamsList(){ let a=[]; Object.keys(GROUPS).forEach(function(g){GROUPS[g].forEach(function(t){a.push(t);});}); return a; }
function groupOf(name){ for(const g in GROUPS){ if(GROUPS[g].indexOf(name)>=0) return g; } return null; }
function setMyTeam(name){ MYTEAM=name; try{localStorage.setItem("soto_myteam",name);}catch(e){} renderMyTeam(); renderAllStandings(); renderBracket(); }
function myMatches(){
  let out=[];
  const g=groupOf(MYTEAM);
  if(g){
    schedule(GROUPS[g].length).forEach(function(r){ r.forEach(function(pair){
      const h=pair[0],a=pair[1];
      if(GROUPS[g][h]!==MYTEAM && GROUPS[g][a]!==MYTEAM) return;
      const key=mid(h,a),info=(TIMES[g]&&TIMES[g][key])?TIMES[g][key]:null;
      const meIdx=GROUPS[g][h]===MYTEAM?h:a, opIdx=meIdx===h?a:h;
      const r2=(DATA[g]||{})[key]; let res=null,mine=null;
      if(r2&&played(r2)){ const home=r2.home; let gh,ga; if(home===meIdx){gh=r2.gh;ga=r2.ga;}else{gh=r2.ga;ga=r2.gh;} res=gh+"-"+ga; mine=(+gh>+ga)?"win":((+gh<+ga)?"loss":"draw"); }
      out.push({d:info?info.d:"",when:info?(info.day+" "+info.hm):"",opp:GROUPS[g][opIdx],res:res,mine:mine,phase:"Grupo "+g,ko:false,dec:!!res});
    });});
  }
  ["octavos","cuartos","semis","finales"].forEach(function(rnd){ BRACKET[rnd].forEach(function(m){
    const A=slotTeam(m.a),B=slotTeam(m.b);
    let side=null; if(A.decided&&A.name===MYTEAM)side="a"; else if(B.decided&&B.name===MYTEAM)side="b";
    if(!side)return;
    const opp=side==="a"?B.name:A.name;
    const r=KO[m.id]; let res=null,mine=null;
    if(r&&r.gh!==""&&r.ga!==""&&r.gh!=null&&r.ga!=null){
      let gh=side==="a"?r.gh:r.ga, ga=side==="a"?r.ga:r.gh; res=gh+"-"+ga;
      const kr=koResult(m.id);
      if(kr.decided){ mine=(kr.winner===side)?"win":"loss"; if(+gh===+ga){ let ph=side==="a"?r.ph:r.pa, pa=side==="a"?r.pa:r.ph; res+=" ("+ph+"-"+pa+" pen)"; } }
      else mine="draw";
    }
    const lbl=m.id==="FIN"?"Final":(m.id==="T34"?"3.º/4.º":({octavos:"Octavos",cuartos:"Cuartos",semis:"Semifinal"}[rnd]));
    out.push({d:m.d,when:m.day+" "+m.hm,opp:opp,res:res,mine:mine,phase:lbl,ko:true,dec:koResult(m.id).decided});
  });});
  return out;
}
function myTeamStatus(g){
  if(!groupReady(g)) return "En fase de grupos";
  const pos=standings(g).findIndex(function(t){return GROUPS[g][t.i]===MYTEAM;})+1;
  if(pos>QUALIFY[g]) return "No clasificado para la fase final (acabó "+pos+".º de su grupo)";
  const fin=koResult("FIN");
  if(fin.decided){ const F=matchById("FIN"); if(slotTeam(fin.winner==="a"?F.a:F.b).name===MYTEAM) return "🏆 ¡Campeón del torneo!"; }
  const ms=myMatches().filter(function(m){return m.ko;});
  for(const m of ms){ if(m.dec&&m.mine==="loss"){ return m.phase==="Final"?"🥈 Subcampeón":("Eliminado en "+m.phase); } }
  return "Clasificado · sigue en competición";
}
function renderMyTeam(){
  const body=document.getElementById("mt-body"); if(!body) return;
  if(!MYTEAM){ body.innerHTML='<div class="mt-empty">Selecciona tu equipo arriba para ver su grupo, sus partidos y su camino en el cuadro.</div>'; return; }
  const g=groupOf(MYTEAM); if(!g){ body.innerHTML=""; return; }
  const st=standings(g); const pos=st.findIndex(function(t){return GROUPS[g][t.i]===MYTEAM;})+1; const me=st[pos-1];
  const ms=myMatches();
  const next=ms.filter(function(m){return !m.res;}).sort(function(a,b){return (a.d||"")<(b.d||"")?-1:1;})[0];
  const posLabel=groupReady(g)?`${pos}.º clasificado`:`${pos}.º (provisional)`;
  const matchRows=ms.map(function(m){
    const cls=m.res?(m.mine==="win"?"win":(m.mine==="loss"?"loss":"draw")):"";
    return `<div class="mt-match ${cls}"><span class="ph${m.ko?' ph-ko':''}">${m.phase}</span><span class="op">${m.when?m.when+' · ':''}vs ${esc(m.opp)}</span><span class="rs">${m.res||'—'}</span></div>`;
  }).join('');
  body.innerHTML=`
    <div class="mt-hero"><div class="nm">${esc(MYTEAM)}</div><div class="gp">Grupo ${g} · ${posLabel} · ${me.pts} pts</div></div>
    <div class="mt-row"><b>Estado:</b> ${myTeamStatus(g)}</div>
    ${next?`<div class="mt-row"><b>Próximo partido:</b> ${next.phase} · ${next.when||'fecha por confirmar'} · vs ${esc(next.opp)}</div>`:''}
    <div class="mt-sub">Sus partidos</div>
    ${ms.length===0?'<div class="mt-empty">Aún no hay partidos.</div>':matchRows}`;
}
function openMyTeam(){
  closeMenu();
  const sel=document.getElementById("mt-select");
  if(sel){ sel.innerHTML='<option value="">— Elige tu equipo —</option>'+allTeamsList().map(t=>`<option value="${t}"${t===MYTEAM?' selected':''}>${t}</option>`).join(''); }
  renderMyTeam();
  var m=document.getElementById("myteamModal"); if(m)m.style.display="flex";
}
function closeMyTeam(){var m=document.getElementById("myteamModal");if(m)m.style.display="none";}
function openMenu(){document.getElementById("drawer").classList.add("open");document.getElementById("drawer-back").classList.add("open");}
function closeMenu(){document.getElementById("drawer").classList.remove("open");document.getElementById("drawer-back").classList.remove("open");}
function openPalmares(){closeMenu();renderPalmares();var m=document.getElementById("palmaresModal");if(m)m.style.display="flex";}
function closePalmares(){var m=document.getElementById("palmaresModal");if(m)m.style.display="none";}
function renderPalmares(){
  const list=document.getElementById("palmares-list"); if(!list) return;
  list.innerHTML=PALMARES.map(function(e){
    let champ=e.champ||"",sub=e.sub||"",third=e.third||"",fourth=e.fourth||"";
    if(e.live){
      const fin=koResult("FIN");
      if(fin.decided){ const F=matchById("FIN"); champ=slotTeam(fin.winner==="a"?F.a:F.b).name; sub=slotTeam(fin.winner==="a"?F.b:F.a).name; }
      const t=koResult("T34");
      if(t.decided){ const T=matchById("T34"); third=slotTeam(t.winner==="a"?T.a:T.b).name; fourth=slotTeam(t.winner==="a"?T.b:T.a).name; }
    }
    const tag=e.live&&!champ?' <span class="pend">(en juego)</span>':'';
    let content;
    if(champ){
      const awards=[["⭐","Mejor jugador",e.mvp],["🛡️","Equipo menos goleado",e.lessGoals],["👏","Mejor espectador",e.spectator]];
      content=`
        <div class="prow win"><span class="m">🥇</span><span class="nm">${esc(champ)}</span></div>
        <div class="prow"><span class="m">🥈</span><span class="nm">${esc(sub)||"—"}</span></div>
        <div class="prow"><span class="m">🥉</span><span class="nm">${esc(third)||"—"}</span></div>
        ${fourth?`<div class="prow"><span class="m m4">4º</span><span class="nm">${esc(fourth)}</span></div>`:''}
        <div class="pdiv"></div>
        ${awards.map(a=>`<div class="pextra">${a[0]} ${a[1]}: <b>${a[2]||"Por confirmar"}</b></div>`).join('')}`;
    } else if(e.live){
      content='<div class="pend">Se completará al terminar la final.</div>';
    } else {
      content='<div class="pend">Datos por confirmar.</div>';
    }
    return `<div class="ped"><div class="ped-h"><span>${e.ed}.ª edición${tag}</span><span class="yr">${e.year}</span></div>${content}</div>`;
  }).join('');
}
function showPhase(p){
  const g=p==="groups";
  document.getElementById("phase-groups").style.display=g?"block":"none";
  document.getElementById("phase-final").style.display=g?"none":"block";
  document.getElementById("ph-groups").className="phasetab"+(g?" on":"");
  document.getElementById("ph-final").className="phasetab"+(g?"":" on");
  if(!g) renderBracket();
}
function koView(v){
  document.getElementById("ko-list").style.display=(v==="list")?"block":"none";
  document.getElementById("ko-bracket").style.display=(v==="bracket")?"block":"none";
  document.getElementById("kt-list").className="kotab"+(v==="list"?" on":"");
  document.getElementById("kt-br").className="kotab"+(v==="bracket"?" on":"");
  if(v==="bracket") renderBracket();
}
function koBox(m){
  const A=slotTeam(m.a),B=slotTeam(m.b),res=koResult(m.id),r=KO[m.id]||{};
  const sa=(r.gh!=null&&r.gh!=="")?r.gh:"";
  const sb=(r.ga!=null&&r.ga!=="")?r.ga:"";
  const tie=sa!==""&&sb!==""&&(+sa===+sb);
  const pena=(tie&&r.ph!=null&&r.ph!=="")?r.ph:"";
  const penb=(tie&&r.pa!=null&&r.pa!=="")?r.pa:"";
  const lbl=m.id==="FIN"?"FINAL":(m.id==="T34"?"3.º/4.º":m.id);
  return {a:A.name,b:B.name,sa,sb,pena,penb,wa:res.decided&&res.winner==="a",wb:res.decided&&res.winner==="b",label:lbl+" · "+m.day+" "+m.hm};
}
function renderBracket(){
  const host=document.getElementById("ko-bracket");if(!host)return;
  const O=BRACKET.octavos,C=BRACKET.cuartos,S=BRACKET.semis,F=BRACKET.finales;
  const boxW=188,boxH=54,pitch=70,colGap=212,padX=12,padY=30;
  const xO=padX,xC=padX+colGap,xS=padX+2*colGap,xF=padX+3*colGap;
  const cO=O.map((_,i)=>padY+boxH/2+i*pitch);
  const cC=C.map((_,k)=>(cO[2*k]+cO[2*k+1])/2);
  const cS=S.map((_,k)=>(cC[2*k]+cC[2*k+1])/2);
  const cF=(cS[0]+cS[1])/2;
  const c34=cF+pitch*1.7;
  const W=xF+boxW+padX, H=Math.max(cO[cO.length-1]+boxH/2, c34+boxH/2)+16;
  const trunc=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+"…":s;};
  function conn(x1,y1,x2,y2){const mx=(x1+x2)/2;return `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="#9fc4af" stroke-width="2" opacity="0.55"/>`;}
  let g="";
  C.forEach((_,k)=>{ g+=conn(xO+boxW,cO[2*k],xC,cC[k]); g+=conn(xO+boxW,cO[2*k+1],xC,cC[k]); });
  S.forEach((_,k)=>{ g+=conn(xC+boxW,cC[2*k],xS,cS[k]); g+=conn(xC+boxW,cC[2*k+1],xS,cS[k]); });
  g+=conn(xS+boxW,cS[0],xF,cF); g+=conn(xS+boxW,cS[1],xF,cF);
  function box(x,cy,m){
    const b=koBox(m),top=cy-boxH/2,rh=boxH/2,mid=top+rh;let s=`<g>`;
    s+=`<text x="${x}" y="${top-4}" font-size="9" fill="#cfe6d8" font-weight="700">${esc(b.label)}</text>`;
    s+=`<rect x="${x}" y="${top}" width="${boxW}" height="${boxH}" rx="7" fill="#ffffff"/>`;
    if(b.wa) s+=`<rect x="${x}" y="${top}" width="${boxW}" height="${rh}" fill="#dcfce7"/>`;
    if(b.wb) s+=`<rect x="${x}" y="${mid}" width="${boxW}" height="${rh}" fill="#dcfce7"/>`;
    s+=`<line x1="${x}" y1="${mid}" x2="${x+boxW}" y2="${mid}" stroke="#e4ece7" stroke-width="1"/>`;
    s+=`<text x="${x+8}" y="${top+18}" font-size="12" fill="#15321f" font-weight="${b.wa?800:500}">${esc(trunc(b.a,21))}</text>`;
    var scoreA=esc(b.sa); if(b.pena!=="") scoreA+=' <tspan font-size="10" fill="#15803d">('+esc(b.pena)+')</tspan>';
    s+=`<text x="${x+boxW-8}" y="${top+18}" font-size="13" fill="#15321f" font-weight="800" text-anchor="end">${scoreA}</text>`;
    s+=`<text x="${x+8}" y="${mid+18}" font-size="12" fill="#15321f" font-weight="${b.wb?800:500}">${esc(trunc(b.b,21))}</text>`;
    var scoreB=esc(b.sb); if(b.penb!=="") scoreB+=' <tspan font-size="10" fill="#15803d">('+esc(b.penb)+')</tspan>';
    s+=`<text x="${x+boxW-8}" y="${mid+18}" font-size="13" fill="#15321f" font-weight="800" text-anchor="end">${scoreB}</text>`;
    if(typeof MYTEAM!=="undefined"&&MYTEAM&&(b.a===MYTEAM||b.b===MYTEAM)) s+=`<rect x="${x}" y="${top}" width="${boxW}" height="${boxH}" rx="7" fill="none" stroke="#f0b400" stroke-width="3"/>`;
    s+=`</g>`;return s;
  }
  let bx="";
  O.forEach((m,i)=>bx+=box(xO,cO[i],m));
  C.forEach((m,k)=>bx+=box(xC,cC[k],m));
  S.forEach((m,k)=>bx+=box(xS,cS[k],m));
  bx+=box(xF,cF,F[1]);
  bx+=box(xF,c34,F[0]);
  let hd="";
  [[xO,"OCTAVOS"],[xC,"CUARTOS"],[xS,"SEMIS"],[xF,"FINAL"]].forEach(([x,t])=>{hd+=`<text x="${x}" y="14" font-size="11" fill="#ffffff" font-weight="800" letter-spacing="1">${t}</text>`;});
  const svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI,Arial,sans-serif" style="min-width:${W}px">${g}${bx}${hd}</svg>`;
  host.innerHTML=`<div class="brhint">Desliza en horizontal para ver todo el cuadro →</div>`+svg;
}
function writeKO(id,obj){
  if(ONLINE){ if(obj===null) koRef.child(id).remove(); else koRef.child(id).set(obj); }
  else { if(obj===null) delete KO[id]; else KO[id]=obj; koSave(); renderKO(); renderToday(); }
}
function setKO(id,field,val){
  if(!canEdit())return;
  const cur=KO[id]?Object.assign({},KO[id]):{gh:"",ga:"",ph:"",pa:""};
  cur[field]=val;
  const empty=(cur.gh===""||cur.gh==null)&&(cur.ga===""||cur.ga==null)&&(cur.ph===""||cur.ph==null)&&(cur.pa===""||cur.pa==null);
  writeKO(id,empty?null:cur);
}
function renderToday(){
  const wrap=document.getElementById("todaywrap"),list=document.getElementById("today-list"),title=document.getElementById("today-title");
  const prevBtn=document.getElementById("today-prev"),nextBtn=document.getElementById("today-next");
  if(!wrap)return;
  const days=matchDays();
  if(days.length===0){wrap.style.display="none";return;}
  const today=todayStr(),cur=activeDay(),idx=days.indexOf(cur);
  const day=bannerItems().filter(m=>m.d.slice(0,10)===cur).sort((a,b)=>a.d<b.d?-1:1);
  const dayLabel=day.length>0?day[0].day:cur;
  let label;
  if(cur===today) label="⚡ Hoy · "+dayLabel;
  else if(cur<today) label="📋 "+dayLabel;
  else label="📅 "+dayLabel;
  title.textContent=label;
  if(prevBtn)prevBtn.disabled=idx<=0;
  if(nextBtn)nextBtn.disabled=idx>=days.length-1;
  list.innerHTML=day.map(m=>{
    const center=m.score?`<span class="tscore">${m.score}</span>`:`<span class="tvs">vs</span>`;
    return `<div class="titem"><span class="ttime" style="color:${m.accent}">${m.hm}</span><span class="tdot" style="background:${m.accent}">${m.badge}</span><span class="tt home">${esc(m.n1)}</span>${center}<span class="tt away">${esc(m.n2)}</span></div>`;
  }).join("");
  wrap.style.display="block";
}

function setScore(g,h,a,field,val){
  if(!canEdit()) return;
  const key=mid(h,a);
  const cur=(DATA[g]&&DATA[g][key])?Object.assign({},DATA[g][key]):{home:h,gh:"",ga:""};
  cur.home=h;
  if(field==="gh")cur.gh=val; else cur.ga=val;
  if((cur.gh===""||cur.gh==null)&&(cur.ga===""||cur.ga==null)) writeMatch(g,key,null);
  else writeMatch(g,key,cur);
}
function applyInputs(){
  document.querySelectorAll("input[data-key]").forEach(inp=>{
    if(inp===document.activeElement)return;
    const g=inp.dataset.g,key=inp.dataset.key,f=inp.dataset.f;
    const r=(DATA[g]||{})[key];let v="";
    if(r){const home=r.home,h=+inp.dataset.h; if(f==="gh") v=(home===h)?r.gh:r.ga; else v=(home===h)?r.ga:r.gh;}
    inp.value=(v==null?"":v);
  });
}

function buildPanel(g){
  const ac=ACCENTS[g],rounds=schedule(GROUPS[g].length);
  let list=[];
  rounds.forEach(round=>round.forEach(([h,a])=>{
    const key=mid(h,a),info=TIMES[g]&&TIMES[g][key]?TIMES[g][key]:null;
    list.push({h,a,key,info});
  }));
  list.sort((x,y)=>{ if(x.info&&y.info) return x.info.d<y.info.d?-1:(x.info.d>y.info.d?1:0); if(x.info) return -1; if(y.info) return 1; return 0; });
  let fx="",lastDay=null;
  list.forEach(({h,a,key,info})=>{
    const day=info?info.day:"Sin horario";
    if(day!==lastDay){fx+=`<div class="jornada" style="color:${ac}">${day}</div>`;lastDay=day;}
    const hm=info?info.hm:"";
    fx+=`<div class="match"><div class="time">${hm}</div><div class="mrow"><span class="mt h">${esc(GROUPS[g][h])}</span><span class="score"><input type="number" min="0" inputmode="numeric" data-g="${g}" data-key="${key}" data-h="${h}" data-f="gh" onchange="setScore('${g}',${h},${a},'gh',this.value)"><span>-</span><input type="number" min="0" inputmode="numeric" data-g="${g}" data-key="${key}" data-h="${h}" data-f="ga" onchange="setScore('${g}',${h},${a},'ga',this.value)"></span><span class="mt a">${esc(GROUPS[g][a])}</span></div></div>`;
  });
  return `<div class="panel" id="p-${g}">
    <div class="card"><div class="card-h" style="background:${ac}"><span>Clasificación · Grupo ${g}</span><span style="font-size:12px;opacity:.9">${GROUPS[g].length} equipos</span></div>
      <table><thead><tr><th></th><th class="team">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead><tbody id="tb-${g}"></tbody></table>
    </div>
    <button class="btn-share-card btn-share-group" onclick="exportGroupCard('${g}')" style="display:none">📸 Descargar clasificación para RRSS</button>
    <div class="sec-title">Resultados · Grupo ${g}</div>
    <div class="card">${fx}</div>
  </div>`;
}
function init(){
  const tabs=document.getElementById("tabs"),panels=document.getElementById("panels");
  Object.keys(GROUPS).forEach(g=>{
    const b=document.createElement("button");b.className="tab";b.textContent=g;b.id="tab-"+g;b.onclick=()=>show(g);tabs.appendChild(b);
    panels.insertAdjacentHTML("beforeend",buildPanel(g));
  });
  show("A"); renderKO(); renderBracket(); renderToday(); initStorage(); setEditable();
}
function show(g){active=g;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.id==="tab-"+g));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id==="p-"+g));}
function resetAll(){
  if(ONLINE&&!isAdmin) return;
  const m=document.getElementById("resetModal"); if(m) m.style.display="flex";
}
function closeResetModal(){
  const m=document.getElementById("resetModal"); if(m) m.style.display="none";
}
function confirmReset(){
  closeResetModal();
  if(ONLINE){ dbRef.remove(); if(koRef) koRef.remove(); }
  else { DATA={}; KO={}; localSave(); koSave(); applyInputs(); renderAllStandings(); renderKO(); renderToday(); }
}
function exportData(){
  const blob=new Blob([JSON.stringify(DATA,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="resultados-soto-del-barco.json";a.click();
}
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredPrompt=e;var b=document.getElementById("installBtn");if(b)b.style.display="inline-block";});
window.addEventListener("appinstalled",function(){var b=document.getElementById("installBtn");if(b)b.style.display="none";});
function installApp(){
  if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;var b=document.getElementById("installBtn");if(b)b.style.display="none";return;}
  var m=document.getElementById("installModal"); if(m) m.style.display="flex";
}
function closeInstall(){ var m=document.getElementById("installModal"); if(m) m.style.display="none"; }
(function(){
  var standalone=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;
  var iOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(iOS&&!standalone){var b=document.getElementById("installBtn");if(b)b.style.display="inline-block";}
})();
function exportGroupCard(g){
  const st=standings(g),teams=GROUPS[g],qualify=QUALIFY[g],accent=ACCENTS[g];
  const W=1080,PAD=60,ROW=90,HROW=65,HDR=230,GRPK=85,FOOTER=90;
  const H=PAD+HDR+GRPK+HROW+st.length*ROW+FOOTER;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const c=cv.getContext("2d");
  // Fondo
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#0b3d24");bg.addColorStop(1,"#06301c");
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  // Cabecera
  c.textAlign="center";
  c.fillStyle="#fff";c.font="bold 54px 'Segoe UI',Arial,sans-serif";
  c.fillText("III TORNEO SOTO DEL BARCO",W/2,PAD+66);
  c.fillStyle="#c8f7d8";c.font="28px 'Segoe UI',Arial,sans-serif";
  c.fillText("Fútbol Sala",W/2,PAD+108);
  c.fillStyle="rgba(255,255,255,.2)";c.fillRect(PAD,PAD+128,W-PAD*2,1);
  // Título grupo
  const YG=PAD+HDR;
  c.fillStyle=accent;c.font="bold 42px 'Segoe UI',Arial,sans-serif";c.textAlign="center";
  c.fillText("CLASIFICACIÓN · GRUPO "+g,W/2,YG+56);
  // Cabecera tabla
  const YH=YG+GRPK;
  c.fillStyle="rgba(255,255,255,.1)";c.fillRect(PAD,YH,W-PAD*2,HROW);
  const cols={pos:90,team:145,pj:668,gf:748,gc:828,pts:938};
  c.fillStyle="rgba(255,255,255,.5)";c.font="bold 20px 'Segoe UI',Arial,sans-serif";
  c.textAlign="center";c.fillText("#",cols.pos,YH+HROW/2+7);
  c.textAlign="left";c.fillText("EQUIPO",cols.team,YH+HROW/2+7);
  c.textAlign="center";c.fillText("PJ",cols.pj,YH+HROW/2+7);
  c.fillText("GF",cols.gf,YH+HROW/2+7);c.fillText("GC",cols.gc,YH+HROW/2+7);
  c.fillStyle="#fff";c.font="bold 22px 'Segoe UI',Arial,sans-serif";
  c.fillText("PTS",cols.pts,YH+HROW/2+7);
  // Filas
  function rrect(x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
  function clamp(txt,maxW,sz){c.font=sz+"px 'Segoe UI',Arial,sans-serif";if(c.measureText(txt).width<=maxW)return txt;while(c.measureText(txt+"…").width>maxW&&txt.length>1)txt=txt.slice(0,-1);return txt+"…";}
  const YR=YH+HROW,MAXTEAM=cols.pj-cols.team-20;
  st.forEach(function(t,idx){
    const y=YR+idx*ROW,isQ=idx<qualify,cy=y+ROW/2+9;
    c.fillStyle=isQ?"rgba(22,163,74,.15)":"rgba(0,0,0,.12)";c.fillRect(PAD,y,W-PAD*2,ROW);
    if(idx>0){c.fillStyle="rgba(255,255,255,.07)";c.fillRect(PAD,y,W-PAD*2,1);}
    if(isQ){c.fillStyle=accent;c.fillRect(PAD,y,5,ROW);}
    // Posición
    c.fillStyle=isQ?accent:"rgba(255,255,255,.45)";c.font="bold 28px 'Segoe UI',Arial,sans-serif";c.textAlign="center";
    c.fillText(idx+1,cols.pos,cy);
    // Equipo
    const tn=clamp(teams[t.i],MAXTEAM,26);
    c.fillStyle=isQ?"#fff":"rgba(255,255,255,.6)";
    c.font=(isQ?"bold ":"")+"26px 'Segoe UI',Arial,sans-serif";c.textAlign="left";c.fillText(tn,cols.team,cy);
    // Estadísticas
    c.fillStyle=isQ?"rgba(255,255,255,.85)":"rgba(255,255,255,.45)";
    c.font="24px 'Segoe UI',Arial,sans-serif";c.textAlign="center";
    c.fillText(t.pj,cols.pj,cy);c.fillText(t.gf,cols.gf,cy);c.fillText(t.gc,cols.gc,cy);
    // Puntos
    c.fillStyle=isQ?"#fff":"rgba(255,255,255,.5)";c.font="bold 30px 'Segoe UI',Arial,sans-serif";
    c.fillText(t.pts,cols.pts,cy);
  });
  // Línea de corte de clasificación
  if(qualify<st.length){
    const qy=YR+qualify*ROW;
    c.strokeStyle=accent;c.lineWidth=2;c.setLineDash([6,4]);
    c.beginPath();c.moveTo(PAD,qy);c.lineTo(W-PAD,qy);c.stroke();c.setLineDash([]);
  }
  // Footer
  const fy=YR+st.length*ROW+14;
  c.fillStyle="rgba(255,255,255,.18)";c.fillRect(PAD,fy,W-PAD*2,1);
  c.fillStyle="#9fc4af";c.font="22px 'Segoe UI',Arial,sans-serif";c.textAlign="center";
  c.fillText("III Torneo Soto del Barco · 2026",W/2,fy+46);
  // Descargar
  const link=document.createElement("a");link.download="clasificacion-grupo-"+g+".png";link.href=cv.toDataURL("image/png");link.click();
}
function exportTodayCard(){
  const cur=activeDay();
  const items=bannerItems().filter(m=>m.d.slice(0,10)===cur).sort((a,b)=>a.d<b.d?-1:1);
  if(!items.length)return;
  const W=1080,PAD=60,ROW=140,HEADER=230,DATEK=80,FOOTER=90;
  const H=PAD+HEADER+DATEK+items.length*ROW+FOOTER;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const c=cv.getContext("2d");
  // Fondo
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#0b3d24");bg.addColorStop(1,"#06301c");
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  // Título
  c.textAlign="center";
  c.fillStyle="#fff";c.font="bold 54px 'Segoe UI',Arial,sans-serif";
  c.fillText("III TORNEO SOTO DEL BARCO",W/2,PAD+66);
  c.fillStyle="#c8f7d8";c.font="28px 'Segoe UI',Arial,sans-serif";
  c.fillText("Fútbol Sala",W/2,PAD+108);
  c.fillStyle="rgba(255,255,255,.2)";c.fillRect(PAD,PAD+128,W-PAD*2,1);
  // Fecha
  c.fillStyle="#fff";c.font="bold 40px 'Segoe UI',Arial,sans-serif";
  c.fillText((items[0].day||cur).toUpperCase(),W/2,PAD+HEADER-10);
  // Filas de partidos
  function rrect(x,y,w,h,r){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  }
  function clamp(txt,maxW,sz){
    c.font=sz+"px 'Segoe UI',Arial,sans-serif";
    if(c.measureText(txt).width<=maxW)return txt;
    while(c.measureText(txt+"…").width>maxW&&txt.length>1)txt=txt.slice(0,-1);
    return txt+"…";
  }
  const LEFT=162,SCOREW=112,TEAMW=(W-PAD*2-LEFT-SCOREW-20)/2;
  const Y0=PAD+HEADER+DATEK;
  items.forEach(function(m,i){
    const y=Y0+i*ROW+8,rh=ROW-16;
    c.fillStyle=i%2===0?"rgba(255,255,255,.07)":"rgba(0,0,0,.12)";
    rrect(PAD,y,W-PAD*2,rh,12);c.fill();
    // Franja de color
    c.fillStyle=m.accent;rrect(PAD,y,8,rh,4);c.fill();
    // Badge grupo
    const BW=38,bx=PAD+18,by=y+rh/2-BW/2;
    c.fillStyle=m.accent;rrect(bx,by,BW,BW,6);c.fill();
    c.fillStyle="#fff";c.font="bold 18px 'Segoe UI',Arial,sans-serif";
    c.textAlign="center";c.fillText(m.badge,bx+BW/2,by+BW/2+6);
    // Hora
    c.fillStyle="#c8f7d8";c.font="bold 28px 'Segoe UI',Arial,sans-serif";
    c.textAlign="left";c.fillText(m.hm,bx+BW+10,y+rh/2+9);
    // Equipo local
    const ht=clamp(m.n1,TEAMW,26);
    c.fillStyle="#fff";c.textAlign="right";c.fillText(ht,PAD+LEFT+TEAMW,y+rh/2+9);
    // Marcador o vs
    const sx=PAD+LEFT+TEAMW+10+SCOREW/2;
    c.textAlign="center";
    if(m.score){
      c.fillStyle="#fff";rrect(sx-SCOREW/2,y+rh/2-22,SCOREW,44,8);c.fill();
      c.fillStyle="#0a3320";c.font="bold 28px 'Segoe UI',Arial,sans-serif";c.fillText(m.score,sx,y+rh/2+10);
    }else{
      c.fillStyle="rgba(200,247,216,.7)";c.font="bold 22px 'Segoe UI',Arial,sans-serif";c.fillText("vs",sx,y+rh/2+8);
    }
    // Equipo visitante
    const at=clamp(m.n2,TEAMW,26);
    c.fillStyle="#fff";c.textAlign="left";c.fillText(at,sx+SCOREW/2+10,y+rh/2+9);
  });
  // Footer
  const fy=Y0+items.length*ROW+14;
  c.fillStyle="rgba(255,255,255,.18)";c.fillRect(PAD,fy,W-PAD*2,1);
  c.fillStyle="#9fc4af";c.font="22px 'Segoe UI',Arial,sans-serif";
  c.textAlign="center";c.fillText("III Torneo Soto del Barco · 2026",W/2,fy+46);
  // Descargar
  const link=document.createElement("a");
  link.download="partidos-"+cur+".png";link.href=cv.toDataURL("image/png");link.click();
}
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
(function(){
  var d=window.TORNEO_DATA;
  ACCENTS=d.accents;GROUPS=d.groups;QUALIFY=d.qualify;
  TIMES=d.times;BRACKET=d.bracket;PALMARES=d.palmares;
})();
if(window.firebase){init();}else{window.addEventListener('load',init);}
