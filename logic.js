const play = document.getElementById('playfield');
const startBtn = document.getElementById('start');
const nextBtn = document.getElementById('next');
const resetBtn = document.getElementById('reset');
const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const msg = document.getElementById('message');
const bgMusic = document.getElementById('bgMusic');

let level = 1, score = 0, lives = 3;
let gameLoopId = null, alienTimer = null;
let aliens = [], bullets = new Set(), enemyShots = new Set(), playerShot = null;
let running = false, gamePaused = false;
let px, pV = 6;
const particles = [];

const PF_W = () => play.clientWidth;
const PF_H = () => play.clientHeight;
const isMobile = window.innerWidth < 700;

const player = document.createElement('img');
player.src = 'rocket-ship.png';
player.className = 'player';
play.appendChild(player);

player.onload = () => {
  placePlayerCenter();
  player.style.display = 'block';
};

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

function spawnPlayerExplosion(x, y, count = 20) {
  for (let i = 0; i < count; i++) {
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
      particles.splice(i, 1);
      continue;
    }
    const left = parseFloat(p.style.left) + p.vx * dt / 16;
    const top = parseFloat(p.style.top) + p.vy * dt / 16;
    p.style.left = left + 'px';
    p.style.top = top + 'px';
    p.style.opacity = Math.max(0, Math.min(1, p.life / 600));
  }
}

function updateHUD() {
  levelEl.textContent = level;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
}

function clearField() {
  aliens.forEach(a => a.el?.remove());
  aliens = [];
  bullets.forEach(b => b?.remove());
  bullets.clear();
  enemyShots.forEach(e => e.el?.remove());
  enemyShots.clear();
  if (playerShot) { playerShot.remove(); playerShot = null; }
  particles.forEach(p => p.remove());
  particles.length = 0;
}

function placePlayerCenter() {
  px = PF_W() / 2;
  if (!player.clientWidth || !player.clientHeight) return;
  player.style.left = (px - player.clientWidth / 2) + 'px';
  player.style.top = (PF_H() - player.clientHeight - 8) + 'px';
}

const LEVELS = {
  1: { rows: isMobile ? 3 : 3, cols: isMobile ? 5 : 7, alienSpeed: isMobile ? 0.32 : 0.6, shotRate: isMobile ? 0.015 : 0.02 },
  2: { rows: isMobile ? 3 : 4, cols: isMobile ? 6 : 8, alienSpeed: isMobile ? 0.34 : 0.9, shotRate: isMobile ? 0.025 : 0.04 },
  3: { rows: isMobile ? 3 : 5, cols: isMobile ? 6 : 9, alienSpeed: isMobile ? 0.36 : 1.4, shotRate: isMobile ? 0.03 : 0.07 }
};

function spawnAliens() {
  const cfg = LEVELS[level];
  const gapX = 12, gapY = 12, startX = 60, startY = isMobile ? 40 : 60;

  const temp = document.createElement('img');
  temp.src = 'ufo.png';
  temp.className = 'alien';
  temp.style.visibility = 'hidden';
  play.appendChild(temp);
  const aW = temp.clientWidth || 44;
  const aH = temp.clientHeight || 32;
  temp.remove();

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

  alienDir = 1;
  alienOffset = 0;
}

let alienDir = 1;
let alienOffset = 0;

function aliveAliens() {
  return aliens.filter(a => a.alive).length;
}

function updateAliens(dt) {
  if (!running) return;
  const alive = aliens.filter(a => a.alive);
  if (!alive.length) return;

  const cfg = LEVELS[level];
  let speed = cfg.alienSpeed * dt * 0.06;
  if (isMobile) speed *= 0.15 + 0.05 * level;

  const xs = alive.map(a => a.baseX + alienOffset);
  const minX = Math.min(...xs);
  const maxX = Math.max(...alive.map(a => a.baseX + alienOffset + a.el.clientWidth));
  const dropDistance = isMobile ? 8 + level * 2 : 24;

  if (minX < 8 && alienDir === -1) {
    alienDir = 1;
    alive.forEach(a => a.y += dropDistance);
  }
  if (maxX > PF_W() - 8 && alienDir === 1) {
    alienDir = -1;
    alive.forEach(a => a.y += dropDistance);
  }

  alienOffset += alienDir * speed;

  alive.forEach(a => {
    a.el.style.left = (a.baseX + alienOffset) + 'px';
    a.el.style.top = a.y + 'px';
    if (a.y + a.el.clientHeight >= PF_H() - 140) endGame(false);
  });
}

function firePlayer() {
  if (!running || gamePaused || playerShot) return;
  const b = document.createElement('div');
  b.className = 'bullet';
  const bx = px - 3;
  const by = PF_H() - player.clientHeight - 8 - 16;
  b.style.left = bx + 'px';
  b.style.top = by + 'px';
  play.appendChild(b);
  playerShot = b;
  bullets.add(b);
}

function updateBullets(dt) {
  if (!running) return;

  if (playerShot) {
    const top = parseFloat(playerShot.style.top) - 0.9 * dt;
    playerShot.style.top = top + 'px';
    if (top < -20) {
      playerShot.remove();
      bullets.delete(playerShot);
      playerShot = null;
    }
  }

  Array.from(enemyShots).forEach(s => {
    s.y += 0.6 * dt;
    if (s.el) s.el.style.top = s.y + 'px';
    if (s.y > PF_H() + 20) {
      s.el?.remove();
      enemyShots.delete(s);
    }
  });

  if (playerShot) {
    const pfRect = play.getBoundingClientRect();
    const br = playerShot.getBoundingClientRect();
    const brLocal = { left: br.left - pfRect.left, right: br.right - pfRect.left, top: br.top - pfRect.top, bottom: br.bottom - pfRect.top };

    aliens.forEach(a => {
      if (!a.alive) return;
      const ar = a.el.getBoundingClientRect();
      const arLocal = { left: ar.left - pfRect.left, right: ar.right - pfRect.left, top: ar.top - pfRect.top, bottom: ar.bottom - pfRect.top };
      const hit = !(arLocal.right < brLocal.left || arLocal.left > brLocal.right || arLocal.bottom < brLocal.top || arLocal.top > brLocal.bottom);
      if (hit) {
        a.alive = false;
        a.el.remove();
        playerShot.remove();
        bullets.delete(playerShot);
        playerShot = null;
        score += 10;
        updateHUD();
        spawnParticleExplosion((arLocal.left + arLocal.right)/2, (arLocal.top + arLocal.bottom)/2);
      }
    });
  }

  const pfRect = play.getBoundingClientRect();
  const pr = player.getBoundingClientRect();
  const pLocal = { left: pr.left - pfRect.left, right: pr.right - pfRect.left, top: pr.top - pfRect.top, bottom: pr.bottom - pfRect.top };

  Array.from(enemyShots).forEach(s => {
    const ser = s.el.getBoundingClientRect();
    const sLocal = { left: ser.left - pfRect.left, right: ser.right - pfRect.left, top: ser.top - pfRect.top, bottom: ser.bottom - pfRect.top };
    const hit = !(pLocal.right < sLocal.left || pLocal.left > sLocal.right || pLocal.bottom < sLocal.top || pLocal.top > sLocal.bottom);
    if (hit) {
      s.el.remove();
      enemyShots.delete(s);
      lives -= 1;
      updateHUD();
      if (lives <= 0) {
        const rect = player.getBoundingClientRect();
        const pfRect = play.getBoundingClientRect();
        const centerX = rect.left - pfRect.left + rect.width / 2;
        const centerY = rect.top - pfRect.top + rect.height / 2;

        spawnPlayerExplosion(centerX, centerY, 50);
        player.style.display = 'none';
        running = false;

        function explosionLoop() {
          if (particles.length === 0) { endGame(false); return; }
          updateParticles(16);
          requestAnimationFrame(explosionLoop);
        }
        explosionLoop();
      }
    }
  });
}

function alienFireChance() {
  if (!running) return;
  const cfg = LEVELS[level];
  aliens.filter(a => a.alive).forEach(a => {
    if (Math.random() < cfg.shotRate * (isMobile ? 0.6 : 1)) {
      const bx = a.el.offsetLeft + a.el.clientWidth/2;
      const by = a.el.offsetTop + a.el.clientHeight;
      const e = document.createElement('div');
      e.className = 'ebullet';
      e.style.left = bx + 'px';
      e.style.top = by + 'px';
      play.appendChild(e);
      enemyShots.add({ el: e, x: bx, y: by });
    }
  });
}

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' && !gamePaused) firePlayer();
});
window.addEventListener('keyup', e => keys[e.key] = false);

const mobileControls = document.createElement("div");
mobileControls.id = "mobileControls";
mobileControls.innerHTML = `
  <button id="leftBtn">◀</button>
  <button id="fireBtn">⭡</button>
  <button id="rightBtn">▶</button>
`;
document.body.appendChild(mobileControls);

let leftPressed = false;
let rightPressed = false;
let cr=['leftBtn', 'rightBtn', 'fireBtn']
cr.forEach(id => {
  const btn = document.getElementById(id);
  const setDown = () => {
    if (id === 'leftBtn') leftPressed = true;
    else if (id === 'rightBtn') rightPressed = true;
    else firePlayer();
  };
  const setUp = () => {
    if (id === 'leftBtn') leftPressed = false;
    else if (id === 'rightBtn') rightPressed = false;
  };
  btn.addEventListener('touchstart', e => { e.preventDefault(); setDown(); });
  btn.addEventListener('touchend', e => { e.preventDefault(); setUp(); });
  btn.addEventListener('pointerdown', e => { e.preventDefault(); setDown(); });
  btn.addEventListener('pointerup', e => { e.preventDefault(); setUp(); });
});


let lastTime = performance.now();
function loop(now){
  const dt = Math.min(40, now - lastTime);
  lastTime = now;
  if(!running) return;
  if(gamePaused){ requestAnimationFrame(loop); return; }

  if(keys.ArrowLeft || keys.a || leftPressed) px -= pV*dt/16;
  if(keys.ArrowRight || keys.d || rightPressed) px += pV*dt/16;
  px = Math.max(player.clientWidth/2+8, Math.min(PF_W()-player.clientWidth/2-8, px));
  player.style.left = (px - player.clientWidth/2)+'px';

  updateAliens(dt);
  updateBullets(dt);
  updateParticles(dt);

  if(aliveAliens()===0){
    running=false;
    msg.innerHTML=`Level ${level} cleared!`;
    nextBtn.disabled = level===3;
    return;
  }

  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', ()=>{
  startBtn.disabled = true; nextBtn.disabled = true;
  clearField(); placePlayerCenter(); spawnAliens(); updateHUD();
  running=true; lastTime=performance.now();
  requestAnimationFrame(loop);
  alienTimer = setInterval(()=>{ if(running && !gamePaused) alienFireChance(); },700);
});

nextBtn.addEventListener('click', ()=>{
  if(level<3){ level++; lives=Math.min(3,lives+1); updateHUD(); nextBtn.disabled=true; startBtn.disabled=false; msg.innerHTML=`Ready for level ${level}`; }
});

resetBtn.addEventListener('click', ()=>{
  clearInterval(alienTimer);
  running=false;
  clearField();
  score=0; lives=3; level=1;
  updateHUD();
  msg.innerHTML='Ready';
  startBtn.disabled=false; nextBtn.disabled=true;
});

pauseBtn.addEventListener('click', ()=>{
  if(!running) return;
  gamePaused=!gamePaused;
  pauseBtn.textContent = gamePaused?'Resume':'Pause';
  if(!gamePaused) lastTime=performance.now(); requestAnimationFrame(loop);
});

muteBtn.addEventListener('click', ()=>{
  if(bgMusic.paused){ bgMusic.play(); muteBtn.textContent='Mute'; } else { bgMusic.pause(); muteBtn.textContent='Unmute'; }
});

function endGame(won){
  running=false;
  clearInterval(alienTimer);
  enemyShots.forEach(e=>e.el?.remove()); enemyShots.clear();
  bullets.forEach(b=>b.remove()); bullets.clear();
  if(playerShot) playerShot.remove(); playerShot=null;
  particles.forEach(p=>p.remove()); particles.length=0;
  player.style.display='block';
  if(won){ msg.innerHTML=`<b>You beat the game! Score ${score}</b>`; } 
  else { msg.innerHTML=`<b>GAME OVER</b>`; score=0; level=1; lives=3; updateHUD(); startBtn.disabled=false; nextBtn.disabled=true; }
}

