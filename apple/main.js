/* ============================================================
   main.js — interactions per Gemini's strict spec
   ============================================================ */
(() => {

  // ----------------------------------------------------------
  // 2C. Sticky sub-nav scroll state
  // ----------------------------------------------------------
  const subnav = document.getElementById('subnav');
  if (subnav) {
    const subnavTop = subnav.getBoundingClientRect().top + window.scrollY;
    const onScrollNav = () => {
      const stuck = window.scrollY >= subnavTop - 1;
      subnav.classList.toggle('is-stuck', stuck);
    };
    window.addEventListener('scroll', onScrollNav, { passive: true });
    onScrollNav();
  }

  // ----------------------------------------------------------
  // 4. Highlights carousel
  //    - Auto-advance every 4000ms while in viewport
  //    - Active-dot tracks scroll position
  //    - Play/Pause toggles interval + icon
  // ----------------------------------------------------------
  const carousel = document.getElementById('carousel');
  const dotsWrap = document.getElementById('carousel-dots');
  const pp = document.getElementById('carousel-playpause');
  const ppIcon = document.getElementById('carousel-pp-icon');

  if (carousel && dotsWrap && pp) {
    const dots = Array.from(dotsWrap.querySelectorAll('.carousel__dot'));
    const cards = Array.from(carousel.querySelectorAll('.carousel__card'));
    const total = cards.length;

    let interval = null;
    let inView = false;
    let isPlaying = true;

    const PAUSE_SVG = '<rect x="3" y="2" width="2" height="8" fill="currentColor"/><rect x="7" y="2" width="2" height="8" fill="currentColor"/>';
    const PLAY_SVG  = '<polygon points="3,2 9,6 3,10" fill="currentColor"/>';

    function goTo(i) {
      const idx = ((i % total) + total) % total;
      const card = cards[idx];
      if (!card) return;
      carousel.scrollTo({
        left: card.offsetLeft - (carousel.clientWidth - card.clientWidth) / 2,
        behavior: 'smooth'
      });
    }

    function activeIndexFromScroll() {
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      let bestIdx = 0;
      let bestDelta = Infinity;
      cards.forEach((c, i) => {
        const cardCenter = c.offsetLeft + c.clientWidth / 2;
        const d = Math.abs(cardCenter - center);
        if (d < bestDelta) { bestDelta = d; bestIdx = i; }
      });
      return bestIdx;
    }

    function updateDots() {
      const idx = activeIndexFromScroll();
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    }

    function nextSlide() {
      const idx = activeIndexFromScroll();
      goTo(idx + 1);
    }

    function startAuto() {
      if (interval) return;
      interval = setInterval(nextSlide, 4000);
    }
    function stopAuto() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    }

    carousel.addEventListener('scroll', updateDots, { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => {
      goTo(parseInt(d.dataset.i, 10));
    }));

    pp.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying && inView) { startAuto(); ppIcon.innerHTML = PAUSE_SVG; pp.setAttribute('aria-label', 'Pause'); }
      else { stopAuto(); ppIcon.innerHTML = PLAY_SVG; pp.setAttribute('aria-label', 'Play'); }
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        inView = e.isIntersecting;
        if (inView && isPlaying) startAuto();
        else stopAuto();
      });
    }, { threshold: 0.3 });
    io.observe(carousel);

    updateDots();
  }

  // ----------------------------------------------------------
  // 5. Compare modal
  // ----------------------------------------------------------
  const modal = document.getElementById('modal');
  const openBtn = document.getElementById('open-compare-modal');
  const closeBtn = document.getElementById('modal-close');

  function openModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ----------------------------------------------------------
  // 6. Accordion explorer — single-open + image swap
  // ----------------------------------------------------------
  const accControls = document.getElementById('explorer-controls');
  const accMedia = document.getElementById('explorer-media');
  if (accControls && accMedia) {
    const accs = Array.from(accControls.querySelectorAll('.acc'));
    const imgs = Array.from(accMedia.querySelectorAll('img'));
    accs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = btn.dataset.i;
        accs.forEach((b) => b.classList.toggle('is-active', b === btn));
        imgs.forEach((im) => im.classList.toggle('is-active', im.dataset.i === i));
      });
    });
  }

  // ----------------------------------------------------------
  // 7. Scroll-linked camera animation
  //    progress p ∈ [0,1] through 300vh track
  //    phone: translateY/rotate/scale interpolated
  //    text blocks: fade-up inside [from, to] sub-range
  // ----------------------------------------------------------
  const camScroll = document.getElementById('cam-scroll');
  const phone = document.getElementById('cam-scroll-phone');
  if (camScroll && phone) {
    const texts = Array.from(camScroll.querySelectorAll('.cam-scroll__text'));
    const lerp = (a, b, t) => a + (b - a) * t;

    let ticking = false;
    function update() {
      const rect = camScroll.getBoundingClientRect();
      const total = camScroll.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / total));

      // phone interpolation (matches spec 0.0 / 0.5 / 1.0 keyframes)
      let ty, rot, sc;
      if (p <= 0.5) {
        const t = p / 0.5;
        ty  = lerp(-10, 10, t);
        rot = lerp(0, -5, t);
        sc  = lerp(1, 1.05, t);
      } else {
        const t = (p - 0.5) / 0.5;
        ty  = lerp(10, 20, t);
        rot = lerp(-5, -10, t);
        sc  = lerp(1.05, 1.10, t);
      }
      phone.style.transform =
        `translateY(${ty}vh) rotate(${rot}deg) scale(${sc})`;

      // text reveals
      texts.forEach((el) => {
        const from = parseFloat(el.dataset.from);
        const to = parseFloat(el.dataset.to);
        el.classList.toggle('is-shown', p >= from && p <= 1);
      });

      ticking = false;
    }
    function onScrollCam() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScrollCam, { passive: true });
    window.addEventListener('resize', onScrollCam, { passive: true });
    update();
  }

  // ----------------------------------------------------------
  // 8. Smile camera demo — click swaps active button + video src
  // ----------------------------------------------------------
  const smileBtns = Array.from(document.querySelectorAll('.smile__btn'));
  const smileVid = document.getElementById('smile-video');
  smileBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.src;
      if (!src || !smileVid) return;
      smileBtns.forEach((b) => b.classList.toggle('is-selected', b === btn));
      smileVid.classList.add('is-hidden');
      setTimeout(() => {
        smileVid.src = src;
        smileVid.play().catch(() => {});
        smileVid.classList.remove('is-hidden');
      }, 200);
    });
  });

  // ----------------------------------------------------------
  // 9. Horizontal gallery — JS-driven translateX, not native scroll
  // ----------------------------------------------------------
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const track = gallery.querySelector('.gallery__track');
    const viewport = gallery.querySelector('.gallery__viewport');
    const prev = gallery.querySelector('.gallery__prev');
    const next = gallery.querySelector('.gallery__next');
    if (!track || !viewport || !prev || !next) return;

    let offset = 0;

    function maxOffset() {
      return Math.max(0, track.scrollWidth - viewport.clientWidth);
    }
    function step() {
      const firstCard = track.querySelector('.gallery__card');
      if (!firstCard) return 400;
      const gap = parseInt(getComputedStyle(track).columnGap || '24', 10);
      return firstCard.offsetWidth + gap;
    }
    function apply() {
      track.style.transform = `translateX(${-offset}px)`;
      prev.classList.toggle('is-disabled', offset <= 0);
      next.classList.toggle('is-disabled', offset >= maxOffset());
    }
    prev.addEventListener('click', () => {
      if (offset <= 0) return;
      offset = Math.max(0, offset - step());
      apply();
    });
    next.addEventListener('click', () => {
      const max = maxOffset();
      if (offset >= max) return;
      offset = Math.min(max, offset + step());
      apply();
    });
    window.addEventListener('resize', () => {
      offset = Math.min(offset, maxOffset());
      apply();
    });
    apply();
  });

  // ----------------------------------------------------------
  // 10. Performance dropdown — instant data swap
  // ----------------------------------------------------------
  const perfSelect = document.getElementById('perf-select');
  if (perfSelect) {
    const DATA = {
      '14pro': ['40% faster',  '2.2x faster', '8 more hours'],
      '15pro': ['50% faster',  '90% faster',  '5 more hours'],
      '16':    ['20% faster',  '30% faster',  '4 more hours'],
      '13':    ['80% faster',  '3x faster',   '12 more hours'],
    };
    const cells = Array.from(document.querySelectorAll('.js-metric-val'));
    perfSelect.addEventListener('change', () => {
      const arr = DATA[perfSelect.value] || [];
      cells.forEach((cell, i) => { cell.textContent = arr[i] || ''; });
    });
  }

  // ----------------------------------------------------------
  // 11. FAQ accordion — single-open
  // ----------------------------------------------------------
  const faqs = Array.from(document.querySelectorAll('.faq-item'));
  faqs.forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      faqs.forEach((other) => {
        other.classList.remove('is-open');
        const t = other.querySelector('.faq-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

})();
