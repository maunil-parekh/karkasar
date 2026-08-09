// ============================================================
//  Karkasar — Pre-Registration Landing Page
//  Google Sheets (via Apps Script) Integration + UI Logic
// ============================================================

// Vercel Serverless API Proxy Endpoints (Zero secrets exposed to browser)
const SUBMIT_API_URL = "/api/submit";
const COUNT_API_URL = "/api/count";

// ─── DOM refs ─────────────────────────────────────────────────
const form = document.getElementById("preregForm");
const inputName = document.getElementById("inputName");
const inputEmail = document.getElementById("inputEmail");
const submitBtn = document.getElementById("submitBtn");
const successMessage = document.getElementById("successMessage");
const liveCount = document.getElementById("liveCount");
const navbar = document.getElementById("navbar");

// ─── CANVAS roundRect POLYFILL ────────────────────────────────
// Required for older browsers (pre-Chrome 99 / pre-Safari 15.4)
if (typeof CanvasRenderingContext2D !== "undefined" &&
  !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
  };
}

// ─── NAVBAR SCROLL EFFECT ─────────────────────────────────────
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 40);
});

// ─── SCROLL REVEAL ────────────────────────────────────────────
const revealEls = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target); // fire once only
      }
    });
  },
  { threshold: 0.12 }
);
revealEls.forEach(el => revealObserver.observe(el));

// ─── COUNT-UP ANIMATION ───────────────────────────────────────
function animateCountUp(el, target, duration = 1800) {
  if (!el) return;
  const startTime = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(easeOut(progress) * target);
    el.textContent = value.toLocaleString("en-IN");
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ─── MODULE-LEVEL COUNT TRACKER ──────────────────────────────
let fetchedCount = 312; // default matches the HTML placeholder

// ─── FETCH LIVE COUNT FROM API PROXY ─────────────────────────
async function fetchWaitlistCount() {
  try {
    const res = await fetch(COUNT_API_URL, { method: "GET" });
    const data = await res.json();
    if (data.success && data.count > 0) {
      // Add a small offset so page feels active from day one
      fetchedCount = data.count + 10;
      if (liveCount) liveCount.textContent = fetchedCount.toLocaleString("en-IN");
    }
  } catch (err) {
    console.warn("Count fetch failed:", err.message);
  }
}
fetchWaitlistCount();

// ─── EMAIL VALIDATION ─────────────────────────────────────────
// Mirrors isValidEmail() in the Apps Script exactly.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// ─── INLINE FIELD ERROR HELPERS ───────────────────────────────
/**
 * Show an error message beneath a field's parent .input-group.
 * Clears any previous error for that field first.
 */
function showFieldError(inputEl, message) {
  const group = inputEl.closest(".input-group");
  if (!group) return;
  // Remove existing error for this field
  group.querySelector(".field-error")?.remove();
  const p = document.createElement("p");
  p.className = "field-error";
  p.setAttribute("role", "alert");
  p.textContent = message;
  group.appendChild(p);
}

function clearFieldError(inputEl) {
  inputEl.closest(".input-group")?.querySelector(".field-error")?.remove();
}

// Clear errors as the user types / corrects their input
inputName.addEventListener("input", () => clearFieldError(inputName));
inputEmail.addEventListener("input", () => clearFieldError(inputEmail));

// ─── SHAKE ANIMATION (invalid field) ─────────────────────────
function shakeEl(el) {
  el.classList.add("error");
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-8px)" },
      { transform: "translateX(8px)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 400, easing: "ease-in-out" }
  );
  setTimeout(() => el.classList.remove("error"), 1500);
}

/**
 * Full frontend validation — mirrors every rule in the Apps Script doPost():
 *   name : non-empty, max 100 chars
 *   email: non-empty, valid format, max 254 chars
 * Returns true when all fields are valid.
 */
function validateForm(name, email) {
  let valid = true;

  // ── Name
  if (!name) {
    showFieldError(inputName, "Please enter your first name.");
    shakeEl(inputName);
    valid = false;
  } else if (name.length > 100) {
    showFieldError(inputName, "Name must be 100 characters or fewer.");
    shakeEl(inputName);
    valid = false;
  }

  // ── Email
  if (!email) {
    showFieldError(inputEmail, "Please enter your email address.");
    shakeEl(inputEmail);
    valid = false;
  } else if (email.length > 254) {
    showFieldError(inputEmail, "Email address is too long (max 254 characters).");
    shakeEl(inputEmail);
    valid = false;
  } else if (!isValidEmail(email)) {
    showFieldError(inputEmail, "Please enter a valid email address.");
    shakeEl(inputEmail);
    valid = false;
  }

  return valid;
}

// ─── CONFETTI ─────────────────────────────────────────────────
// Track whether confetti is currently running so resize doesn't kill it
let confettiRunning = false;

function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Only resize at launch time, not during animation (fix #5)
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  confettiRunning = true;

  const COLORS = ["#6c63ff", "#4ecdc4", "#ffd700", "#ff6584", "#fff"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * 200,
    r: Math.random() * 7 + 3,
    d: Math.random() * 120 + 60,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 10,
    speed: Math.random() * 3 + 1.5,
    opacity: Math.random() * 0.6 + 0.4,
  }));

  // Cache dimensions at start so resize mid-animation doesn't affect draw calls
  const W = canvas.width;
  const H = canvas.height;

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed;
      p.x += Math.sin(frame / p.d) * 1.5;
      p.tilt += 0.1;
      if (p.y > H) {
        p.y = -10;
        p.x = Math.random() * W;
      }
    });
    ctx.globalAlpha = 1;
    frame++;
    if (frame < 280) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, W, H);
      confettiRunning = false;
    }
  }
  draw();
}

// ─── SHOW SUCCESS ─────────────────────────────────────────────
function showSuccess(withConfetti) {
  if (form) form.style.display = "none";
  if (!successMessage) return;
  successMessage.classList.add("visible");

  // Only increment counter on a real new submit, not on a reload
  if (withConfetti) {
    const currentCount = parseInt(
      liveCount?.textContent?.replace(/[^0-9]/g, "") || String(fetchedCount)
    ) || fetchedCount;
    const newCount = currentCount + 1;
    fetchedCount = newCount; // keep module variable in sync
    if (liveCount) liveCount.textContent = newCount.toLocaleString("en-IN");
  }

  if (withConfetti) launchConfetti();
}

// ─── DOUBLE-SUBMIT GUARD ──────────────────────────────────────
let isSubmitting = false;

// ─── SUBMIT HANDLER ───────────────────────────────────────────
// Guard: if already submitted in this session, show success immediately
if (localStorage.getItem("ft_registered") === "1") {
  // Fix #1: defer until DOM is ready in case `defer` is ever removed
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => showSuccess(false));
  } else {
    showSuccess(false);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  const name = inputName.value.trim();
  const email = inputEmail.value.trim().toLowerCase();

  // ── Frontend validation (mirrors Apps Script server rules exactly)
  if (!validateForm(name, email)) return;

  // Loading state
  isSubmitting = true;
  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  try {
    // POST to Vercel API proxy → securely forwards to Google Apps Script
    const res = await fetch(SUBMIT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      throw new Error("Unable to reach server. Please check your connection.");
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Submission failed");
    }

    // Persist registration flag AND name to restore personalisation on reload (#6)
    localStorage.setItem("ft_registered", "1");
    localStorage.setItem("ft_name", name);

    // Show success
    showSuccess(true);

  } catch (err) {
    console.error("Submission failed:", err);
    // Re-enable button with error hint
    isSubmitting = false; // Fix #7: release guard on error so user can retry
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-text").textContent = "⚡ Try Again";

    // Remove any existing error note before adding a new one (prevents stacking)
    form.querySelector(".submit-error-note")?.remove();
    const errorNote = document.createElement("p");
    errorNote.className = "submit-error-note";
    errorNote.style.cssText = "color:#ff6584;font-size:0.82rem;text-align:center;margin-top:8px;";
    errorNote.textContent = "Something went wrong. Check your connection and try again.";
    form.appendChild(errorNote);
    setTimeout(() => errorNote.remove(), 5000);
  }
});

// ─── SMOOTH SCROLL for CTA links ──────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// ─── RESIZE: keep confetti canvas sized correctly ─────────────
window.addEventListener("resize", () => {
  const canvas = document.getElementById("confettiCanvas");
  if (canvas && !confettiRunning) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// ─── INSTAGRAM STORY CARD GENERATOR ───────────────────────────
async function generateStoryCard(userName) {
  const canvas = document.getElementById("storyCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Wait for Outfit to be fully available at every weight used on the card
  try {
    await Promise.all([
      document.fonts.load("400 46px 'Outfit'"),
      document.fonts.load("500 30px 'Outfit'"),
      document.fonts.load("600 46px 'Outfit'"),
      document.fonts.load("700 46px 'Outfit'"),
      document.fonts.load("800 110px 'Outfit'"),
    ]);
  } catch (_) {
    // Font load failed (e.g. offline) — continue with fallback font
    console.warn("Outfit font not available; story card will use fallback font.");
  }

  const W = 1080, H = 1920;

  // ── Background gradient (deep purple → dark)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0014");
  bg.addColorStop(0.4, "#16003a");
  bg.addColorStop(1, "#09090f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Glow orbs
  function drawOrb(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawOrb(200, 400, 380, "rgba(108,99,255,0.35)");
  drawOrb(900, 1500, 320, "rgba(78,204,163,0.25)");
  drawOrb(900, 300, 260, "rgba(255,101,132,0.18)");

  // ── Top pill badge (roundRect is polyfilled for old browsers — fix #4)
  const pillY = 280, pillW = 420, pillH = 72, pillX = (W - pillW) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 36);
  ctx.fillStyle = "rgba(108,99,255,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(108,99,255,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#b8b2ff";
  ctx.font = "500 30px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("💰  Now accepting early access", W / 2, pillY + 46);

  // ── Main headline
  ctx.textAlign = "center";
  ctx.font = "800 110px 'Outfit', sans-serif";

  // Gradient text helper
  function gradientText(text, y, grad) {
    const grd = ctx.createLinearGradient(W * 0.1, y, W * 0.9, y);
    grad.forEach(([stop, color]) => grd.addColorStop(stop, color));
    ctx.fillStyle = grd;
    ctx.fillText(text, W / 2, y);
  }

  ctx.fillStyle = "#f0f0ff";
  ctx.fillText("Stop Wondering", W / 2, 620);
  gradientText("Where Your", 760, [[0, "#6c63ff"], [1, "#4ecdc4"]]);
  ctx.fillStyle = "#f0f0ff";
  ctx.fillText("Money Went.", W / 2, 900);

  // ── Subtext
  ctx.font = "400 46px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(240,240,255,0.65)";
  const sub = "Karkasar predicts your cash flow & warns";
  const sub2 = "you before you go broke.";
  ctx.fillText(sub, W / 2, 1010);
  ctx.fillText(sub2, W / 2, 1068);

  // ── Card (glass panel)
  const cardX = 80, cardY = 1130, cardW = W - 160, cardH = 380;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 40);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Confetti dot rows inside card
  const dotColors = ["#6c63ff", "#4ecdc4", "#ffd700", "#ff6584"];
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(cardX + 60 + i * 115, cardY + 60, 8, 0, Math.PI * 2);
    ctx.fillStyle = dotColors[i % 4];
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Checkmark row inside card
  const perks = ["Free Premium at Launch", "Founding Member Badge", "Beta Access First"];
  perks.forEach((perk, i) => {
    const py = cardY + 130 + i * 90;
    // circle tick
    ctx.beginPath();
    ctx.arc(cardX + 70, py, 26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(78,204,163,0.18)";
    ctx.fill();
    ctx.font = "600 30px 'Outfit', sans-serif";
    ctx.fillStyle = "#4ecdc4";
    ctx.textAlign = "center";
    ctx.fillText("✓", cardX + 70, py + 10);
    ctx.font = "500 40px 'Outfit', sans-serif";
    ctx.fillStyle = "#f0f0ff";
    ctx.textAlign = "left";
    ctx.fillText(perk, cardX + 115, py + 14);
  });

  // ── User personalisation
  if (userName) {
    const displayName = userName.length > 22 ? userName.slice(0, 22).trimEnd() + "…" : userName;
    ctx.font = "600 46px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(240,240,255,0.55)";
    ctx.fillText(`${displayName} just joined the waitlist!`, W / 2, cardY + cardH + 80);
  }

  // ── CTA badge at bottom
  const ctaY = H - 200;
  const ctaGrad = ctx.createLinearGradient(W * 0.2, ctaY - 40, W * 0.8, ctaY + 40);
  ctaGrad.addColorStop(0, "#833ab4");
  ctaGrad.addColorStop(0.5, "#fd1d1d");
  ctaGrad.addColorStop(1, "#fcb045");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect((W - 600) / 2, ctaY - 55, 600, 110, 55);
  ctx.fillStyle = ctaGrad;
  ctx.fill();
  ctx.restore();

  ctx.font = "700 46px 'Outfit', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText("Join the waitlist", W / 2, ctaY + 16);

  // ── Brand watermark
  ctx.font = "500 34px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "center";
  ctx.fillText("💰 Karkasar", W / 2, H - 60);

  // ── Download
  const link = document.createElement("a");
  link.download = "karkasar-story.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── INSTA STORY BUTTON CLICK ─────────────────────────────────
document.addEventListener("click", (e) => {
  if (e.target.closest("#insta-story-btn")) {
    const name = localStorage.getItem("ft_name") || inputName?.value?.trim() || "";
    generateStoryCard(name);
    const hint = document.getElementById("insta-hint");
    if (hint) hint.style.display = "block";
  }
});
