/* ═══════════════════════════════════════════════════════════
   OSCA — viewer.js · интерактивный 3D-просмотрщик (Three.js)
   Процедурно собирает уникального персонажа из примитивов,
   включает орбиту мыши, зум и авто-вращение.
   ═══════════════════════════════════════════════════════════ */

var VIEWER = { init:false, spin:true, particles:true, t:0,
  pitch:0.15, yaw:0, zoom:7, targetPitch:0.15, targetYaw:0, zoomTarget:7 };

/* ── материалы ────────────────────────────────────── */
function makeMaterial(theme, kind){
  var c = new THREE.Color(theme.skin);
  var m = new THREE.MeshStandardMaterial({ color:c });
  var type = theme.material || 'gloss';
  if(type==='metal'){ m.metalness=0.95; m.roughness=0.28; }
  else if(type==='gloss'){ m.metalness=0.55; m.roughness=0.18; }
  else if(type==='glass'){ m.transparent=true; m.opacity=0.72; }
  else if(type==='pearl'){ m.metalness=0.8; m.roughness=0.12; }
  else { m.metalness=0.1; m.roughness=0.9; }
  m.emissive = new THREE.Color(theme.accent).multiplyScalar(0.14);
  m.emissiveIntensity = 0.35;
  return m;
}
function glowMat(color){
  var m = new THREE.MeshStandardMaterial({ color:color });
  m.emissive = new THREE.Color(color);
  m.emissiveIntensity = 1.4;
  m.metalness = 0; m.roughness = 0.4;
  return m;
}
function darkMat(color){ return new THREE.MeshStandardMaterial({ color:color, metalness:0.1, roughness:0.9 }); }

var __scene, __renderer, __camera, __pivot, __charGroup, __particles=[], __groundRing;
var __currentChar = null, __charNameEl = null, __animateFn = null;
var __dragging = false, __spin = true, __showParticles = true, __lastPt = null;

/* ── генераторы примитивов ─────────────────────────── */
function g(geo, mat, x,y,z, rx,ry,rz, sx,sy,sz){
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x||0, y||0, z||0);
  if(rx||ry||rz) mesh.rotation.set(rx||0, ry||0, rz||0);
  if(sx||sy||sz) mesh.scale.set(sx||1, sy||1, sz||1);
  return mesh;
}
/* ═══════════ СБОРКА ПЕРСОНАЖА ══════════════════════ */
function buildOSCA(theme){
  var root = new THREE.Group();
  var M = new THREE.Group();
  root.add(M);

  var mat = makeMaterial(theme,'body');
  var dark = darkMat(0x111322);
  var glow = glowMat(theme.accent);
  var eyeM = glowMat(theme.eye);
  var darkAcc = darkMat(theme.secondary);

  /* ── ноги ── */
  var lLegP = new THREE.Group(); lLegP.position.set(-0.42,0.78,0);
  var rLegP = new THREE.Group(); rLegP.position.set( 0.42,0.78,0);
  var lLeg = g(new THREE.CylinderGeometry(0.22,0.26,0.8,16), mat);
  var rLeg = g(new THREE.CylinderGeometry(0.22,0.26,0.8,16), mat);
  var lFoot = g(new THREE.SphereGeometry(0.24,16,12), dark, 0,-0.15,0.13);
  var rFoot = g(new THREE.SphereGeometry(0.24,16,12), dark, 0,-0.15,0.13);
  lLegP.add(lLeg,lFoot); rLegP.add(rLeg,rFoot);

  /* ── туловище ── */
  var torso = g(new THREE.CylinderGeometry(0.76,0.88,1.55,20), mat);
  var chest = g(new THREE.SphereGeometry(0.5,20,16), dark, 0,0.4,0.46);
  var core = g(new THREE.SphereGeometry(0.3,20,16), glow, 0,0.42,0.62);
  torso.add(chest, core);

  /* ── руки ── */
  var lUp = new THREE.Group(); lUp.position.set(-0.86,1.15,0);
  var rUp = new THREE.Group(); rUp.position.set( 0.86,1.15,0);
  var lArm = g(new THREE.CylinderGeometry(0.2,0.24,0.85,14), mat, 0,-0.05,0, 0,0,0.12);
  var rArm = g(new THREE.CylinderGeometry(0.2,0.24,0.85,14), mat, 0,-0.05,0, 0,0,-0.12);
  lUp.add(lArm); rUp.add(rArm);
  var should = g(new THREE.SphereGeometry(0.34,14,10), mat, 0,0,0);
  var coreTop = g(new THREE.SphereGeometry(0.18,12,8), glow, 0,0.9,0.4);

  M.add(lUp, rUp, lLegP, rLegP, torso, should, coreTop);

  /* ── шея + голова ── */
  var neck = g(new THREE.CylinderGeometry(0.24,0.26,0.34,14), dark);
  var head = new THREE.Group(); head.position.y = 2.28;
  var skull = g(new THREE.SphereGeometry(0.78,26,18), mat);
  var face = g(new THREE.SphereGeometry(0.5,20,14), dark, 0,0.06,0.58);
  var eyeL = g(new THREE.SphereGeometry(0.13,12,8), eyeM, -0.26,0.16,0.72);
  var eyeR = g(new THREE.SphereGeometry(0.13,12,8), eyeM,  0.26,0.16,0.72);
  var brow = g(new THREE.BoxGeometry(0.24,0.05,0.04), glow, -0.26,0.34,0.66);
  var bror = g(new THREE.BoxGeometry(0.24,0.05,0.04), glow,  0.26,0.34,0.66);
  var mouth = g(new THREE.BoxGeometry(0.22,0.05,0.05), dark, 0,-0.08,0.6);
  var cheek = g(new THREE.SphereGeometry(0.07,8,6), glow, -0.42,0.0,0.7);
  var cheekR = g(new THREE.SphereGeometry(0.07,8,6), glow,  0.42,0.0,0.7);
  head.add(skull, face, eyeL, eyeR, brow, bror, mouth, cheek, cheekR);

  addHeadGear(theme, head, mat, glow, dark, darkAcc);
  addTail(theme, M, mat, glow);

  M.add(neck, head);
  root.add(M);
  return root;
}

/* ── хвост (кот/лис) ── */
function addTail(t, M, mat, glow){
  if(t.style==='cat'||t.style==='fox'){
    var stalk = g(new THREE.CylinderGeometry(0.14,0.2,0.7,10), mat, -0.6,0.55,0, 0,0,0.6);
    var tip = g(new THREE.SphereGeometry(0.24,12,8), glow, -0.6,0.42,0);
    M.add(stalk, tip);
  }
}

/* ═══════════ ДЕТАЛИ ГОЛОВЫ ═════════════════════════ */
function addHeadGear(t, head, mat, glow, dark){
  var s = t.style;
  if(s==='cat'){
    var eL = g(new THREE.ConeGeometry(0.2,0.5,4), mat, -0.3,0.75,-0.05);
    var eR = g(new THREE.ConeGeometry(0.2,0.5,4), mat,  0.3,0.75,-0.05);
    var iL = g(new THREE.ConeGeometry(0.1,0.28,4), glow, -0.3,0.78,-0.04);
    var iR = g(new THREE.ConeGeometry(0.1,0.28,4), glow,  0.3,0.78,-0.04);
    head.add(eL,eR,iL,iR);
  }
  if(s==='antenna' || s==='antena' || t.id==='glitch-bone'){
    var a1 = g(new THREE.CylinderGeometry(0.05,0.05,0.5,8), dark, -0.25,0.9,0);
    var a2 = g(new THREE.CylinderGeometry(0.05,0.05,0.5,8), dark,  0.25,0.9,0);
    var b1 = g(new THREE.SphereGeometry(0.14,10,8), glow, -0.25,1.15,0);
    var b2 = g(new THREE.SphereGeometry(0.14,10,8), glow,  0.25,1.15,0);
    head.add(a1,a2,b1,b2);
  }
  if(s==='halo'){
    var halo = g(new THREE.TorusGeometry(0.42,0.06,10,22), glow, 0,1.28,-0.1, 0.6,0,0);
    head.add(halo);
  }
  if(s==='hat'){
    var brim = g(new THREE.CylinderGeometry(0.55,0.62,0.12,18), dark, 0,0.78,0);
    var rim = g(new THREE.TorusGeometry(0.62,0.05,8,22), glow, 0,0.82,0);
    var crown = g(new THREE.CylinderGeometry(0.28,0.32,0.9,16), dark, 0,1.3,0);
    var tip = g(new THREE.ConeGeometry(0.24,0.5,12), glow, 0,1.85,0);
    var band = g(new THREE.CylinderGeometry(0.3,0.3,0.12,16), glow, 0,1.12,0);
    head.add(brim,rim,crown,tip,band);
  }
  if(s==='fox'){
    var f1 = g(new THREE.ConeGeometry(0.26,0.7,4), mat, -0.32,0.78,-0.28);
    var f2 = g(new THREE.ConeGeometry(0.26,0.7,4), mat,  0.32,0.78,-0.28);
    var fi1 = g(new THREE.ConeGeometry(0.12,0.4,4), glow, -0.32,0.82,-0.22);
    var fi2 = g(new THREE.ConeGeometry(0.12,0.4,4), glow,  0.32,0.82,-0.22);
    head.add(f1,f2,fi1,fi2);
  }
  if(t.id==='angel-halo0'){
    for(var s2=-1;s2<=1;s2+=2){
      var wing = new THREE.Group();
      for(var k=0;k<4;k++){
        var wg = g(new THREE.SphereGeometry(0.5-k*0.08,10,8),
          (k%2===0? mat : glow), s2*0.88, 0.9+k*0.12, (k%2===0?0.15:-0.22));
        wing.add(wg);
      }
      head.add(wing);
    }
  }
  if(t.id==='mech-x'){
    var v1 = g(new THREE.BoxGeometry(0.22,0.35,0.1), glow, -0.78,0.9,0.45);
    var v2 = g(new THREE.BoxGeometry(0.22,0.35,0.1), glow,  0.78,0.9,0.45);
    head.add(v1,v2);
  }
  if(s==='cat' || s==='fox'){
    var whiskL = g(new THREE.CylinderGeometry(0.02,0.02,0.3,4), glow, -0.42,0.2,0.55, 0,0,0.4);
    var whiskR = g(new THREE.CylinderGeometry(0.02,0.02,0.3,4), glow,  0.42,0.2,0.55, 0,0,-0.4);
    head.add(whiskL, whiskR);
  }
}

/* ═══════════ СЦЕНА / СВЕТ / ПЬЕДЕСТАЛ ═══════════════ */
function buildStage(){
  __scene = new THREE.Scene();

  var bgMat = new THREE.MeshBasicMaterial({ color:0x07060f, transparent:true, opacity:0.0 });
  var ambient = new THREE.AmbientLight(0x30364d);

  var key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4,6,6);
  var rim = new THREE.DirectionalLight(0x7c5cff, 1.6);
  rim.position.set(-5,4,-5);
  var glowL = new THREE.PointLight(0x00f0ff, 1.4, 18);
  glowL.position.set(3,2,4);
  var glowR = new THREE.PointLight(0xff2e88, 1.1, 18);
  glowR.position.set(-3,3,-4);

  __scene.add(ambient, key, rim, glowL, glowR);

  /* пьедестал-кольцо */
  var ringMat = glowMat(0x00f0ff);
  __groundRing = new THREE.Mesh(new THREE.TorusGeometry(1.7,0.05,12,60), ringMat);
  __groundRing.rotation.x = Math.PI/2;
  __groundRing.position.y = 0.02;
  var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.4,0.02,10,50),
    new THREE.MeshStandardMaterial({ color:0x7c5cff, emissive:new THREE.Color(0x7c5cff), emissiveIntensity:2 }));
  ring2.rotation.x = Math.PI/2;
  ring2.position.y = 0.02;
  __scene.add(__groundRing, ring2);

  /* частицы-орбитали */
  __particles = [];
  for(var i=0;i<22;i++){
    var pm = new THREE.MeshStandardMaterial({ color: (i%2? 0x00f0ff:0xff2e88) });
    pm.emissive = new THREE.Color(i%2?0x00f0ff:0xff2e88);
    pm.emissiveIntensity = 1.2;
    var p = new THREE.Mesh(new THREE.SphereGeometry(0.05+Math.random()*0.05,8,6), pm);
    var a = (i/22)*Math.PI*2;
    p.position.set(Math.cos(a)*(1.7+Math.random()*0.6), Math.random()*3.2+0.2, Math.sin(a)*(1.7+Math.random()*0.6));
    __scene.add(p);
    __particles.push({ mesh:p, speed:0.5+Math.random()*0.9, rad: 1.7+Math.random()*0.7, h: p.position.y, a:a });
  }

  /* капсула-чена размещается отдельно, pivot для орбиты */
  __pivot = new THREE.Group();
  __scene.add(__pivot);

  return __scene;
}

/* ═══════════ ВЫБОР/СМЕНА ПЕРСОНАЖА ═════════════════ */
function selectCharacter(id){
  var t = null;
  for(var i=0;i<OSCA.length;i++){ if(OSCA[i].id===id){ t=OSCA[i]; break; } }
  if(!t) return;
  if(__charNameEl) __charNameEl.textContent = t.name;
  if(__currentChar){ __pivot.remove(__currentChar); }
  __currentChar = buildOSCA(t);
  __currentChar.position.y = 0;       // стопы стоят на пьедестале
  __pivot.add(__currentChar);
  /* перекраска колец под акцент */
  __groundRing.material.color.set(t.accent);
  __groundRing.material.emissive.set(t.accent);
  __groundRing.material.emissiveIntensity = 1.3;
  __animateFn = t;
}

/* ═══════════════ АНИМАЦИЯ ══════════════════════════ */
function animateLoop(){
  VIEWER.t += 0.016;
  var tt = VIEWER.t;

  /* авто-вращение */
  if(__spin) VIEWER.targetYaw += 0.006;

  /* плавная интерполяция камеры */
  VIEWER.yaw   += (VIEWER.targetYaw  - VIEWER.yaw)   * 0.12;
  VIEWER.pitch += (VIEWER.targetPitch- VIEWER.pitch) * 0.12;
  VIEWER.zoom  += (VIEWER.zoomTarget - VIEWER.zoom)   * 0.1;

  var p = VIEWER.pitch, y = VIEWER.yaw, z = VIEWER.zoom;
  var cy = Math.cos(y), sy = Math.sin(y);
  var cp = Math.cos(p), sp = Math.sin(p);
  var camX = z*cy*cp, camY = 1.7 + z*sp, camZ = z*sy*cp;
  __camera.position.set(camX, camY, camZ);
  __camera.lookAt(0,1.7,0);

  if(__currentChar){
    var b = Math.sin(tt*1.4)*0.07;
    __currentChar.position.y = Math.abs(b)*0.6 + 0.01;   // лёгкое парение над кольцом
    __currentChar.rotation.y = y*0.25;
    __currentChar.rotation.z = Math.sin(tt*1.1)*0.06; // наклон корпуса
    __currentChar.rotation.x = Math.sin(tt*1.5)*0.05;
  }

  /* частицы */
  if(__showParticles){
    for(var i=0;i<__particles.length;i++){
      var q = __particles[i];
      q.a += q.speed*0.016;
      q.mesh.position.x = Math.cos(q.a)*q.rad;
      q.mesh.position.z = Math.sin(q.a)*q.rad;
      q.mesh.position.y = q.h + Math.sin(tt*1.2+i)*0.18;
    }
    __groundRing.rotation.z = tt*0.4;
  }

  if(__animateFn && __animateFn.onUpdate) __animateFn.onUpdate(tt);
}

/* ═══════════ ИНИЦИАЛИЗАЦИЯ VIEWER ══════════════════ */
function initViewer(containerId, charNameElId){
  var out = document.getElementById(containerId);
  if(!out || VIEWER.init) return;
  VIEWER.init = true;
  __charNameEl = document.getElementById(charNameElId);

  __renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  __renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  __renderer.setClearColor(0x000000, 0);
  out.appendChild(__renderer.domElement);

  __camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  buildStage();
  selectCharacter(OSCA[0].id);

  /* размеры под контейнер */
  function size(){
    var r = out.getBoundingClientRect();
    __renderer.setSize(r.width, r.height);
    __camera.aspect = r.width / Math.max(r.height,1);
    __camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  /* ── орбита мышью ── */
  function localXY(e){
    var r = out.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  out.addEventListener('pointerdown', function(e){
    __dragging = true; __lastPt = localXY(e);
    out.setPointerCapture && out.setPointerCapture(e.pointerId);
  });
  out.addEventListener('pointermove', function(e){
    if(!__dragging || !__lastPt) return;
    var p = localXY(e);
    var dx = p.x - __lastPt.x, dy = p.y - __lastPt.y;
    __lastPt = p;
    VIEWER.targetYaw   += dx * 0.008;
    VIEWER.targetPitch += dy * 0.006;
    VIEWER.targetPitch = Math.max(-1.2, Math.min(1.2, VIEWER.targetPitch));
    __spin = false;                       // ручная орбита отключает авто-вращение
    __spinBtn && __spinBtn.classList.remove('on');
  });
  function endDrag(){ __dragging = false; __lastPt = null; }
  out.addEventListener('pointerup', endDrag);
  out.addEventListener('pointerleave', endDrag);

  /* ── зум колесом ── */
  out.addEventListener('wheel', function(e){
    e.preventDefault();
    VIEWER.zoomTarget = Math.max(3.5, Math.min(11, VIEWER.zoomTarget + e.deltaY * 0.01));
  }, { passive:false });

  /* ── тач-зум ── */
  var pinch = 0;
  out.addEventListener('touchstart', function(e){ if(e.touches.length===2){ pinch = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); } }, { passive:true });
  out.addEventListener('touchmove', function(e){
    if(e.touches.length===2){
      var d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      if(pinch){ VIEWER.zoomTarget = Math.max(3.5, Math.min(11, VIEWER.zoomTarget + (pinch-d)*0.02)); }
      pinch = d;
    }
  }, { passive:true });

  var loop = function(){
    animateLoop();
    __renderer.render(__scene, __camera);
    requestAnimationFrame(loop);
  };
  loop();

  var loading = document.getElementById('stageLoading');
  if(loading){ setTimeout(function(){ loading.style.opacity='0'; loading.style.pointerEvents='none'; }, 600); }
}

/* ═══════════ КНОПКИ УПРАВЛЕНИЯ ═══════════════════════ */
var __loading = true, __spinBtn = null;
function toggleSpin(){
  __spin = !__spin;
  if(!__spinBtn) __spinBtn = document.querySelector('.viewer-buttons button:nth-child(2)');
  if(__spinBtn){
    __spinBtn.classList.toggle('on');
    __spinBtn.style.background = __spin ? 'rgba(0,240,255,.35)' : '';
  }
}
function resetCam(){
  VIEWER.targetYaw   = 0.0;
  VIEWER.targetPitch = 0.15;
  VIEWER.zoomTarget  = 7;
  __spin = true;
  if(__spinBtn){ __spinBtn.classList.add('on'); __spinBtn.style.background = 'rgba(0,240,255,.35)'; }
}
function toggleParticles(){
  __showParticles = !__showParticles;
  for(var i=0;i<__particles.length;i++){ __particles[i].mesh.visible = __showParticles; }
  __groundRing.visible = __showParticles;
}