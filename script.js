/* =========================================================
   FIREFLY CAFÉ — script.js
   Plain, readable JavaScript. No frameworks, no build step.
   ========================================================= */

/* ---------- 0. Easy-to-edit site configuration ---------- */
/* Change these values in one place as the real business details are confirmed. */
const FIREFLY_CONFIG = {
  whatsappNumber: "2348104266494", // no leading 0, no +, country code first
  whatsappMessage: "Hello Firefly Café, I'd like to place an order.",
  address: "Firefly Café, Awka, Anambra, Nigeria", // replace with confirmed street address
  mapsQuery: "Firefly Café, Awka, Anambra, Nigeria",
};

document.addEventListener("DOMContentLoaded", () => {
  initHeaderScroll();
  initMobileNav();
  initVideoComponents();
  initScrollReveal();
  initReservationForm();
  initWhatsAppLinks();
  initMapsLinks();
  initFooterYear();
  initTasteShowcase();

  // Background slideshows and the gallery grid are managed from the admin
  // (Gallery page). Wait briefly for them, then fall back to the images
  // already written in the HTML so the page never waits on the network.
  const ready = () => {
    initBackgroundSlideshows();
    initGalleryLightbox();
    initGalleryFilters();
  };
  Promise.race([
    loadManagedImages(),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).catch(() => {}).then(ready);
});

/* ---------- 0b. Managed images (Supabase "gallery" table) ----------
   Two separate switches in the admin decide where an image appears:
     show_in_slideshow -> background slideshows (every section)
     show_in_gallery   -> the Gallery grid only
   If a switch has no images, the HTML fallback images are used instead. */
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

async function loadManagedImages() {
  const db = window.supabaseClient;
  if (!db) return;
  const wantsBackgrounds = document.querySelector("[data-slideshow]");
  const wantsGrid = document.querySelector(".gallery-grid");
  if (!wantsBackgrounds && !wantsGrid) return;

  const [bg, grid] = await Promise.all([
    wantsBackgrounds
      ? db.from("gallery").select("image_url,caption").eq("show_in_slideshow", true).order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    wantsGrid
      ? db.from("gallery").select("image_url,caption,category").eq("show_in_gallery", true).order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const backgrounds = (bg.data || []).filter((r) => r.image_url);
  if (!bg.error && backgrounds.length) {
    document.querySelectorAll("[data-slideshow]").forEach((box, i) => {
      const overlay = box.querySelector(".slideshow-overlay");
      box.querySelectorAll("img").forEach((img) => img.remove());
      // start each section on a different image so they don't all match
      const start = i % backgrounds.length;
      const ordered = backgrounds.slice(start).concat(backgrounds.slice(0, start)).slice(0, 6);
      ordered.forEach((r) => {
        const img = document.createElement("img");
        img.src = r.image_url; img.alt = ""; img.loading = "lazy";
        box.insertBefore(img, overlay);
      });
    });
  }

  const items = (grid.data || []).filter((r) => r.image_url);
  const gridEl = document.querySelector(".gallery-grid");
  if (!grid.error && items.length && gridEl) {
    gridEl.innerHTML = items.map((r) => {
      const cap = r.caption ? escHtml(r.caption) : "";
      const cat = String(r.category || "").toLowerCase();
      return `<div class="gallery-item" data-category="${escHtml(cat)}" tabindex="0" role="button" aria-label="View ${cap || "image"}"><img src="${escHtml(r.image_url)}" alt="${cap || "Firefly Café gallery image"}" loading="lazy">${cap ? `<span class="gallery-caption">${cap}</span>` : ""}</div>`;
    }).join("");
  }
}

/* ---------- 1. Header: solid background after scrolling ---------- */
function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ---------- 2. Mobile hamburger menu ---------- */
function initMobileNav() {
  const toggle = document.querySelector(".hamburger");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });
}

/* ---------- 3. Reusable video component ----------
   Any element with [data-video] wraps a <video> + a mute button.
   Handles: autoplay-blocked fallback to poster, mute/unmute toggle,
   and pausing when scrolled out of view (saves battery/data). */
function initVideoComponents() {
  const wrappers = document.querySelectorAll("[data-video]");

  wrappers.forEach((wrapper) => {
    const video = wrapper.querySelector("video");
    const muteBtn = wrapper.querySelector(".mute-btn");
    if (!video) return;

    // If the source video fails to load (e.g. placeholder file not yet
    // added), fall back cleanly to the poster image instead of a broken box.
    video.addEventListener(
      "error",
      () => {
        wrapper.classList.add("video-failed");
        video.style.display = "none";
      },
      true
    );

    // Try to autoplay muted; if the browser blocks it, keep the poster
    // visible — never force sound or throw an unhandled error.
    if (video.hasAttribute("autoplay")) {
      const playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          wrapper.classList.add("video-paused");
        });
      }
    }

    if (muteBtn) {
      const setLabel = () => {
        const muted = video.muted;
        muteBtn.setAttribute(
          "aria-label",
          muted ? "Unmute video" : "Mute video"
        );
        muteBtn.setAttribute("aria-pressed", String(!muted));
        muteBtn.innerHTML = muted
          ? '<span aria-hidden="true">🔇</span><span>Unmute</span>'
          : '<span aria-hidden="true">🔊</span><span>Mute</span>';
      };
      setLabel();

      muteBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        // Unmuting requires the video to actually be playing.
        if (!video.muted && video.paused) {
          video.play().catch(() => {
            video.muted = true;
            setLabel();
          });
        }
        setLabel();
      });
    }

    // Pause videos once they scroll far out of view; resume when back.
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (video.hasAttribute("autoplay")) {
                video.play().catch(() => {});
              }
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.15 }
      );
      observer.observe(wrapper);
    }
  });
}

/* ---------- 4. Scroll reveal (fade + slide up) ---------- */
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---------- 5. Reservation form ----------
   Validates input, shows loading/success/error states, and is structured
   so the fetch() below can be pointed at Supabase later without
   restructuring the form. No credentials live in this file. */
function initReservationForm() {
  const form = document.querySelector("#reservation-form");
  if (!form) return;

  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  const rules = {
    name: (v) => v.trim().length >= 2 || "Enter your full name.",
    phone: (v) =>
      /^[0-9+()\s-]{7,15}$/.test(v.trim()) || "Enter a valid phone number.",
    date: (v) => v.trim().length > 0 || "Choose a date.",
    time: (v) => v.trim().length > 0 || "Choose a time.",
    guests: (v) =>
      (Number(v) >= 1 && Number(v) <= 20) || "1–20 guests only.",
  };

  function showFieldError(field, message) {
    const wrap = field.closest(".field");
    const errorEl = wrap.querySelector(".field-error");
    wrap.classList.toggle("has-error", Boolean(message));
    if (errorEl) errorEl.textContent = message || "";
  }

  function validate() {
    let valid = true;
    Object.entries(rules).forEach(([name, check]) => {
      const field = form.elements[name];
      if (!field) return;
      const result = check(field.value);
      if (result !== true) {
        showFieldError(field, result);
        valid = false;
      } else {
        showFieldError(field, "");
      }
    });
    return valid;
  }

  // Clear a field's error as the user fixes it.
  Object.keys(rules).forEach((name) => {
    const field = form.elements[name];
    if (field) field.addEventListener("input", () => showFieldError(field, ""));
  });

  function setStatus(kind, message) {
    status.className = "form-status is-visible " + kind;
    status.textContent = message;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validate()) {
      setStatus("error", "Please fix the highlighted fields and try again.");
      return;
    }

    const payload = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      date: form.elements.date.value,
      time: form.elements.time.value,
      guests: Number(form.elements.guests.value),
    };

    submitBtn.disabled = true;
    setStatus("loading", "Sending your reservation…");

    try {
      await sendReservationToSupabase(payload);

      setStatus(
        "success",
        `Thanks, ${payload.name.split(" ")[0]} — we've received your request for ${payload.guests} guest(s) on ${payload.date} at ${payload.time}. We'll confirm by phone shortly.`
      );
      form.reset();
    } catch (err) {
      console.error("Reservation error:", err);
      setStatus(
        "error",
        "We couldn't send your reservation. Please try again or WhatsApp us directly."
      );
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* Sends the reservation to Supabase. Column names match supabase-schema.sql:
   customer_name, phone, reservation_date, reservation_time, guests. */
async function sendReservationToSupabase(payload) {
  if (!window.supabaseClient) {
    throw new Error(
      "Supabase is not connected yet — add your project URL and publishable key in supabase-config.js."
    );
  }

  const { error } = await window.supabaseClient.from("reservations").insert([
    {
      customer_name: payload.name,
      phone: payload.phone,
      reservation_date: payload.date,
      reservation_time: payload.time,
      guests: payload.guests,
      status: "Pending",
    },
  ]);

  if (error) throw error;
}

/* ---------- 6. WhatsApp ordering links ---------- */
function initWhatsAppLinks() {
  const url =
    "https://wa.me/" +
    FIREFLY_CONFIG.whatsappNumber +
    "?text=" +
    encodeURIComponent(FIREFLY_CONFIG.whatsappMessage);

  document.querySelectorAll("[data-whatsapp-link]").forEach((el) => {
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  });
}

/* ---------- 7. Google Maps directions link ---------- */
function initMapsLinks() {
  const url =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(FIREFLY_CONFIG.mapsQuery);

  document.querySelectorAll("[data-maps-link]").forEach((el) => {
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  });

  document.querySelectorAll("[data-address]").forEach((el) => {
    el.textContent = FIREFLY_CONFIG.address;
  });
}

/* ---------- 8. Video gallery lightbox ---------- */
function initGalleryLightbox() {
  const lightbox = document.querySelector("#gallery-lightbox");
  if (!lightbox) return;
  const image = lightbox.querySelector(".lightbox-image");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  function open(item) {
    const source = item.querySelector("img");
    if (!source) return;
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || "Firefly Café gallery image";
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }
  function close() {
    lightbox.classList.remove("is-open");
    image.removeAttribute("src");
    document.body.style.overflow = "";
  }
  document.querySelectorAll(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => open(item));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(item); }
    });
  });
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lightbox.classList.contains("is-open")) close(); });
}

/* ---------- 9. Background image slideshows ----------
   Every slideshow crossfades automatically and loops forever. */
function initBackgroundSlideshows() {
  document.querySelectorAll("[data-slideshow]").forEach((slideshow) => {
    const slides = [...slideshow.querySelectorAll("img")];
    if (!slides.length) return;
    let index = 0;
    slides[0].classList.add("is-active");
    if (slides.length < 2) return;
    window.setInterval(() => {
      slides[index].classList.remove("is-active");
      index = (index + 1) % slides.length;
      slides[index].classList.add("is-active");
    }, 5000);
  });
}

/* ---------- 10. Gallery category filters ---------- */
function initGalleryFilters() {
  const tabs = document.querySelectorAll(".gallery-tab");
  const items = document.querySelectorAll(".gallery-item");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const category = tab.dataset.category;

      items.forEach((item) => {
        const match = category === "all" || item.dataset.category === category;
        item.style.display = match ? "" : "none";
      });
    });
  });
}

/* ---------- 10. Footer year ---------- */
function initFooterYear() {
  const el = document.querySelector("#footer-year");
  if (el) el.textContent = new Date().getFullYear();
}


/* ---------- 11. A Taste of Firefly (menu page) ----------
   Cards are only shortcuts: they scroll to, and briefly highlight, the real
   menu row whose id matches the card's href. No menu data is duplicated. */
function initTasteShowcase() {
  const track = document.querySelector("[data-taste-track]");
  if (!track) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hide any card whose menu item doesn't exist (keeps the showcase honest).
  const cards = [...track.querySelectorAll(".taste-card")].filter((card) => {
    const target = document.getElementById(card.getAttribute("href").slice(1));
    if (!target) card.remove();
    return Boolean(target);
  });
  if (!cards.length) { document.getElementById("taste")?.remove(); return; }

  // Click a card: scroll to the real menu row and highlight it.
  let highlightTimer;
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      const row = document.getElementById(card.getAttribute("href").slice(1));
      if (!row) return;
      row.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      document.querySelectorAll(".menu-name-row.is-highlighted").forEach((r) => r.classList.remove("is-highlighted"));
      clearTimeout(highlightTimer);
      window.setTimeout(() => row.classList.add("is-highlighted"), reduce ? 0 : 450);
      highlightTimer = window.setTimeout(() => row.classList.remove("is-highlighted"), 3200);
      history.replaceState(null, "", "#" + row.id);
    });
  });

  // Mouse drag-to-scroll (touch already swipes natively).
  let startX = 0, startLeft = 0, down = false, moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add("is-dragging"); }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    window.setTimeout(() => track.classList.remove("is-dragging"), 0);
  });

  // Desktop arrows.
  const prev = document.querySelector('.taste-arrow[data-dir="-1"]');
  const next = document.querySelector('.taste-arrow[data-dir="1"]');
  const step = () => (cards[0].offsetWidth + 20) * 1.5;
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
    // Hide arrows entirely when everything already fits.
    const nav = document.querySelector(".taste-nav");
    if (nav) nav.style.display = max <= 0 ? "none" : "";
  };
  [prev, next].forEach((btn) => btn && btn.addEventListener("click", () => {
    track.scrollBy({ left: Number(btn.dataset.dir) * step(), behavior: reduce ? "auto" : "smooth" });
  }));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();

  // Keyboard: arrow keys scroll the track when it has focus.
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      track.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * step(), behavior: reduce ? "auto" : "smooth" });
      e.preventDefault();
    }
  });
}


/* #########################################################
   CART (menu page + any page: hidden until items are added)
   ######################################################### */
;/* =========================================================
   FIREFLY CAFÉ — cart.js
   Step 2: cart state, floating cart button and cart drawer.
   The cart lives in the visitor's browser (localStorage) and is
   exposed as window.FireflyCart for the WhatsApp step to use.
   ========================================================= */
(function () {
  const KEY = "firefly-cart-v1";
  const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

  let lines = load(); // [{ id, name, price, qty }]

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((l) => l && l.id && l.qty > 0) : [];
    } catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) {} }

  const count = () => lines.reduce((s, l) => s + l.qty, 0);
  const total = () => lines.reduce((s, l) => s + l.qty * l.price, 0);

  function changed() {
    save();
    render();
    document.dispatchEvent(new CustomEvent("cart:change", { detail: { lines, count: count(), total: total() } }));
  }

  function add(item) {
    const line = lines.find((l) => l.id === item.id);
    if (line) line.qty = Math.min(line.qty + 1, 50);
    else lines.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    changed();
  }
  function setQty(id, qty) {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    line.qty = Math.min(qty, 50);
    if (line.qty <= 0) lines = lines.filter((l) => l.id !== id);
    changed();
  }
  function clear() { lines = []; changed(); }

  // Keep the cart honest against the live menu (removed items, changed prices).
  function reconcile(menuItems) {
    const live = new Map(menuItems.map((i) => [String(i.id), i]));
    const before = JSON.stringify(lines);
    lines = lines.filter((l) => live.has(String(l.id))).map((l) => {
      const i = live.get(String(l.id));
      return { ...l, name: i.name, price: Number(i.price) || 0 };
    });
    if (JSON.stringify(lines) !== before) changed(); else render();
  }

  /* ---------- UI (injected, so no page markup to maintain) ---------- */
  const bar = document.createElement("button");
  bar.type = "button";
  bar.className = "cart-bar";
  bar.hidden = true;
  bar.setAttribute("aria-haspopup", "dialog");

  const scrim = document.createElement("div");
  scrim.className = "cart-scrim";
  scrim.hidden = true;

  const drawer = document.createElement("aside");
  drawer.className = "cart-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "cart-title");
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="cart-head"><h2 id="cart-title">Your Order</h2><button type="button" class="cart-close" aria-label="Close cart">&times;</button></div>
    <div class="cart-lines" data-cart-lines></div>
    <div class="cart-foot">
      <div class="cart-total"><span>Total</span><strong data-cart-total></strong></div>
      <form class="checkout" data-checkout novalidate>
        <div class="field"><label for="co-name">Your name</label><input id="co-name" name="name" type="text" autocomplete="name" maxlength="60"><span class="field-error"></span></div>
        <fieldset class="co-type">
          <legend>How would you like to get your order?</legend>
          <label><input type="radio" name="type" value="Pickup" checked><span>Pickup</span></label>
          <label><input type="radio" name="type" value="Delivery"><span>Delivery</span></label>
        </fieldset>
        <div class="field" data-address-field hidden><label for="co-address">Delivery address <span class="co-opt">(optional, you can also share your location in the chat)</span></label><input id="co-address" name="address" type="text" autocomplete="street-address" maxlength="160"><span class="field-error"></span></div>
        <button type="submit" class="btn btn-primary">Order on WhatsApp</button>
        <p class="cart-note">This opens WhatsApp with your order ready to send. We'll confirm it with you there.</p>
      </form>
      <button type="button" class="cart-clear" data-cart-clear>Clear cart</button>
    </div>`;

  document.body.append(bar, scrim, drawer);
  const linesEl = drawer.querySelector("[data-cart-lines]");
  const totalEl = drawer.querySelector("[data-cart-total]");
  let lastFocus = null;

  function render() {
    const n = count();
    bar.hidden = n === 0;
    bar.innerHTML = `<span class="cart-bar-count">${n}</span><span>View order</span><strong>${naira(total())}</strong>`;
    bar.setAttribute("aria-label", `View order, ${n} item${n === 1 ? "" : "s"}, ${naira(total())}`);

    totalEl.textContent = naira(total());
    linesEl.innerHTML = lines.length
      ? lines.map((l) => `
        <div class="cart-line" data-id="${esc(l.id)}">
          <div class="cart-line-info"><strong>${esc(l.name)}</strong><span>${naira(l.price)} each</span></div>
          <div class="qty" role="group" aria-label="Quantity for ${esc(l.name)}">
            <button type="button" data-dec aria-label="Remove one ${esc(l.name)}">−</button>
            <span aria-live="polite">${l.qty}</span>
            <button type="button" data-inc aria-label="Add one ${esc(l.name)}">+</button>
          </div>
          <div class="cart-line-total">${naira(l.qty * l.price)}</div>
        </div>`).join("")
      : `<p class="cart-empty">Your cart is empty. Add something tasty from the menu.</p>`;
    drawer.querySelector(".cart-foot").hidden = lines.length === 0;
    if (!lines.length && !drawer.hidden) close();
  }

  function open() {
    lastFocus = document.activeElement;
    scrim.hidden = drawer.hidden = false;
    requestAnimationFrame(() => { scrim.classList.add("is-open"); drawer.classList.add("is-open"); });
    document.body.style.overflow = "hidden";
    drawer.querySelector(".cart-close").focus();
  }
  function close() {
    scrim.classList.remove("is-open"); drawer.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(() => { scrim.hidden = drawer.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  bar.addEventListener("click", open);
  scrim.addEventListener("click", close);
  drawer.querySelector(".cart-close").addEventListener("click", close);
  drawer.querySelector("[data-cart-clear]").addEventListener("click", clear);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) close(); });

  linesEl.addEventListener("click", (e) => {
    const row = e.target.closest(".cart-line");
    if (!row) return;
    const line = lines.find((l) => String(l.id) === row.dataset.id);
    if (!line) return;
    if (e.target.closest("[data-inc]")) setQty(line.id, line.qty + 1);
    if (e.target.closest("[data-dec]")) setQty(line.id, line.qty - 1);
  });

  // "Add to Cart" buttons on menu rows (rows are rendered by menu.js).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    const row = btn.closest(".menu-row");
    if (!row) return;
    add({ id: row.dataset.itemId, name: row.dataset.name, price: Number(row.dataset.price) || 0 });
    btn.classList.add("is-added");
    clearTimeout(btn._t);
    btn._t = setTimeout(() => btn.classList.remove("is-added"), 1200);
  });


  /* ---------- Step 3: hand the order to WhatsApp ---------- */
  const form = drawer.querySelector("[data-checkout]");
  const addrField = form.querySelector("[data-address-field]");
  const WA_NUMBER = (typeof FIREFLY_CONFIG !== "undefined" && FIREFLY_CONFIG.whatsappNumber) || "2348104266494";

  try { form.elements.name.value = localStorage.getItem("firefly-customer-name") || ""; } catch (e) {}

  form.addEventListener("change", (e) => {
    if (e.target.name === "type") addrField.hidden = form.elements.type.value !== "Delivery";
  });
  form.elements.name.addEventListener("input", () => setError(form.elements.name, ""));

  function setError(input, msg) {
    const wrap = input.closest(".field");
    wrap.classList.toggle("has-error", Boolean(msg));
    wrap.querySelector(".field-error").textContent = msg || "";
  }

  function buildMessage(name, type, address) {
    const rows = lines.map((l) => `${l.qty} × ${l.name} — ${naira(l.qty * l.price)}`);
    return [
      "Hello Firefly Café, I'd like to place an order.",
      "",
      `Name: ${name}`,
      `Order type: ${type}`,
      type === "Delivery" && address ? `Delivery address: ${address}` : null,
      "",
      "Order:",
      ...rows,
      "",
      `Total: ${naira(total())}`,
    ].filter((r) => r !== null).join("\n");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!lines.length) return;
    const name = form.elements.name.value.trim();
    if (name.length < 2) { setError(form.elements.name, "Please enter your name."); form.elements.name.focus(); return; }
    const type = form.elements.type.value;
    const address = form.elements.address.value.trim();

    try { localStorage.setItem("firefly-customer-name", name); } catch (err) {}
    const url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(buildMessage(name, type, address));
    // Opened straight from the tap so mobile browsers don't block it.
    const win = window.open(url, "_blank", "noopener");

    // The message is already built, so the cart can be emptied straight away.
    form.elements.address.value = "";
    form.elements.type.value = "Pickup";
    addrField.hidden = true;
    clear(); // also closes the drawer, since an empty cart has nothing to show

    if (!win) window.location.href = url;
  });

  window.FireflyCart = {
    reconcile, clear,
    getLines: () => lines.map((l) => ({ ...l })),
    getTotal: total, getCount: count,
    close,
    /* Step 3 plugs its "Order on WhatsApp" button in here. */
    get actionsEl() { return drawer.querySelector("[data-cart-actions]"); },
  };
  render();
})();


/* #########################################################
   LIVE MENU + "A TASTE OF FIREFLY" (runs only on menu.html)
   ######################################################### */
;/* =========================================================
   FIREFLY CAFÉ — menu.js
   Loads the live menu from Supabase and renders it on menu.html.
   Step 1: read-only menu. (Cart and WhatsApp ordering come next.)
   ========================================================= */
(function () {
  const list = document.getElementById("menu-list");
  const jump = document.getElementById("menu-jump");
  if (!list) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
  const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function showMessage(text) {
    list.innerHTML = `<p class="menu-status">${esc(text)}</p>`;
    if (jump) jump.innerHTML = "";
  }


  // Cards are only shortcuts to the real rows above/below; no prices, no cart here.
  function renderShowcase(photoItems, shownCats) {
    const catName = new Map(shownCats.map((c) => [c.id, c.name]));
    // Keep menu order (category order, then item order).
    const order = shownCats.map((c) => c.id);
    const cards = photoItems
      .filter((it) => catName.has(it.category_id))
      .sort((a, b) => order.indexOf(a.category_id) - order.indexOf(b.category_id) || a.display_order - b.display_order);
    if (!cards.length) return;

    list.insertAdjacentHTML("beforebegin", `
      <section class="taste" id="taste" aria-labelledby="taste-title">
        <div class="container taste-head">
          <div><h2 id="taste-title">A Taste of Firefly</h2><p>Take a look at some of what's waiting for you.</p></div>
          <div class="taste-nav" aria-hidden="true">
            <button type="button" class="taste-arrow" data-dir="-1" tabindex="-1" aria-label="Previous">←</button>
            <button type="button" class="taste-arrow" data-dir="1" tabindex="-1" aria-label="Next">→</button>
          </div>
        </div>
        <div class="taste-track" data-taste-track tabindex="0" role="region" aria-label="Featured dishes, scroll sideways">
          ${cards.map((it) => `
            <a class="taste-card" href="#item-${esc(it.id)}" draggable="false">
              <figure><img src="${esc(it.image_url)}" alt="${esc(it.name)}" width="900" height="1100" loading="lazy" draggable="false"></figure>
              <div class="taste-card-body"><h3>${esc(it.name)}</h3><p>${esc(it.description || catName.get(it.category_id))}</p><span class="taste-link">View on Menu →</span></div>
            </a>`).join("")}
        </div>
      </section>`);
    // Wire up scrolling, dragging and click-to-highlight (defined in script.js).
    if (typeof initTasteShowcase === "function") initTasteShowcase();
  }

  async function loadMenu() {
    const db = window.supabaseClient;
    if (!db) return showMessage("The menu isn't connected yet. Please check supabase-config.js.");

    const [cats, items] = await Promise.all([
      db.from("menu_categories").select("id,name,description,display_order").order("display_order", { ascending: true }),
      db.from("menu_items").select("id,category_id,name,price,description,display_order,image_url").order("display_order", { ascending: true }),
    ]);
    if (cats.error || items.error) {
      console.error(cats.error || items.error);
      return showMessage("We couldn't load the menu just now. Please refresh, or message us on WhatsApp.");
    }

    // Only show categories that have at least one available item.
    const byCat = new Map();
    (items.data || []).forEach((it) => {
      if (!byCat.has(it.category_id)) byCat.set(it.category_id, []);
      byCat.get(it.category_id).push(it);
    });
    const shown = (cats.data || []).filter((c) => (byCat.get(c.id) || []).length);
    if (!shown.length) return showMessage("The menu is being updated. Please check back shortly.");

    if (jump) jump.innerHTML = shown.map((c) => `<a href="#${slug(c.name)}">${esc(c.name)}</a>`).join("");

    list.innerHTML = shown.map((c) => `
      <section class="menu-category" id="${slug(c.name)}">
        <div class="menu-category-head"><h2>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ""}</div>
        <div class="menu-names">
          ${byCat.get(c.id).map((it) => `
            <div class="menu-row" id="item-${esc(it.id)}" data-item-id="${esc(it.id)}" data-name="${esc(it.name)}" data-price="${Number(it.price) || 0}">
              <div class="menu-row-info">
                <h3>${esc(it.name)}</h3>
                ${it.description ? `<p>${esc(it.description)}</p>` : ""}
              </div>
              <div class="menu-row-side"><span class="menu-price">${naira(it.price)}</span><button type="button" class="add-btn" data-add aria-label="Add ${esc(it.name)} to cart"><span class="add-full">Add to Cart</span><span class="add-short" aria-hidden="true">+ Add</span></button></div>
            </div>`).join("")}
        </div>
      </section>`).join("");

    // "A Taste of Firefly": every available item that has a photo (image_url).
    renderShowcase((items.data || []).filter((it) => it.image_url), shown);

    // Drop cart lines for items no longer available and refresh any changed prices.
    if (window.FireflyCart) window.FireflyCart.reconcile(items.data || []);

    // The list is built after page load, so honour a #category link now.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  loadMenu();
})();
