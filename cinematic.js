/* =========================================================
   FIREFLY CAFÉ — cinematic.js (homepage only)
   Scroll-scrubbed scenes with GSAP + ScrollTrigger.
   If GSAP is missing or the visitor prefers reduced motion, nothing here
   runs and the static, stacked layout from cinematic.css is used.
   ========================================================= */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true }); // mobile URL-bar show/hide shouldn't re-layout
  document.documentElement.classList.add("cine-on");

  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => gsap.utils.toArray(s, root);

  /* Pin a scene for `screens` viewport-heights of scroll and scrub a timeline (0 → 1). */
  function pinScene(sel, screens, build) {
    const el = q(sel);
    if (!el) return;
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: () => "+=" + Math.round(window.innerHeight * screens),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    build(tl, el);
  }

  const mm = gsap.matchMedia();

  function buildAll(desktop) {
    /* ---- Scene 1: Hero — camera pushes in, text recedes ---- */
    if (q("#hero")) {
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true },
      })
        .to("#hero .media", { scale: 1.3, yPercent: 8, duration: 1 }, 0)
        .to(".hero-content", { yPercent: -28, autoAlpha: 0, duration: 0.65 }, 0)
        .to(".scroll-cue", { autoAlpha: 0, duration: 0.2 }, 0);
    }

    /* ---- Scene 2: Entering the café — wide room → closer, warmer view ---- */
    pinScene("#vibe", desktop ? 2.2 : 1.4, (tl) => {
      const a = q("#vibe [data-layer=a]"), b = q("#vibe [data-layer=b]");
      const steps = qa("#vibe .step");
      gsap.set(b, { opacity: 0 });
      gsap.set(steps[1], { autoAlpha: 0, y: 30 });
      tl.fromTo(a.firstElementChild, { scale: 1, xPercent: 0 }, { scale: desktop ? 1.6 : 1.4, xPercent: desktop ? -3 : 0, duration: 0.8 }, 0)
        .to(a, { opacity: 0, duration: 0.3 }, 0.5)
        .fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.5)
        .fromTo(b.firstElementChild, { scale: 1.05, rotationY: desktop ? 4 : 0 }, { scale: 1.35, rotationY: 0, duration: 0.5 }, 0.5)
        .to(steps[0], { autoAlpha: 0, y: -30, duration: 0.12 }, 0.32)
        .to(steps[1], { autoAlpha: 1, y: 0, duration: 0.14 }, 0.66);
    });

    /* ---- Scene 3: Food — framed dish opens to full bleed while the lens pushes in ---- */
    pinScene("#food", desktop ? 2 : 1.3, (tl) => {
      const frame = q("#food .food-frame"), img = frame.firstElementChild;
      const bg = q("#food .food-bg img"), step = q("#food .step");
      gsap.set(frame, { clipPath: desktop ? "inset(16% 12% 16% 12% round 28px)" : "inset(10% 6% 34% 6% round 20px)" });
      gsap.set(step, { autoAlpha: 0, y: 30 });
      tl.fromTo(bg, { scale: 1.15, yPercent: -3 }, { scale: 1.4, yPercent: 4, duration: 1 }, 0)
        .to(frame, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 0.5 }, 0)
        .fromTo(img, { scale: 1 }, { scale: 1.3, duration: 1 }, 0)
        .to(step, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.55);
    });

    /* ---- Scene 4: Drinks — lateral camera move (desktop) / slide-through (mobile) ---- */
    pinScene("#drinks", desktop ? 2 : 1.3, (tl) => {
      const panels = qa("#drinks .panel"), strip = q("#drinks .strip"), step = q("#drinks .step");
      gsap.set(step, { autoAlpha: 0, y: 30 });
      if (desktop) {
        tl.to(strip, { x: () => -(strip.scrollWidth - window.innerWidth), duration: 1 }, 0);
        panels.forEach((p) => tl.fromTo(p.firstElementChild, { xPercent: 6 }, { xPercent: -6, duration: 1 }, 0));
      } else {
        gsap.set(panels[1], { opacity: 0, xPercent: 15 });
        tl.to(panels[0].firstElementChild, { scale: 1.3, duration: 1 }, 0)
          .to(panels[1], { opacity: 1, xPercent: 0, duration: 0.4 }, 0.35)
          .fromTo(panels[1].firstElementChild, { scale: 1.3 }, { scale: 1.12, duration: 0.65 }, 0.35);
      }
      tl.to(step, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.15);
    });

    /* ---- Scene 5: People — camera pulls back to reveal the wider room ---- */
    pinScene("#people", desktop ? 2 : 1.3, (tl) => {
      const main = q("#people .people-main"), img = main.firstElementChild, step = q("#people .step");
      gsap.set(step, { autoAlpha: 0, y: 30 });
      tl.fromTo(main, { clipPath: "inset(0% 0% 0% 0% round 0px)" },
        { clipPath: desktop ? "inset(8% 29% 26% 29% round 24px)" : "inset(6% 5% 32% 5% round 20px)", duration: 0.7 }, 0)
        .fromTo(img, { scale: desktop ? 1.6 : 1.5 }, { scale: 1, duration: 0.9 }, 0);
      if (desktop) {
        tl.fromTo("#people .people-side.left", { xPercent: -70, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.6 }, 0.3)
          .fromTo("#people .people-side.right", { xPercent: 70, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.6 }, 0.3);
      }
      tl.to(step, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.65);
    });

    /* ---- About image: subtle parallax inside its existing frame ---- */
    qa("[data-parallax]").forEach((el) => {
      gsap.fromTo(el, { yPercent: -7, scale: 1.15 }, {
        yPercent: 7, ease: "none",
        scrollTrigger: { trigger: el.parentNode, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    /* ---- Scene 6: Finale — motion slows and settles ---- */
    if (q("#finale")) {
      gsap.fromTo("#finale .finale-bg img", { scale: 1.25 }, {
        scale: 1, ease: "power1.out",
        scrollTrigger: { trigger: "#finale", start: "top bottom", end: "center center", scrub: true },
      });
    }
  }

  mm.add("(min-width: 900px)", () => buildAll(true));
  mm.add("(max-width: 899px)", () => buildAll(false));

  // Pinned spacers change page height once media is in: re-measure, then
  // honour any #hash the visitor arrived with.
  window.addEventListener("load", () => {
    ScrollTrigger.refresh();
    if (location.hash) {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView();
    }
  });
})();
