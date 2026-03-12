/* ════════════════════════════════════════
   BIRTHDAY WEBSITE — script.js
   ════════════════════════════════════════ */

/* ── Stars ── */
(function spawnStars() {
  for (let i = 0; i < 90; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2.5 + 1;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}vw;
      top:${Math.random() * 70}vh;
      animation-duration:${Math.random() * 3 + 2}s;
      animation-delay:${Math.random() * 4}s;
    `;
    document.body.appendChild(s);
  }
})();

/* ── Sprinkles ── */
(function spawnSprinkles() {
  const cake = document.getElementById("cake");
  const colors = [
    "#FF6B8A",
    "#FFD166",
    "#06D6A0",
    "#74B9FF",
    "#A29BFE",
    "#FD79A8",
  ];
  for (let i = 0; i < 18; i++) {
    const sp = document.createElement("div");
    sp.className = "sprinkle";
    sp.style.cssText = `
      background:${colors[i % colors.length]};
      left:${8 + Math.random() * 80}%;
      top:${20 + Math.random() * 65}%;
      transform:rotate(${Math.random() * 160}deg);
    `;
    cake.appendChild(sp);
  }
})();

/* ── Element refs ── */
const dialogEl = document.getElementById("dialog");
const clickHint = document.getElementById("clickHint");
const tableEl = document.getElementById("table");
const cakeArea = document.getElementById("cakeArea");
const banner = document.getElementById("banner");
const messageEl = document.getElementById("message");
const replay = document.getElementById("replay");
const blowRing = document.getElementById("blowRing");
const blowFill = document.getElementById("blowFill");

/* ── Dialogs ── */
const dialogs = [
  "Hey Uncle! 👋",
  "I heard today is your special day! 🥳",
  "I've got a surprise ready for you…",
  "Could you pull that table over here? 🎂",
];

let step = 0;
let typing = false;

function typeText(text, onDone) {
  typing = true;
  clickHint.style.display = "none";
  dialogEl.innerHTML = "";
  let i = 0;
  const interval = setInterval(() => {
    dialogEl.innerHTML += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(interval);
      typing = false;
      if (onDone) {
        onDone();
      } else {
        clickHint.style.display = "block";
      }
    }
  }, 38);
}

window.addEventListener("load", () => {
  setTimeout(() => typeText(dialogs[step++]), 800);
});

document.body.addEventListener("click", (e) => {
  if (e.target.id === "replay" || e.target.closest("#banner")) return;
  if (typing) return;
  if (step < dialogs.length) {
    typeText(dialogs[step]);
    step++;
    if (step === dialogs.length) {
      setTimeout(() => {
        tableEl.style.right = window.innerWidth <= 640 ? "20px" : "60px";
      }, 600);
    }
  }
});

/* ── Table drag ── */
let dragging = false;
let cakeRevealed = false;

tableEl.addEventListener("mousedown", () => {
  dragging = true;
});
document.addEventListener("mouseup", () => {
  dragging = false;
});
document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  if (e.clientX < window.innerWidth * 0.55) revealCake();
});
tableEl.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches[0].clientX < window.innerWidth * 0.55) revealCake();
  },
  { passive: true },
);
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") revealCake();
});

function revealCake() {
  if (cakeRevealed) return;
  cakeRevealed = true;

  tableEl.style.transition =
    "left 0.8s cubic-bezier(.25,.46,.45,.94), right 0.8s ease";
  tableEl.style.left = "calc(50% - 140px)";
  tableEl.style.right = "auto";

  setTimeout(() => {
    cakeArea.style.display = "block";
    typeText("Make a wish… and blow out the candles! 🌬️✨");
    initMicAndListen(); // ← mic starts HERE, after table is pulled
  }, 500);
}

/* ════════════════════════════════════════
   MIC + BLOW DETECTION
   All mic work happens inside initMicAndListen().
   Nothing audio-related runs before the cake is revealed.
   ════════════════════════════════════════ */

const BLOW_THRESHOLD = 8; // very sensitive — light breath should trigger this
const REQUIRED_MS = 1500; // 2 seconds total blowing time
const TICK_MS = 80; // how often we sample
const GRACE_MS = 400; // if blowing stops briefly, wait this long before resetting

let celebrationDone = false;

function initMicAndListen() {
  if (celebrationDone) return;

  // getUserMedia + AudioContext MUST be called inside/after a user gesture.
  // revealCake() is triggered by a user action (drag/keydown), so we're safe here.
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const mic = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.4; // less smoothing = faster reaction to stops

      mic.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Show the blow progress bar
      blowRing.classList.add("visible");

      let accumulatedMs = 0; // total ms of blowing so far
      let lastBlowTime = null; // timestamp of last detected blow tick
      let graceTimer = null; // timeout before resetting on silence

      const ticker = setInterval(() => {
        if (celebrationDone) {
          clearInterval(ticker);
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        // Lower third of spectrum — blowing is richest there
        const lower = Math.floor(bufferLength / 3);
        let sum = 0;
        for (let i = 0; i < lower; i++) sum += dataArray[i];
        const avg = sum / lower;

        // DEBUG: uncomment to tune threshold in DevTools
        // console.log('blow avg:', avg.toFixed(1));

        if (avg > BLOW_THRESHOLD) {
          // Blowing detected — accumulate time
          if (lastBlowTime !== null) {
            accumulatedMs += Date.now() - lastBlowTime;
          }
          lastBlowTime = Date.now();

          // Cancel any pending grace reset
          if (graceTimer) {
            clearTimeout(graceTimer);
            graceTimer = null;
          }

          const progress = Math.min((accumulatedMs / REQUIRED_MS) * 100, 100);
          blowFill.style.width = progress + "%";

          if (accumulatedMs >= REQUIRED_MS) {
            clearInterval(ticker);
            stream.getTracks().forEach((t) => t.stop());
            blowRing.classList.remove("visible");
            blowFill.style.width = "0%";
            extinguishCandles();
          }
        } else {
          // No blow this tick — start grace period before resetting
          lastBlowTime = null;
          if (!graceTimer && accumulatedMs > 0) {
            graceTimer = setTimeout(() => {
              accumulatedMs = 0;
              blowFill.style.width = "0%";
              graceTimer = null;
            }, GRACE_MS);
          }
        }
      }, TICK_MS);
    })
    .catch((err) => {
      console.warn("Mic not available:", err);
      blowRing.classList.remove("visible");

      // Fallback — clicking candles blows them out
      const candlesEl = document.getElementById("candles");
      candlesEl.style.cursor = "pointer";
      candlesEl.title = "🌬️ Click to blow out the candles!";
      candlesEl.addEventListener("click", extinguishCandles, { once: true });

      // Also show a hint
      typeText("(No mic? Just click the candles to blow them out! 🌬️)");
    });
}

/* ── Extinguish candles → 1s pause → show banner ── */
function extinguishCandles() {
  if (celebrationDone) return;
  celebrationDone = true;

  blowRing.classList.remove("visible");

  document.querySelectorAll(".candle-wrap").forEach((wrap) => {
    const flame = wrap.querySelector(".flame");
    if (flame) {
      // Smoke puff
      const smoke = document.createElement("div");
      smoke.className = "smoke";
      wrap.appendChild(smoke);
      smoke.addEventListener("animationend", () => smoke.remove());
      flame.remove();
    }
    wrap.classList.add("extinguished");
  });

  // Wait exactly 1 second before showing the banner
  setTimeout(showBanner, 1000);
}

/* ── Birthday banner ── */
const messages = [
  "Wishing you a year full of laughter and joy! 🌟",
  "Hope today is as wonderful as you are! 🎊",
  "Another year wiser, cooler, and more legendary! 👑",
  "May this year bring you endless happiness! 🌈",
  "Sending you the biggest birthday hugs! 🤗💛",
  "May all your birthday wishes come true! ✨🎂",
];

function showBanner() {
  banner.classList.add("show");
  messageEl.innerText = messages[Math.floor(Math.random() * messages.length)];
  spawnConfetti();
  spawnBalloons();
}

/* ── Replay ── */
replay.addEventListener("click", () => {
  banner.classList.remove("show");

  // Relight candles
  document.querySelectorAll(".candle-wrap").forEach((wrap) => {
    wrap.classList.remove("extinguished");
    if (!wrap.querySelector(".flame")) {
      const flame = document.createElement("div");
      flame.className = "flame";
      wrap.insertBefore(flame, wrap.firstChild);
    }
  });

  document.querySelectorAll(".confetti, .balloon").forEach((el) => el.remove());

  celebrationDone = false;
  blowFill.style.width = "0%";

  // Slide table back, hide cake
  cakeRevealed = false;
  tableEl.style.transition = "right 0.8s ease, left 0.8s ease";
  tableEl.style.left = "auto";
  tableEl.style.right = window.innerWidth <= 640 ? "20px" : "60px";
  cakeArea.style.display = "none";

  typeText("Let's do it again! Pull the table back! 🎉");
});

/* ── Confetti ── */
function spawnConfetti() {
  const colors = [
    "#FFD166",
    "#FF6B8A",
    "#06D6A0",
    "#118AB2",
    "#A29BFE",
    "#FD79A8",
    "#FFEAA7",
    "#55EFC4",
  ];
  for (let i = 0; i < 110; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    const size = Math.random() * 8 + 5;
    const isCircle = Math.random() > 0.5;
    c.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${size}px;
      height:${isCircle ? size : size * 0.4}px;
      border-radius:${isCircle ? "50%" : "2px"};
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${Math.random() * 3 + 2.5}s;
      animation-delay:${Math.random() * 1.5}s;
    `;
    document.body.appendChild(c);
    c.addEventListener("animationend", () => c.remove());
  }
}

/* ── Balloons ── */
function spawnBalloons() {
  const emojis = ["🎈", "🎈", "🎉", "🎊", "🎈", "⭐", "🌟", "💛"];
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    b.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    b.style.cssText = `
      left:${Math.random() * 96}vw;
      bottom:-60px;
      animation-duration:${Math.random() * 5 + 6}s;
      animation-delay:${Math.random() * 2}s;
      font-size:${Math.random() * 22 + 28}px;
    `;
    document.body.appendChild(b);
    b.addEventListener("animationend", () => b.remove());
  }
}
