/* ═══════════════════════════════════════════════════════════
   OSCA — main.js · галерея, навигация, анимации страницы
   ═══════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* ── 3D VIEWER INIT ── */
  window.addEventListener('load', function(){
    try{
      initViewer('stage-canvas', 'charName');
    }catch(e){
      var l=document.getElementById('stageLoading');
      if(l) l.innerHTML='<p style="color:#ff2e88">Не удалось запустить 3D (WebGL недоступен?)</p>';
      console.error('OSCA viewer init failed:', e);
    }
  });

  /* ── ГАЛЕРЕЯ ПЕРСОНАЖЕЙ ── */
  var grid = document.getElementById('charGrid');
  if(grid){
    OSCA.forEach(function(c, i){
      var card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id  = c.id;
      card.dataset.grad = i % OSCA_GRADS.length;
      card.innerHTML =
        '<div class="char-glow"></div>' +
        '<div class="char-active">● LIVE 3D</div>' +
        '<div class="char-emoji">' + c.emoji + '</div>' +
        '<div class="char-name">' + c.name + '</div>' +
        '<span class="char-tag">' + c.tag + '</span>' +
        '<div class="char-line" style="height:3px;width:70%;margin:14px auto 0;border-radius:99px;background:linear-gradient(90deg,' + OSCA_GRADS[i % OSCA_GRADS.length][0] + ',' + OSCA_GRADS[i % OSCA_GRADS.length][1] + ');box-shadow:0 0 12px ' + OSCA_GRADS[i % OSCA_GRADS.length][0] + '"></div>';
      card.addEventListener('click', function(){
        selectCharacter(c.id);
        markActive(card);
        var stage = document.getElementById('stage');
        if(stage) stage.scrollIntoView({ behavior:'smooth', block:'center' });
      });
      grid.appendChild(card);
      if(i===0) markActive(card);
    });
  }

  function markActive(card){
    var all = grid.querySelectorAll('.char-card');
    for(var i=0;i<all.length;i++) all[i].classList.remove('active');
    card.classList.add('active');
  }

  /* ── FAQ аккордеон ── */
  var faq = document.getElementById('faqList');
  if(faq){
    faq.addEventListener('click', function(e){
      var item = e.target.closest('.faq-item');
      if(!item) return;
      var wasOpen = item.classList.contains('open');
      Array.prototype.forEach.call(faq.querySelectorAll('.faq-item.open'), function(i){ i.classList.remove('open'); });
      if(!wasOpen) item.classList.add('open');
    });
  }

  /* ── reveal при скролле ── */
  var revealEls = document.querySelectorAll('.char-card, .feat-card, .price-card, .section-head, .faq-item');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold:0.12 });
    revealEls.forEach(function(el){ el.classList.add('reveal'); io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* ── навбар: тень при скролле ── */
  var nav = document.getElementById('nav');
  function scrolled(){ return (document.documentElement && document.documentElement.scrollTop) || (document.body && document.body.scrollTop) || 0; }
  window.addEventListener('scroll', function(){
    nav.classList.toggle('scrolled', scrolled() > 40);
  });

  /* ── мобильное меню ── */
  window.toggleMenu = function(){
    var m = document.querySelector('.mobile-menu');
    if(!m){ createMobileMenu(); return; }
    m.classList.toggle('open');
  };
  function createMobileMenu(){
    var m = document.createElement('div');
    m.className = 'mobile-menu';
    m.innerHTML =
      '<a href="#studio">Персонажи</a>' +
      '<a href="#features">Фичи</a>' +
      '<a href="#price">Тарифы</a>' +
      '<a href="#faq">FAQ</a>' +
      '<a href="#price" class="btn-primary">🛒 Купить</a>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e){ if(e.target.tagName==='A') m.classList.remove('open'); });
  }
}).call(this);