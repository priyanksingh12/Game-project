const play = document.getElementById("playfield");
const startBtn = document.getElementById("start");
const nextBtn = document.getElementById("next");
const resetBtn = document.getElementById("reset");
const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const msg = document.getElementById("message");

let level = 1,
  score = 0,
  lives = 3;
let gameLoopId = null,
  alienTimer = null;
let aliens = [],
  bullets = new Set(),
  enemyShots = new Set(),
  playerShot = null;
let running = false;
const PF_W = () => play.clientWidth,
  PF_H = () => play.clientHeight;

const LEVELS = {
  1: { rows: 3, cols: 7, alienSpeed: 0.6, shotRate: 0.02 },
  2: { rows: 4, cols: 8, alienSpeed: 0.9, shotRate: 0.04 },
  3: { rows: 5, cols: 9, alienSpeed: 1.4, shotRate: 0.07 },
};

const player = document.createElement("div");
player.className = "player";
player.style.left = "50%";
player.textContent = "▲";
play.appendChild(player);
let px = PF_W() / 2,
  pV = 6;

function updateHUD() {
  levelEl.textContent = level;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
}
function clearField() {
  aliens.forEach((a) => {
    if (a.el && a.el.remove) a.el.remove();
  });
  aliens = [];
  bullets.forEach((b) => {
    if (b && b.remove) b.remove();
  });
  bullets.clear();
  enemyShots.forEach((e) => {
    if (e.el && e.el.remove) e.el.remove();
  });
  enemyShots.clear();
  if (playerShot) {
    if (playerShot.remove) playerShot.remove();
    playerShot = null;
  }
}
function placePlayerCenter() {
  px = PF_W() / 2;
  player.style.left = px - player.clientWidth / 2 + "px";
}

function spawnAliens() {
  const cfg = LEVELS[level];
  const gapX = 12,
    gapY = 12;
  const startX = 60,
    startY = 40;
  const temp = document.createElement("div");
  temp.className = "alien";
  temp.style.visibility = "hidden";
  play.appendChild(temp);
  const aW = temp.clientWidth || 44; //nullish coalescing operator (??) to avoid this problem
  const aH = temp.clientHeight || 32;
  temp.remove();

  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const aEl = document.createElement("div");
      aEl.className = "alien";
      aEl.dataset.row = r;
      aEl.dataset.col = c;
      const x = startX + c * (aW + gapX);
      const y = startY + r * (aH + gapY);
      aEl.style.left = x + "px";
      aEl.style.top = y + "px";
      aEl.textContent = "♦";
      play.appendChild(aEl);
      aliens.push({ el: aEl, baseX: x, y: y, alive: true });
    }
  }
}

let alienDir = 1;
let alienOffset = 0;

function aliveAliens() {
  return aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
}

function updateAliens(dt) {
  if (!running) return;
  const alive = aliens.filter((a) => a.alive);
  if (alive.length === 0) return;
  const cfg = LEVELS[level];
  const speed = cfg.alienSpeed * dt * 0.06;
  const xs = alive.map((a) => a.baseX + alienOffset);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs.map((x, i) => x + alive[i].el.clientWidth));
  if (minX < 8 && alienDir === -1) {
    alienDir = 1;
    alive.forEach((a) => (a.y += 24));
  }
  if (maxX > PF_W() - 8 && alienDir === 1) {
    alienDir = -1;
    alive.forEach((a) => (a.y += 24));
  }
  alienOffset += alienDir * speed;
  for (let a of aliens) {
    if (!a.alive) continue;
    a.el.style.left = a.baseX + alienOffset + "px";
    a.el.style.top = a.y + "px";
    if (a.y + a.el.clientHeight >= PF_H() - 140) {
      endGame(false);
      return;
    }
  }
}

function firePlayer() {
  if (!running) return;
  if (playerShot) return;
  const b = document.createElement("div");
  b.className = "bullet";
  const bx = px - 3;
  const by = PF_H() - 56;
  b.style.left = bx + "px";
  b.style.top = by + "px";
  play.appendChild(b);
  playerShot = b;
  bullets.add(b);
}

function updateBullets(dt) {
  if (!running) return;

  if (playerShot) {
    const speed = 0.9 * dt;
    const top = parseFloat(playerShot.style.top) - speed;
    playerShot.style.top = top + "px";
    if (top < -20) {
      playerShot.remove();
      bullets.delete(playerShot);
      playerShot = null;
    }
  }

  const shotsArray = Array.from(enemyShots);
  for (let s of shotsArray) {
    if (!running) break;
    s.y += 0.6 * dt;
    if (s.el) s.el.style.top = s.y + "px";
    if (s.y > PF_H() + 20) {
      if (s.el && s.el.remove) s.el.remove();
      enemyShots.delete(s);
    }
  }

  if (playerShot && running) {
    const pfRect = play.getBoundingClientRect();
    const br = playerShot.getBoundingClientRect();
    const brLocal = {
      left: br.left - pfRect.left,
      right: br.right - pfRect.left,
      top: br.top - pfRect.top,
      bottom: br.bottom - pfRect.top,
    };
    for (let i = 0; i < aliens.length; i++) {
      if (!running) break;
      const a = aliens[i];
      if (!a.alive) continue;
      const ar = a.el.getBoundingClientRect();
      const arLocal = {
        left: ar.left - pfRect.left,
        right: ar.right - pfRect.left,
        top: ar.top - pfRect.top,
        bottom: ar.bottom - pfRect.top,
      };
      //Collision detection using Axis-Aligned Bounding Box (AABB) method
      const overlap = !(
        arLocal.right < brLocal.left ||
        arLocal.left > brLocal.right ||
        arLocal.bottom < brLocal.top ||
        arLocal.top > brLocal.bottom
      );
      if (overlap) {
        a.alive = false;
        if (a.el && a.el.remove) a.el.remove();
        if (playerShot && playerShot.remove) playerShot.remove();
        bullets.delete(playerShot);
        playerShot = null;
        if (running) {
          score += 10;
          updateHUD();
        }
        break;
      }
    }
  }

  if (!running) return;
  const pfRect = play.getBoundingClientRect();
  const shotsNow = Array.from(enemyShots);
  for (let s of shotsNow) {
    if (!running) break;
    if (!s.el) {
      enemyShots.delete(s);
      continue;
    }
    const ser = s.el.getBoundingClientRect();
    const sLocal = {
      left: ser.left - pfRect.left,
      right: ser.right - pfRect.left,
      top: ser.top - pfRect.top,
      bottom: ser.bottom - pfRect.top,
    };
    const pr = player.getBoundingClientRect();
    const pLocal = {
      left: pr.left - pfRect.left,
      right: pr.right - pfRect.left,
      top: pr.top - pfRect.top,
      bottom: pr.bottom - pfRect.top,
    };
    const hit = !(
      pLocal.right < sLocal.left ||
      pLocal.left > sLocal.right ||
      pLocal.bottom < sLocal.top ||
      pLocal.top > sLocal.bottom
    );
    if (hit) {
      if (s.el && s.el.remove) s.el.remove();
      enemyShots.delete(s);
      if (!running) break;
      lives -= 1;
      updateHUD();
      if (lives <= 0) {
        endGame(false);
        break;
      }
    }
  }
}

function alienFireChance() {
  if (!running) return;
  const cfg = LEVELS[level];
  aliens
    .filter((a) => a.alive)
    .forEach((a) => {
      if (!running) return;
      if (Math.random() < cfg.shotRate) {
        const bx = (a.el.offsetLeft || a.baseX) + a.el.clientWidth / 2;
        const by = a.el.offsetTop + a.el.clientHeight;
        const e = document.createElement("div");
        e.className = "ebullet";
        e.style.left = bx + "px";
        e.style.top = by + "px";
        play.appendChild(e);
        enemyShots.add({ el: e, x: bx, y: by });
      }
    });
}

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === " ") {
    firePlayer();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

let last = performance.now();
function loop(now) {
  if (!running) return;
  const dt = now - last;
  last = now;

  if (keys.ArrowLeft || keys.a) px -= pV * (dt / 16);
  if (keys.ArrowRight || keys.d) px += pV * (dt / 16);
  px = Math.max(
    8 + player.clientWidth / 2,
    Math.min(PF_W() - player.clientWidth / 2 - 8, px)
  );
  player.style.left = px - player.clientWidth / 2 + "px";

  updateAliens(dt);

  updateBullets(dt);

  if (Math.random() < 0.02) alienFireChance();

  const remaining = aliveAliens();
  if (remaining === 0) {
    if (alienTimer) {
      clearInterval(alienTimer);
      alienTimer = null;
    }
    if (gameLoopId) {
      cancelAnimationFrame(gameLoopId);
      gameLoopId = null;
    }
    running = false;
    msg.innerHTML = `Level ${level} cleared!`;
    nextBtn.disabled = level === 3 ? true : false;
    if (level === 3) {
      endGame(true);
      return;
    }
    return;
  }

  gameLoopId = requestAnimationFrame(loop);
}

function startLevel() {
  clearField();
  placePlayerCenter();
  spawnAliens();
  updateHUD();
  msg.innerHTML = `Level ${level} started`;
  last = performance.now();
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  running = true;
  gameLoopId = requestAnimationFrame(loop);
  if (alienTimer) clearInterval(alienTimer);
  alienTimer = setInterval(() => {}, 1000);
  startBtn.disabled = true;
  nextBtn.disabled = true;
  resetBtn.disabled = false;
}

function endGame(won) {
  running = false;
  if (alienTimer) {
    clearInterval(alienTimer);
    alienTimer = null;
  }
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  enemyShots.forEach((e) => {
    if (e.el && e.el.remove) e.el.remove();
  });
  enemyShots.clear();
  bullets.forEach((b) => {
    if (b && b.remove) b.remove();
  });
  bullets.clear();
  if (playerShot) {
    if (playerShot.remove) playerShot.remove();
    playerShot = null;
  }

  if (won) {
    msg.innerHTML = `<b>You beat the game! Score ${score}</b>`;
    nextBtn.disabled = true;
    startBtn.disabled = true;
  } else {
    msg.innerHTML = `<b>GAME OVER</b>`;
    startBtn.disabled = false;
    nextBtn.disabled = true;
  }
  updateHUD();
}

resetBtn.addEventListener("click", () => {
  if (alienTimer) {
    clearInterval(alienTimer);
    alienTimer = null;
  }
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
  running = false;
  clearField();
  score = 0;
  lives = 3;
  level = 1;
  updateHUD();
  msg.innerHTML = "Ready";
  startBtn.disabled = false;
  nextBtn.disabled = true;
});

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  nextBtn.disabled = true;
  startLevel();
});

nextBtn.addEventListener("click", () => {
  if (level < 3) {
    level += 1;
    lives = Math.min(3, lives + 1);
    updateHUD();
    nextBtn.disabled = true;
    startBtn.disabled = false;
    msg.innerHTML = `Ready for level ${level}`;
  }
});
