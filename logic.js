// logic.js (replace the file contents with this)

const play = document.getElementById('playfield');
const startBtn = document.getElementById('start');
const nextBtn = document.getElementById('next');
const resetBtn = document.getElementById('reset');
const muteBtn = document.getElementById('muteBtn');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const msg = document.getElementById('message');
const bgMusic = document.getElementById('bgMusic');



let level = 1, score = 0, lives = 3;
let gameLoopId = null, alienTimer = null;
let aliens = [], bullets = new Set(), enemyShots = new Set(), playerShot = null;
let running = false;
const PF_W = () => play.clientWidth, PF_H = () => play.clientHeight;

const particles = [];

function spawnParticleExplosion(x, y, count = 15) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = Math.random() * 2 * Math.PI;
    const speed = 1 + Math.random() * 3;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 400 + Math.random() * 200;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    play.appendChild(p);
    particles.push(p);
  }
}
function spawnPlayerExplosion(x, y, count = 20){
    for(let i=0; i<count; i++){
        const p = document.createElement('div');
        p.className = 'player-particle';
        const angle = Math.random() * 2 * Math.PI;
        const speed = 2 + Math.random() * 3;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 500 + Math.random() * 300;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        play.appendChild(p);
        particles.push(p);
    }
}


function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.remove();
      particles.splice(i, 1); // i → index of the particle we are checking.1 → remove exactly 1 particle at that index.
      continue;
    }
    const left = parseFloat(p.style.left) + p.vx * dt / 16; // speed
    const top = parseFloat(p.style.top) + p.vy * dt / 16;
    p.style.left = left + 'px';
    p.style.top = top + 'px';
    p.style.opacity = Math.max(0, Math.min(1, p.life / 600));
  }
}


const isMobile = window.innerWidth < 700;

const LEVELS = {
  1: {
    rows: isMobile ? 3:3,
    cols: isMobile ? 5: 7,
    alienSpeed: isMobile ? 0.3 : 0.6,
    shotRate: isMobile ? 0.015 : 0.02
  },
  2: {
    rows:isMobile ? 3: 4,
    cols: isMobile ? 5: 8,
    alienSpeed: isMobile ? 0.4 : 0.9,
    shotRate: isMobile ? 0.025 : 0.04
  },
  3: {
    rows: isMobile ? 3 : 5,    
    cols: isMobile ? 5 : 9,      
    alienSpeed: isMobile ? 0.5 : 1.4,  
    shotRate: isMobile ? 0.03 : 0.07
  }
};




let px, pV = 6;  // horizontal position and speed

const player = document.createElement('img');
player.src = 'rocket-ship.png';  // path to your rocket image
player.className = 'player';
play.appendChild(player);

// place player after image has loaded
player.onload = () => {
    placePlayerCenter();
    player.style.display = 'block'; // make sure it's visible
};




function updateHUD() { levelEl.textContent = level; scoreEl.textContent = score; livesEl.textContent = lives; }
function clearField() {
  aliens.forEach(a => { if (a.el && a.el.remove) a.el.remove(); });
  aliens = [];
  bullets.forEach(b => { if (b && b.remove) b.remove(); });
  bullets.clear();
  enemyShots.forEach(e => { if (e.el && e.el.remove) e.el.remove(); });
  enemyShots.clear();
  if (playerShot) { if (playerShot.remove) playerShot.remove(); playerShot = null; }
  particles.forEach(p => p.remove());
  particles.length = 0;
}

function placePlayerCenter() {
    px = PF_W() / 2;

    // Wait until image is loaded
    if (!player.clientWidth || !player.clientHeight) return;

    player.style.left = (px - player.clientWidth / 2) + 'px';
    player.style.top = (PF_H() - player.clientHeight - 8) + 'px'; // 8px from bottom
}

let alienDir = 1;
let alienOffset = 0;


function spawnAliens() {
  const cfg = LEVELS[level];
  const gapX = 12, gapY = 12;
  const startX = 60;
  const startY = isMobile ? 40 : 60; // start lower on desktop to avoid HUD

  // Create a temporary image to get actual width/height of UFO
  const temp = document.createElement('img');
  temp.src = 'ufo.png';
  temp.className = 'alien';
  temp.style.visibility = 'hidden';
  play.appendChild(temp);
  const aW = temp.clientWidth || 44;  // width of the alien
  const aH = temp.clientHeight || 32; // height of the alien
  temp.remove();

  // Loop to create alien grid
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const aEl = document.createElement('img');
      aEl.src = 'ufo.png';
      aEl.className = 'alien';
      aEl.dataset.row = r;
      aEl.dataset.col = c;

      const x = startX + c * (aW + gapX);
      const y = startY + r * (aH + gapY);

      aEl.style.left = x + 'px';
      aEl.style.top = y + 'px';

      play.appendChild(aEl);
      aliens.push({ el: aEl, baseX: x, y: y, alive: true });
    }
  }

  // reset alien group motion
  alienDir = 1;
  alienOffset = 0;
}


function aliveAliens() {
  return aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
}

function updateAliens(dt) {
  if (!running) return;
  const alive = aliens.filter(a => a.alive);
  if (alive.length === 0) return;

  const cfg = LEVELS[level];
  let speed = cfg.alienSpeed * dt * 0.06;

  const isMobile = window.innerWidth < 700;
  if (isMobile) {
    speed *= 0.15 + 0.05 * level; // slower horizontal movement, slightly faster on higher levels
  }

  const xs = alive.map(a => a.baseX + alienOffset);
  const minX = Math.min(...xs);
  const maxX = Math.max(...alive.map(a => a.baseX + alienOffset + a.el.clientWidth));

  let dropDistance = isMobile ? 8 + level * 2 : 24;

  if (minX < 8 && alienDir === -1) {
    alienDir = 1;
    alive.forEach(a => a.y += dropDistance);
  }
  if (maxX > PF_W() - 8 && alienDir === 1) {
    alienDir = -1;
    alive.forEach(a => a.y += dropDistance);
  }

  alienOffset += alienDir * speed;

  for (let a of aliens) {
    if (!a.alive) continue;
    a.el.style.left = (a.baseX + alienOffset) + 'px';
    a.el.style.top = a.y + 'px';

    if (a.y + a.el.clientHeight >= PF_H() - 140) {
      endGame(false);
      return;
    }
  }
}



function firePlayer() {
  if (!running || gamePaused) return; // ❌ do nothing if paused
  if (playerShot) return;
  
  const b = document.createElement('div');
  b.className = 'bullet';
  const bx = px - 3; 
  const by = PF_H() - player.clientHeight - 8 - 16; // tip of rocket
  b.style.left = bx + 'px'; 
  b.style.top = by + 'px';
  play.appendChild(b);
  playerShot = b;
  bullets.add(b);
}


function updateBullets(dt) {
  if (!running) return;

  // Player bullet movement
  if (playerShot) {
    const speed = 0.9 * dt;
    const top = parseFloat(playerShot.style.top) - speed;
    playerShot.style.top = top + 'px';
    if (top < -20) { 
      playerShot.remove(); 
      bullets.delete(playerShot); 
      playerShot = null; 
    }
  }

  // Enemy bullets movement
  const shotsArray = Array.from(enemyShots);
  for (let s of shotsArray) {
    if (!running) break;
    s.y += 0.6 * dt;
    if (s.el) s.el.style.top = s.y + 'px';
    if (s.y > PF_H() + 20) { 
      if (s.el && s.el.remove) s.el.remove(); 
      enemyShots.delete(s); 
    }
  }

  
  // Collision: player bullet vs aliens
if (playerShot && running) {
  const pfRect = play.getBoundingClientRect();
  const br = playerShot.getBoundingClientRect();
  const brLocal = { 
    left: br.left - pfRect.left, 
    right: br.right - pfRect.left, 
    top: br.top - pfRect.top, 
    bottom: br.bottom - pfRect.top 
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
      bottom: ar.bottom - pfRect.top 
    };

    const overlap = !(arLocal.right < brLocal.left || arLocal.left > brLocal.right || arLocal.bottom < brLocal.top || arLocal.top > brLocal.bottom);
    if (overlap) {
      a.alive = false;
      if (a.el && a.el.remove) a.el.remove();
      if (playerShot && playerShot.remove) playerShot.remove();
      bullets.delete(playerShot);
      playerShot = null;

      const centerX = arLocal.left + (arLocal.right - arLocal.left) / 2;
      const centerY = arLocal.top + (arLocal.bottom - arLocal.top) / 2;
      spawnParticleExplosion(centerX, centerY);

      score += 10;
      updateHUD();

      // Remove all particles immediately if this was the last alive alien
      if (aliveAliens() === 0) {
        particles.forEach(p => p.remove());
        particles.length = 0;
      }

      break;
    }
  }
}


  if (!running) return;

  // Collision: enemy bullet vs player
  const pfRect = play.getBoundingClientRect();
  const shotsNow = Array.from(enemyShots);

  for (let s of shotsNow) {
    if (!running) break;
    if (!s.el) { enemyShots.delete(s); continue; }

    const ser = s.el.getBoundingClientRect();
    const sLocal = { 
      left: ser.left - pfRect.left, 
      right: ser.right - pfRect.left, 
      top: ser.top - pfRect.top, 
      bottom: ser.bottom - pfRect.top 
    };

    const pr = player.getBoundingClientRect();
    const pLocal = { 
      left: pr.left - pfRect.left, 
      right: pr.right - pfRect.left, 
      top: pr.top - pfRect.top, 
      bottom: pr.bottom - pfRect.top 
    };

    const hit = !(pLocal.right < sLocal.left || pLocal.left > sLocal.right || pLocal.bottom < sLocal.top || pLocal.top > sLocal.bottom);

    if (hit){
      if (s.el && s.el.remove) s.el.remove();
      enemyShots.delete(s);
      lives -= 1;
      updateHUD();

  if (lives <= 0) {
    const pr = player.getBoundingClientRect();
    const pfRect = play.getBoundingClientRect();
    const centerX = pr.left - pfRect.left + pr.width / 2;
    const centerY = pr.top - pfRect.top + pr.height / 2;

    // spawn bigger explosion
    spawnPlayerExplosion(centerX, centerY, 50);

    // hide player
    player.style.display = 'none';

    // clear bullets immediately
    bullets.forEach(b => { if (b.remove) b.remove(); });
    bullets.clear();
    enemyShots.forEach(s => { if (s.el && s.el.remove) s.el.remove(); });
    enemyShots.clear();
    if (playerShot) { if (playerShot.remove) playerShot = null; }

    // animate explosion independently
  function explosionLoop() {
    if (particles.length === 0) {
        endGame(false);
        return;
    }
    updateParticles(16);
    requestAnimationFrame(explosionLoop);
}


    explosionLoop();

    running = false;
    leftPressed = rightPressed = false;
}

    }
  }
}


function alienFireChance() {
  if (!running) return;
  const cfg = LEVELS[level];
  aliens.filter(a => a.alive).forEach(a => {
    if (!running) return;
    let shotRate = cfg.shotRate;

    // reduce fire rate for smaller screens (mobile)
    if (window.innerWidth < 700) {
      shotRate *= 0.6; // 40% fewer shots on mobile
    }

    if (Math.random() < shotRate) {
      const bx = (a.el.offsetLeft || a.baseX) + a.el.clientWidth / 2;
      const by = a.el.offsetTop + a.el.clientHeight;
      const e = document.createElement('div'); e.className = 'ebullet';
      e.style.left = bx + 'px'; e.style.top = by + 'px';
      play.appendChild(e);
      enemyShots.add({ el: e, x: bx, y: by });
    }
  });
}

const keys = {};

window.addEventListener('keydown', e => { 
  keys[e.key] = true; 
  if (e.key === ' ' && !gamePaused) { firePlayer(); } // ❌ only if not paused
});
window.addEventListener('keyup', e => {
  keys[e.key] = false;
});


 

let last = performance.now();

function loop(now) {
    let dt = now - last;
    last = now;

    if (dt > 40) dt = 40;

    if (!running) return; // stop completely if game stopped
    if (gamePaused) {
        gameLoopId = requestAnimationFrame(loop); // keep loop alive
        return;
    }

    

if (keys.ArrowLeft || keys.a) px -= pV * (dt / 16);
if (keys.ArrowRight || keys.d) px += pV * (dt / 16);
if (leftPressed) px -= pV * (dt / 16);
if (rightPressed) px += pV * (dt / 16);

px = Math.max(player.clientWidth / 2 + 8, Math.min(PF_W() - player.clientWidth / 2 - 8, px));
player.style.left = (px - player.clientWidth / 2) + 'px';
player.style.top = (PF_H() - player.clientHeight - 8) + 'px'; // fixed at bottom


  
  updateAliens(dt);
  updateBullets(dt);
  updateParticles(dt);

  // alien firing is handled by an interval (set in startLevel)
  const remaining = aliveAliens();
  if (remaining === 0) {
    if (alienTimer) { clearInterval(alienTimer); alienTimer = null; }
    if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
    running = false;
    msg.innerHTML = `Level ${level} cleared!`;
    nextBtn.disabled = level === 3 ? true : false;
    if (level === 3) { endGame(true); return; }
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

 alienTimer = setInterval(() => { 
  if (running && !gamePaused) alienFireChance(); // ❌ only fire if not paused
}, 700);


  startBtn.disabled = true;
  nextBtn.disabled = true;
  resetBtn.disabled = false;
}

function endGame(won) {
  running = false;
  try { bgMusic.pause(); bgMusic.currentTime = 0; } catch (e) { }

  if (alienTimer) { clearInterval(alienTimer); alienTimer = null; }
  enemyShots.forEach(e => { if (e.el && e.el.remove) e.el.remove(); });
  enemyShots.clear();
  bullets.forEach(b => { if (b && b.remove) b.remove(); });
  bullets.clear();
  if (playerShot) { if (playerShot.remove) playerShot.remove(); playerShot = null; }
  particles.forEach(p => p.remove());
  particles.length = 0;

  if (won) {
    msg.innerHTML = `<b>You beat the game! Score ${score}</b>`;
    nextBtn.disabled = true;
    startBtn.disabled = true;
  } else {
    msg.innerHTML = `<b>GAME OVER</b>`;
    score = 0;
    level = 1;
    lives = 3;
    updateHUD();
    startBtn.disabled = false;
    nextBtn.disabled = true;
  }
}

resetBtn.addEventListener('click', () => {
  if (alienTimer) { clearInterval(alienTimer); alienTimer = null; }
  if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
  running = false;
  clearField();
  score = 0; lives = 3; level = 1;
  updateHUD();
  msg.innerHTML = 'Ready';
  startBtn.disabled = false;
  nextBtn.disabled = true;
});

startBtn.addEventListener('click', () => {
  bgMusic.play().catch(() => { });
  startBtn.disabled = true; nextBtn.disabled = true;
  startLevel();
});

nextBtn.addEventListener('click', () => {
  if (level < 3) {
    level += 1; lives = Math.min(3, lives + 1); updateHUD();
    nextBtn.disabled = true; startBtn.disabled = false; msg.innerHTML = `Ready for level ${level}`;
  }
});

muteBtn.addEventListener('click', () => {
  if (bgMusic.paused) {
    bgMusic.play().catch(() => { });
    muteBtn.textContent = 'Mute';
  } else {
    bgMusic.pause();
    muteBtn.textContent = 'Unmute';
  }
});

const pauseBtn = document.getElementById('pauseBtn');
let gamePaused = false;

pauseBtn.addEventListener('click', () => {
  if (!running) return; // do nothing if game hasn't started

  gamePaused = !gamePaused; // toggle pause
  if (gamePaused) {
    pauseBtn.textContent = 'Resume';
  } else {
    pauseBtn.textContent = 'Pause';
    last = performance.now(); // reset delta time
    requestAnimationFrame(loop); // resume game loop
  }
});


// =======================
// Mobile controls (clean, minimal, non-invasive)
// =======================
const mobileControls = document.createElement("div");
mobileControls.id = "mobileControls";
mobileControls.innerHTML = `
  <button id="leftBtn" aria-label="left">◀</button>
  <button id="fireBtn" aria-label="fire">⭡</button>
  <button id="rightBtn" aria-label="right">▶</button>
`;
document.body.appendChild(mobileControls);

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const fireBtn = document.getElementById("fireBtn");

let leftPressed = false, rightPressed = false;

// Touch & pointer handlers (supports touch and mouse)
function prevent(e) { if (e.cancelable) e.preventDefault(); }
leftBtn.addEventListener("touchstart", e => { prevent(e); leftPressed = true; });
leftBtn.addEventListener("touchend", e => { prevent(e); leftPressed = false; });
leftBtn.addEventListener("pointerdown", e => { e.preventDefault(); leftPressed = true; });
leftBtn.addEventListener("pointerup", e => { e.preventDefault(); leftPressed = false; });

rightBtn.addEventListener("touchstart", e => { prevent(e); rightPressed = true; });
rightBtn.addEventListener("touchend", e => { prevent(e); rightPressed = false; });
rightBtn.addEventListener("pointerdown", e => { e.preventDefault(); rightPressed = true; });
rightBtn.addEventListener("pointerup", e => { e.preventDefault(); rightPressed = false; });

fireBtn.addEventListener("touchstart", e => { 
  prevent(e); 
  if (!gamePaused) firePlayer(); 
});
fireBtn.addEventListener("pointerdown", e => { 
  e.preventDefault(); 
  if (!gamePaused) firePlayer(); 
});