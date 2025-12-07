/**
 * CORE GAME ENGINE
 * Soldier Frontline: Operation Survival (Cooldowns, Instant Death, Laser Physics)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- FPS Control ---
const fps = 60;
const fpsInterval = 1000 / fps;
let then = Date.now();
let elapsed;

// Game State
let gameState = 'START'; 
let score = 0;
let highScore = localStorage.getItem('sf_highscore') || 0;
let wave = 1;
let frames = 0;

// --- Wave & Spawning System ---
const WAVE_DURATION = 40 * 60; 
let waveTimer = WAVE_DURATION;
let healDropsInWave = 0; 
let fireRateDropsInWave = 0;

let spawnConfig = {
    soldier: { count: 0, max: 0, timer: 0 },
    drone:   { count: 0, max: 0, timer: 0 },
    tank:    { count: 0, max: 0, timer: 0 },
    poison:  { count: 0, max: 0, timer: 0 },
    shield:  { count: 0, max: 0, timer: 0 }
};

let upgradeSchedule = []; 

// Environment
let gravity = 0.6;
let floorY = 0;

// Weather
let weather = 'CLEAR'; 
const weatherCycleLength = 900; 
let lightningStrikes = []; 
let weatherInitFrame = 0; 

// Entities
let player;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let items = [];
let platforms = []; 
let boss = null;
let spikes = []; 

// Spawn Timers
let enemySpawnTimer = 0;

// Inputs
const mousePos = { x: 0, y: 0 };
const keys = {
    a: false, d: false, w: false, s: false, space: false, mouse: false, ult: false
};
const keys_last = {
    a: false, d: false, w: false, s: false, space: false, mouse: false, ult: false
};

// Setup Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    floorY = canvas.height - 100;
}
window.addEventListener('resize', resize);
resize();

// --- Input Handling ---
window.addEventListener('keydown', e => {
    if(e.key === 'a' || e.key === 'A') keys.a = true;
    if(e.key === 'd' || e.key === 'D') keys.d = true;
    if(e.key === 's' || e.key === 'S') keys.s = true; 
    if(e.key === 'w' || e.key === 'W' || e.key === ' ') keys.space = true;
    if(e.key === 'e' || e.key === 'E') keys.ult = true;
});
window.addEventListener('keyup', e => {
    if(e.key === 'a' || e.key === 'A') keys.a = false;
    if(e.key === 'd' || e.key === 'D') keys.d = false;
    if(e.key === 's' || e.key === 'S') keys.s = false; 
    if(e.key === 'w' || e.key === 'W' || e.key === ' ') keys.space = false;
    if(e.key === 'e' || e.key === 'E') keys.ult = false;
});
window.addEventListener('mousedown', () => keys.mouse = true);
window.addEventListener('mouseup', () => keys.mouse = false);
window.addEventListener('mousemove', e => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
});

// Mobile Controls
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'block';
    const bindTouch = (id, key) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    };
    bindTouch('btn-left', 'a');
    bindTouch('btn-right', 'd');
    bindTouch('btn-crouch', 's');
    bindTouch('btn-jump', 'space');
    bindTouch('btn-shoot', 'mouse');
    bindTouch('btn-ult', 'ult');
}

// --- 28. Tutorial Logic (5 Seconds) ---
function showTutorial() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.remove('hidden');
    
    let btn = document.getElementById('btn-start-game');
    let timeLeft = 5; // Reduced to 5s
    
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.innerText = `READ MANUAL (${timeLeft})`;
    
    let timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.innerText = "DEPLOY TO BATTLE";
        } else {
            btn.innerText = `READ MANUAL (${timeLeft})`;
        }
    }, 1000);
}

function initWave() {
    waveTimer = WAVE_DURATION;
    upgradeSchedule = [];
    healDropsInWave = 0; 
    fireRateDropsInWave = 0;
    
    for (let i = 0; i < 3; i++) {
        upgradeSchedule.push(randomFrameInWave());
    }

    spawnConfig.soldier.max = 14 + ((wave - 1) * 3);
    spawnConfig.soldier.count = 0;
    spawnConfig.soldier.timer = 60; 

    spawnConfig.drone.max = 2 + (wave - 1);
    spawnConfig.drone.count = 0;
    spawnConfig.drone.timer = 120;

    spawnConfig.tank.max = (wave >= 2) ? 3 : 0;
    spawnConfig.tank.count = 0;
    spawnConfig.tank.timer = 600; 

    spawnConfig.poison.max = (wave >= 3) ? 7 : 0;
    spawnConfig.poison.count = 0;
    spawnConfig.poison.timer = 240; 

    spawnConfig.shield.max = (wave >= 5) ? 2 : 0;
    spawnConfig.shield.count = 0;
    spawnConfig.shield.timer = 720; 
}

function randomFrameInWave() {
    return Math.floor(Math.random() * (WAVE_DURATION - 400)) + 200;
}

// --- Classes ---

class Platform {
    constructor(x, y, w) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = 20;
    }
    draw() {
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(this.x + 5, this.y + 5, this.w - 10, this.h - 10);
        ctx.fillStyle = '#f1c40f';
        for(let i=0; i<this.w; i+=20) {
            ctx.fillRect(this.x + i, this.y + this.h - 5, 10, 5);
        }
    }
}

class Player {
    constructor() {
        this.initialH = 70; 
        this.crouchH = 40; 
        this.w = 40;
        this.h = this.initialH;
        this.x = 100;
        this.y = floorY - this.h;
        this.vx = 0;
        this.vy = 0;
        this.baseSpeed = 4.0;
        this.speed = this.baseSpeed;
        this.jumpPower = -13; 
        this.color = '#3498db';
        this.maxHp = 100;
        this.hp = 100;
        this.shield = 0;
        this.damage = 20; 
        this.gunLevel = 1;
        this.lastShot = 0;
        this.fireRate = 15;
        this.isGrounded = true;
        this.isCrouching = false;
        this.jumpCount = 0;
        this.maxJumps = 2;

        this.poisonTimer = 0; 
        this.poisonTick = 0;  

        // --- 25. Ultimate Cooldown System (40s) ---
        this.ultMaxCooldown = 40 * 60; // 40 seconds * 60 fps = 2400 frames
        this.ultTimer = 0; // 0 = Ready
    }

    update() {
        // --- 25. Update Cooldown ---
        if (this.ultTimer > 0) {
            this.ultTimer--;
        }
        
        // Input for Ult
        if (keys.ult && !keys_last.ult && this.ultTimer <= 0) {
            this.activateUlt();
        }

        this.updateUltUI();

        // Poison
        if (this.poisonTimer > 0) {
            this.poisonTimer--;
            this.poisonTick++;
            if (this.poisonTick >= 60) {
                this.takeDamage(2); 
                createParticles(this.x + this.w/2, this.y, 5, '#00ff00'); 
                this.poisonTick = 0;
            }
        } else {
            this.poisonTick = 0;
        }

        if (keys.s) {
            if (!this.isCrouching) {
                this.isCrouching = true;
                this.h = this.crouchH;
                this.y += (this.initialH - this.crouchH);
                this.speed = this.baseSpeed * 0.4;
            }
        } else {
            if (this.isCrouching) {
                this.isCrouching = false;
                this.y -= (this.initialH - this.crouchH);
                this.h = this.initialH;
                this.speed = this.baseSpeed;
            }
        }

        if (keys.a) { this.vx = -this.speed; }
        else if (keys.d) { this.vx = this.speed; }
        else { this.vx *= 0.8; }

        const isSpaceNewlyPressed = keys.space && !keys_last.space;
        if (isSpaceNewlyPressed && !this.isCrouching) { 
            if (this.jumpCount < this.maxJumps) {
                let jumpVelocity = this.jumpPower; 
                if (this.jumpCount === 1) jumpVelocity = -12; 
                this.vy = jumpVelocity; 
                this.isGrounded = false;
                this.jumpCount++; 
                createParticles(this.x + this.w/2, this.y + this.h, 5, '#fff');
            }
        } 
        
        this.vy += gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.y + this.h > floorY) {
            this.y = floorY - this.h;
            this.vy = 0;
            this.isGrounded = true;
            this.jumpCount = 0; 
        }

        let onPlatform = false;
        platforms.forEach(p => {
            if (this.vy >= 0 && 
                this.y + this.h >= p.y && 
                this.y + this.h <= p.y + p.h + 10 && 
                this.x + this.w > p.x && 
                this.x < p.x + p.w) {
                
                this.y = p.y - this.h;
                this.vy = 0;
                this.isGrounded = true;
                this.jumpCount = 0; 
                onPlatform = true;
            }
        });

        if (this.y + this.h >= floorY) this.isGrounded = true;
        else if (!onPlatform) this.isGrounded = false;
        
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.w) this.x = canvas.width - this.w;

        if (keys.mouse) {
            if (frames - this.lastShot > this.fireRate) {
                this.shoot();
                this.lastShot = frames;
            }
        }
    }

    activateUlt() {
        this.ultTimer = this.ultMaxCooldown; // Start cooldown
        showNotification("ULTIMATE RELEASED!");
        
        const startX = this.x + this.w/2;
        const startY = this.y + this.h/2;
        const angle = Math.atan2(mousePos.y - startY, mousePos.x - startX);
        const speed = 8;
        
        bullets.push(new Bullet(startX, startY, Math.cos(angle)*speed, Math.sin(angle)*speed, 100, true, false, true));
    }

    updateUltUI() {
        // Calculate percentage for UI fill (100% = Ready, 0% = Just used)
        // If timer is 0, it's 100% ready.
        let pct = 0;
        if (this.ultTimer <= 0) {
            pct = 100;
            document.getElementById('ult-text').innerText = "READY";
        } else {
            pct = 100 - ((this.ultTimer / this.ultMaxCooldown) * 100);
            let secondsLeft = Math.ceil(this.ultTimer / 60);
            document.getElementById('ult-text').innerText = secondsLeft + "s";
        }

        document.getElementById('ult-fill').style.height = pct + "%";
        
        if (pct >= 100) {
            document.getElementById('ult-fill').style.background = "#00ff00"; 
            document.querySelector('.ult-circle').style.borderColor = "#00ff00";
        } else {
            document.getElementById('ult-fill').style.background = "linear-gradient(0deg, #ff8c00, #ff4500)";
            document.querySelector('.ult-circle').style.borderColor = "#333";
        }
    }

    shoot() {
        const bulletSpeed = 10;
        const startX = this.x + this.w/2;
        const startY = this.y + this.h/2;
        const angle = Math.atan2(mousePos.y - startY, mousePos.x - startX);
        const vx = Math.cos(angle) * bulletSpeed;
        const vy = Math.sin(angle) * bulletSpeed;
        
        bullets.push(new Bullet(startX, startY, vx, vy, this.damage, true, false));
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = this.poisonTimer > 0 ? '#2ecc71' : this.color;
        ctx.fillRect(0, 0, this.w, this.h);

        ctx.fillStyle = '#f1c40f';
        if (this.isCrouching) {
            ctx.fillRect(5, 5, 30, 10);
        } else {
            ctx.fillRect(5, 10, 30, 10);
        }

        if (this.shield > 0) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.w/2, this.h/2, this.w, 0, Math.PI*2);
            ctx.stroke();
        }

        if (this.poisonTimer > 0) {
            ctx.fillStyle = '#00ff00';
            ctx.font = '12px Arial';
            ctx.fillText("POISON", 0, -10);
        }

        ctx.restore();
        
        if (!isMobile) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mousePos.x, mousePos.y, 10, 0, Math.PI*2);
            ctx.moveTo(mousePos.x - 15, mousePos.y);
            ctx.lineTo(mousePos.x + 15, mousePos.y);
            ctx.moveTo(mousePos.x, mousePos.y - 15);
            ctx.lineTo(mousePos.x, mousePos.y + 15);
            ctx.stroke();
        }
    }

    takeDamage(amount) {
        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) {
                this.hp += this.shield; 
                this.shield = 0;
            }
        } else {
            this.hp -= amount;
        }
        createParticles(this.x + this.w/2, this.y + this.h/2, 10, '#f00');
        updateHUD();
        
        if (this.hp <= 0) endGame();
    }
    
    applyPoison() {
        if (this.shield <= 0) { 
            this.poisonTimer = 300; 
            showNotification("POISONED!");
        }
    }
}

class Bullet {
    constructor(x, y, vx, vy, dmg, isPlayer, isPoison, isExplosive) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.r = isExplosive ? 10 : 5;
        this.damage = dmg;
        this.isPlayer = isPlayer;
        this.isPoison = isPoison || false;
        this.isExplosive = isExplosive || false; 
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.isExplosive) {
            if (this.y > floorY || this.x < 0 || this.x > canvas.width) {
                this.explode();
                this.active = false;
            }
        }

        if (this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50) {
            this.active = false;
        }
    }
    draw() {
        if (this.isExplosive) {
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        else if (this.isPoison) ctx.fillStyle = '#00ff00';
        else ctx.fillStyle = this.isPlayer ? '#ffff00' : '#ff0000';
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
    }

    explode() {
        createParticles(this.x, this.y, 20, '#ff4500');
        let radius = 150;
        enemies.forEach(e => {
            let dx = e.x + e.w/2 - this.x;
            let dy = e.y + e.h/2 - this.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < radius) {
                e.takeDamage(this.damage); 
            }
        });
        if (boss) {
            let dx = boss.x + boss.w/2 - this.x;
            let dy = boss.y + boss.h/2 - this.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < radius) {
                boss.takeDamage(this.damage);
            }
        }
    }
}

class Enemy {
    constructor(type) {
        this.type = type; 
        this.shield = 0; 
        
        let baseHp = 0;
        let baseSpd = 0;

        if (type === 'TANK') { 
            this.w = 60; this.h = 90;
            baseHp = 400; 
            baseSpd = 0.5; 
            this.color = '#555'; 
            this.scoreVal = 300;
        } 
        else if (type === 'POISON') { 
            this.w = 40; this.h = 70;
            baseHp = 50;
            baseSpd = 1.5;
            this.color = '#006400'; 
            this.scoreVal = 150;
        }
        else if (type === 'SHIELDED') { 
            this.w = 45; this.h = 75;
            baseHp = 80;
            this.shield = 150 + (wave * 50); 
            baseSpd = 1.2;
            this.color = '#34495e';
            this.scoreVal = 200;
        }
        else if (type === 'DRONE') {
            this.w = 30; this.h = 30;
            baseHp = 30;
            baseSpd = 2.0;
            this.color = '#e74c3c';
            this.scoreVal = 80;
        }
        else { 
            this.w = 40; this.h = 70;
            baseHp = 40;
            baseSpd = 1.0;
            this.color = '#2ecc71';
            this.scoreVal = 50;
        }

        this.hp = baseHp + (wave * 15);
        this.speed = baseSpd + (wave * 0.05);

        if (Math.random() < 0.5) {
            this.x = -50; 
            this.vx = this.speed; 
        } else {
            this.x = canvas.width + 50; 
            this.vx = -this.speed;
        }
        this.entered = false; 

        if (type === 'DRONE') {
            this.y = 50 + Math.random() * (floorY - 250);
        } else {
            this.y = floorY - this.h;
        }
        
        this.lastShot = 0;
        this.fireRate = Math.max(50, 160 - (wave * 5)); 
        this.lastShot = frames + Math.random() * 100;
    }
    
    update() {
        if (this.vx > 0) this.vx = this.speed;
        else this.vx = -this.speed;

        this.x += this.vx;

        if (!this.entered) {
            if (this.x > 0 && this.x < canvas.width - this.w) {
                this.entered = true;
            }
        } else {
            if (this.x <= 0) {
                this.vx = Math.abs(this.speed); 
            } else if (this.x >= canvas.width - this.w) {
                this.vx = -Math.abs(this.speed); 
            }
        }

        if (this.type === 'DRONE') {
            this.y += Math.sin(frames * 0.1) * 2;
        }

        if (this.x < canvas.width && this.x > 0) {
            if (frames - this.lastShot > this.fireRate) {
                this.shootSkill();
                this.lastShot = frames;
            }
        }
    }

    shootSkill() {
        let targetX = player.x + player.w/2;
        let targetY = player.y + player.h/2;
        let angle = Math.atan2(targetY - (this.y + this.h/2), targetX - this.x);
        let dmg = 10 + (wave * 2);

        if (this.type === 'TANK') {
            for(let i=-1; i<=1; i++) {
                let spreadAngle = angle + (i * 0.2);
                enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(spreadAngle)*5, Math.sin(spreadAngle)*5, dmg, false, false));
            }
        } 
        else if (this.type === 'DRONE') {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*6, Math.sin(angle)*6, dmg, false, false));
            setTimeout(() => {
                 enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*6, Math.sin(angle)*6, dmg, false, false));
            }, 200);
        }
        else if (this.type === 'POISON') {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*5, Math.sin(angle)*5, dmg, false, true));
        }
        else if (this.type === 'SHIELDED') {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*10, Math.sin(angle)*10, dmg + 5, false, false));
        }
        else {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*5, Math.sin(angle)*5, dmg, false, false));
        }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        
        if (this.type === 'DRONE') {
            ctx.beginPath();
            ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#aaa';
            ctx.fillRect(this.x, this.y-5, this.w, 5);
        } else {
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = '#fff'; 
            if (this.vx > 0) {
                ctx.fillRect(this.x + this.w - 5, this.y + 10, 10, 5); // Right
            } else {
                ctx.fillRect(this.x - 5, this.y + 10, 10, 5); // Left
            }
        }
        
        if (this.shield > 0) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w, 0, Math.PI*2);
            ctx.stroke();
        }
    }
    
    takeDamage(amount) {
        if (this.shield > 0) {
            this.shield -= amount;
            createParticles(this.x + this.w/2, this.y + this.h/2, 2, '#00ffff');
            if (this.shield < 0) {
                this.hp += this.shield; 
                this.shield = 0;
            }
        } else {
            this.hp -= amount;
            createParticles(this.x + this.w/2, this.y + this.h/2, 2, '#fff');
        }
    }
}

class Boss {
    constructor() {
        this.w = 160;
        this.h = 120;
        this.x = canvas.width + 100;
        this.y = floorY - this.h - 50; 
        
        this.maxHp = 1500 + (wave * 1000); 
        this.hp = this.maxHp;
        
        this.phase = 'ENTER'; 
        this.targetX = canvas.width - 250;
        
        weather = 'CLEAR';
        showNotification("BOSS ENGAGED - WEATHER CLEARED");
        
        if (wave % 3 === 1) {
            this.bossType = 'IRON CLAD'; 
            this.color = '#2e4053';
            this.w = 200; this.h = 150;
            this.speed = 1.0;
        } else if (wave % 3 === 2) {
            this.bossType = 'VIPER'; 
            this.color = '#c0392b';
            this.w = 120; this.h = 80;
            this.speed = 4.0;
        } else {
            this.bossType = 'NEXUS'; 
            this.color = '#8e44ad';
            this.w = 140; this.h = 140;
            this.speed = 2.0;
        }

        this.state = 'IDLE'; 
        this.timer = 0;
        this.actionTimer = 0;
        this.moveDir = -1;
        
        this.ultCharge = 0;
        this.ultMaxCharge = 1000;

        // Iron Clad
        this.hitCount = 0;
        this.isStunned = false;
        this.stunTimer = 0;
        this.isExploding = false; 
        this.explosionTimer = 0;
        this.spikeCount = 0; 

        // Viper
        this.laserAngle = 0;

        document.getElementById('boss-hud').style.display = 'block';
        document.getElementById('score-container').style.display = 'none'; 
        updateBossHUD(this.hp, this.maxHp);
    }

    update() {
        if (this.phase === 'ENTER') {
            if (this.x > this.targetX) {
                this.x -= 2; 
            } else {
                this.phase = 'ACTION';
                this.pickNextAction();
            }
            return;
        }

        if (this.bossType === 'IRON CLAD') {
            if (this.isStunned) {
                this.stunTimer--;
                if (this.stunTimer <= 0) {
                    this.isStunned = false;
                    this.hitCount = 0; 
                    this.pickNextAction();
                }
                return; 
            }

            if (this.isExploding) {
                this.explosionTimer--;
                if (this.explosionTimer <= 0) {
                    createParticles(this.x + this.w/2, this.y + this.h/2, 50, '#ff4500');
                    let centerBx = this.x + this.w/2;
                    let centerBy = this.y + this.h/2;
                    let px = player.x + player.w/2;
                    let py = player.y + player.h/2;
                    let dist = Math.sqrt((px-centerBx)**2 + (py-centerBy)**2);
                    // --- 26. Instant Death on Explosion Hit ---
                    if (dist < 200) { 
                        player.takeDamage(9999); // Instant Kill
                    }
                    
                    this.isExploding = false;
                    this.isStunned = true;
                    this.stunTimer = 300; 
                    showNotification("BOSS STUNNED! ATTACK NOW!");
                }
                return; 
            }
        }

        if (this.phase === 'ULTIMATE') {
            this.handleUltimate();
            return;
        }

        if (this.ultCharge < this.ultMaxCharge) {
            this.ultCharge += 2;
        } else {
            this.startUltimate();
            return;
        }

        this.actionTimer--;
        
        if (this.state === 'MOVE') {
            this.x += this.speed * this.moveDir;
            if (this.x <= 50) this.moveDir = 1;
            if (this.x >= canvas.width - this.w - 50) this.moveDir = -1;
            
            if (this.bossType !== 'IRON CLAD') {
                this.y = (floorY - this.h - 50) + Math.sin(frames * 0.05) * 50;
            }
        } else if (this.state === 'ATTACK') {
             if (frames % 30 === 0) this.performAttack();
        }

        if (this.actionTimer <= 0) {
            this.pickNextAction();
        }
    }

    pickNextAction() {
        let rand = Math.random();
        if (rand < 0.4) {
            this.state = 'MOVE';
            this.actionTimer = 60 + Math.random() * 120; 
            this.moveDir = (player.x < this.x) ? -1 : 1;
        } else if (rand < 0.9) {
            this.state = 'ATTACK';
            this.actionTimer = 60 + Math.random() * 60; 
        } else {
            this.state = 'IDLE'; 
            this.actionTimer = 30;
        }
    }

    performAttack() {
        let targetX = player.x + player.w/2;
        let targetY = player.y + player.h/2;
        let angle = Math.atan2(targetY - (this.y + this.h/2), targetX - this.x);
        let dmg = 15 + wave;

        if (this.bossType === 'IRON CLAD') {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*6, Math.sin(angle)*6, dmg*1.5, false));
        } else if (this.bossType === 'VIPER') {
            enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*12, Math.sin(angle)*12, dmg, false));
        } else {
             for(let i=0; i<6; i++) {
                let a = angle + (i * (Math.PI/3));
                enemyBullets.push(new Bullet(this.x + this.w/2, this.y + this.h/2, Math.cos(a)*5, Math.sin(a)*5, dmg, false));
            }
        }
    }

    startUltimate() {
        this.phase = 'ULTIMATE';
        this.ultCharge = 0; 
        
        if (this.bossType === 'IRON CLAD') {
            this.state = 'SPIKE_WARN';
            this.timer = 60; 
            this.spikeCount = 3;
            showNotification("⚠️ GROUND TREMOR DETECTED! ⚠️");
        } else if (this.bossType === 'VIPER') {
            // --- 27. Viper Windmill Laser Setup ---
            this.state = 'LASER_WINDMILL';
            this.timer = 300; // 5 Seconds
            this.laserAngle = 0;
            showNotification("⚠️ LASER SYSTEM ACTIVATED! ⚠️");
        } else {
            this.state = 'PREPARE'; 
            this.timer = 180; 
            showNotification("⚠️ WARNING: GET TO HIGH GROUND! ⚠️");
        }
    }

    handleUltimate() {
        this.timer--;

        if (this.bossType === 'IRON CLAD') {
            if (this.state === 'SPIKE_WARN') {
                if (this.timer <= 0) {
                    let spikeX = player.x;
                    let spikeY = floorY; 
                    spikes.push({ x: spikeX, y: spikeY, w: 40, h: 100, timer: 30 }); 
                    
                    this.state = 'SPIKE_COOLDOWN';
                    this.timer = 120; 
                    this.spikeCount--;
                }
            } else if (this.state === 'SPIKE_COOLDOWN') {
                if (this.timer <= 0) {
                    if (this.spikeCount > 0) {
                        this.state = 'SPIKE_WARN';
                        this.timer = 60; 
                    } else {
                        this.phase = 'ACTION';
                        this.pickNextAction();
                    }
                }
            }
            return;
        }

        // --- 27. VIPER ULT (Laser Windmill) ---
        if (this.bossType === 'VIPER') {
            this.laserAngle += 0.03; // Rotate speed
            
            // Check Hit logic periodically (every 6 frames = 10 times/sec = 10dps)
            if (frames % 6 === 0) {
                // Determine origin
                let cx = this.x + this.w/2;
                let cy = this.y + this.h/2;
                let startOffset = 10;
                let maxLen = 1000;
                
                // 5 Lasers
                for (let i = 0; i < 5; i++) {
                    let theta = this.laserAngle + (i * (Math.PI * 2 / 5));
                    
                    // Start point
                    let lx1 = cx + Math.cos(theta) * startOffset;
                    let ly1 = cy + Math.sin(theta) * startOffset;
                    
                    // End point (initially max length)
                    let lx2 = cx + Math.cos(theta) * maxLen;
                    let ly2 = cy + Math.sin(theta) * maxLen;

                    // --- Platform Collision Logic (Raycast Sim) ---
                    // Simple check: iterate platforms, intersect line-rect?
                    // To keep it performant, we just check center points or simplify
                    // A proper line intersection is better.
                    let closestDist = maxLen;
                    
                    platforms.forEach(p => {
                        // Check if line intersects platform rect. 
                        // Simplified: Check intersection with platform bounding box center/radius approx
                        // For exactness, we need proper line clipping.
                        // Let's use a simpler "midpoint" check for now or basic clipping
                        // If center of platform is close to line?
                        // Let's implement basic ray-rect intersection if possible or simple distance check
                        // For stability, let's just check if the beam passes through the player RECT first.
                        // Platform blocking is requested.
                        
                        // We will simplify: If line hits platform, cut length.
                        // Check intersection with platform edges.
                        let hit = lineRectCollide(lx1, ly1, lx2, ly2, p.x, p.y, p.w, p.h);
                        if (hit && hit.dist < closestDist) {
                            closestDist = hit.dist;
                        }
                    });

                    // Update End point based on collision
                    lx2 = cx + Math.cos(theta) * closestDist;
                    ly2 = cy + Math.sin(theta) * closestDist;

                    // Check Player Collision
                    if (lineRectCollide(lx1, ly1, lx2, ly2, player.x, player.y, player.w, player.h)) {
                        player.takeDamage(1); // 1 dmg per tick (6 frames) -> 10 dps
                    }
                }
            }

            if (this.timer <= 0) {
                this.phase = 'ACTION';
                this.pickNextAction();
            }
            return;
        }

        // NEXUS ULT
        if (this.state === 'PREPARE') {
            if (this.timer <= 0) {
                this.state = 'EXECUTE';
                this.timer = 300; 
                showNotification("🔥 FLOOR IS DEADLY! 🔥");
            }
        } else if (this.state === 'EXECUTE') {
            if (player.y + player.h >= floorY - 10) {
                if (frames % 10 === 0) { 
                    player.takeDamage(10);
                    createParticles(player.x, player.y + player.h, 5, '#ff0000');
                }
            }
            if (this.timer <= 0) {
                this.phase = 'ACTION';
                this.ultCharge = 0;
                this.pickNextAction();
                showNotification("SAFE TO DESCEND");
            }
        }
    }

    draw() {
        if (this.phase === 'ULTIMATE') {
            ctx.save();
            
            if (this.bossType === 'IRON CLAD' && this.state === 'SPIKE_WARN') {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.fillRect(player.x - 20, floorY - 10, player.w + 40, 10);
                ctx.fillRect(player.x, floorY - 200, player.w, 200);
            }
            // --- 27. Draw Viper Lasers ---
            else if (this.bossType === 'VIPER') {
                let cx = this.x + this.w/2;
                let cy = this.y + this.h/2;
                let startOffset = 10;
                let maxLen = 1000;

                ctx.lineWidth = 30; // 30px Width
                ctx.lineCap = 'round';
                
                for (let i = 0; i < 5; i++) {
                    let theta = this.laserAngle + (i * (Math.PI * 2 / 5));
                    let lx1 = cx + Math.cos(theta) * startOffset;
                    let ly1 = cy + Math.sin(theta) * startOffset;
                    let lx2 = cx + Math.cos(theta) * maxLen;
                    let ly2 = cy + Math.sin(theta) * maxLen;

                    // Re-calc collision for drawing length
                    let closestDist = maxLen;
                    platforms.forEach(p => {
                        let hit = lineRectCollide(lx1, ly1, lx2, ly2, p.x, p.y, p.w, p.h);
                        if (hit && hit.dist < closestDist) {
                            closestDist = hit.dist;
                        }
                    });
                    
                    lx2 = cx + Math.cos(theta) * closestDist;
                    ly2 = cy + Math.sin(theta) * closestDist;

                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'; // Outer glow
                    ctx.beginPath();
                    ctx.moveTo(lx1, ly1);
                    ctx.lineTo(lx2, ly2);
                    ctx.stroke();
                    
                    ctx.lineWidth = 10; // Inner core
                    ctx.strokeStyle = '#fff';
                    ctx.beginPath();
                    ctx.moveTo(lx1, ly1);
                    ctx.lineTo(lx2, ly2);
                    ctx.stroke();
                    ctx.lineWidth = 30; // Reset for next
                }
            }
            else if (this.bossType === 'NEXUS') {
                if (this.state === 'PREPARE') {
                    ctx.fillStyle = (Math.floor(frames / 10) % 2 === 0) ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.3)';
                    ctx.fillRect(0, floorY - 10, canvas.width, 100);
                } else if (this.state === 'EXECUTE') {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; 
                    ctx.fillRect(0, floorY - 10, canvas.width, 100);
                }
            }
            ctx.restore();
        }

        // Draw Spikes
        ctx.fillStyle = '#5d4037'; 
        for (let i = spikes.length - 1; i >= 0; i--) {
            let s = spikes[i];
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x + s.w/2, s.y - s.h); 
            ctx.lineTo(s.x + s.w, s.y);
            ctx.fill();
            
            s.timer--;
            if (s.timer > 0) {
                if (player.x < s.x + s.w && player.x + player.w > s.x &&
                    player.y + player.h > s.y - s.h) {
                    player.takeDamage(20);
                }
            } else {
                spikes.splice(i, 1);
            }
        }

        if (this.bossType === 'IRON CLAD' && this.isExploding) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.w/2, this.y + this.h/2, 200, 0, Math.PI*2); 
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = this.isStunned ? '#999' : this.color; 
        if (this.bossType === 'VIPER') {
            ctx.beginPath();
            ctx.moveTo(this.x + this.w/2, this.y);
            ctx.lineTo(this.x + this.w, this.y + this.h);
            ctx.lineTo(this.x, this.y + this.h);
            ctx.closePath();
            ctx.fill();
        } else if (this.bossType === 'NEXUS') {
            ctx.beginPath();
            ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = '#566573';
            ctx.fillRect(this.x - 10, this.y + 20, 10, this.h - 40);
        }

        if (this.isStunned) {
            ctx.fillStyle = 'yellow';
            ctx.font = '20px Arial';
            ctx.fillText("STUNNED!", this.x, this.y - 10);
        }

        if (this.phase !== 'ULTIMATE') {
            let hpPct = this.ultCharge / this.ultMaxCharge;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x, this.y - 20, this.w, 10);
            ctx.fillStyle = '#f1c40f'; 
            ctx.fillRect(this.x, this.y - 20, this.w * hpPct, 10);
        } else {
             ctx.fillStyle = '#fff';
             ctx.font = 'bold 20px Arial';
             ctx.fillText("ULTIMATE ACTIVE!", this.x, this.y - 30);
        }
    }

    takeDamage(amount) {
        if (this.bossType === 'IRON CLAD') {
            if (this.isStunned) {
                amount = 50; 
            } else {
                if (amount > 20) amount = 20; 
                this.hitCount++;
                if (this.hitCount >= 30 && !this.isExploding) {
                    this.isExploding = true;
                    this.explosionTimer = 120; 
                    showNotification("BOSS OVERHEATING! GET BACK!");
                }
            }
        }

        this.hp -= amount;
        updateBossHUD(this.hp, this.maxHp);
        createParticles(this.x + Math.random()*this.w, this.y + Math.random()*this.h, 5, '#fff');
        
        if (this.hp <= 0) {
            createParticles(this.x + this.w/2, this.y + this.h/2, 100, '#ffa500'); 
            boss = null;
            score += 1000 + (wave * 500);
            wave++;
            
            items.push(new Item(this.x, floorY - 30, 'HEAL'));
            items.push(new Item(this.x + 40, floorY - 30, 'SCORE'));
            items.push(new Item(this.x + 80, floorY - 30, 'MAXHP'));

            document.getElementById('boss-hud').style.display = 'none';
            document.getElementById('score-container').style.display = 'block';
            updateHUD();
            announceWave(wave);
            initWave(); 
        }
    }
}

// --- Helper: Line to Rect Collision for Laser ---
function lineRectCollide(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Check if line intersects any of the 4 lines of the rect
    // Top
    let u1 = lineLine(x1, y1, x2, y2, rx, ry, rx+rw, ry);
    // Bottom
    let u2 = lineLine(x1, y1, x2, y2, rx, ry+rh, rx+rw, ry+rh);
    // Left
    let u3 = lineLine(x1, y1, x2, y2, rx, ry, rx, ry+rh);
    // Right
    let u4 = lineLine(x1, y1, x2, y2, rx+rw, ry, rx+rw, ry+rh);

    let minU = 1.0;
    if (u1 && u1 < minU) minU = u1;
    if (u2 && u2 < minU) minU = u2;
    if (u3 && u3 < minU) minU = u3;
    if (u4 && u4 < minU) minU = u4;

    if (minU < 1.0) {
        // Calculate distance
        let dx = x2 - x1;
        let dy = y2 - y1;
        let dist = Math.sqrt(dx*dx + dy*dy) * minU;
        return { dist: dist };
    }
    return null;
}

function lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    let uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    let uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
        return uA;
    }
    return null;
}

class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.w = 30;
        this.h = 30;
        this.type = type; 
        this.vy = 0;
        this.grounded = false;
        
        if (type === 'HEAL') this.color = '#2ecc71'; 
        if (type === 'UPGRADE') this.color = '#e67e22'; 
        if (type === 'SHIELD') this.color = '#3498db'; 
        if (type === 'SCORE') this.color = '#f1c40f'; 
        if (type === 'MAXHP') this.color = '#9b59b6'; 
        if (type === 'FIRERATE') this.color = '#00e5ff';
    }
    update() {
        if (!this.grounded) {
            this.vy += gravity;
            this.y += this.vy;
            if (this.y + this.h > floorY) {
                this.y = floorY - this.h;
                this.vy = 0;
                this.grounded = true;
            }
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(this.type.substring(0,3), this.x + 2, this.y + 20);
        
        if (!this.grounded) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + 15, this.y - 30);
            ctx.lineTo(this.x + 30, this.y);
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y - 30, 15, Math.PI, 0);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}

// --- Systems ---

function createParticles(x, y, count, color) {
    for(let i=0; i<count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnSystem() {
    if (boss) return;

    if (spawnConfig.soldier.count < spawnConfig.soldier.max) {
        spawnConfig.soldier.timer--;
        if (spawnConfig.soldier.timer <= 0) {
            enemies.push(new Enemy('SOLDIER'));
            spawnConfig.soldier.count++;
            spawnConfig.soldier.timer = 60 + Math.random() * 120; 
        }
    }

    if (spawnConfig.drone.count < spawnConfig.drone.max) {
        spawnConfig.drone.timer--;
        if (spawnConfig.drone.timer <= 0) {
            enemies.push(new Enemy('DRONE'));
            spawnConfig.drone.count++;
            spawnConfig.drone.timer = 180 + Math.random() * 120; 
        }
    }

    if (spawnConfig.tank.count < spawnConfig.tank.max) {
        spawnConfig.tank.timer--;
        if (spawnConfig.tank.timer <= 0) {
            enemies.push(new Enemy('TANK'));
            spawnConfig.tank.count++;
            spawnConfig.tank.timer = 600; 
        }
    }

    if (spawnConfig.poison.count < spawnConfig.poison.max) {
        spawnConfig.poison.timer--;
        if (spawnConfig.poison.timer <= 0) {
            enemies.push(new Enemy('POISON'));
            spawnConfig.poison.count++;
            spawnConfig.poison.timer = 240; 
        }
    }

    if (spawnConfig.shield.count < spawnConfig.shield.max) {
        spawnConfig.shield.timer--;
        if (spawnConfig.shield.timer <= 0) {
            enemies.push(new Enemy('SHIELDED'));
            spawnConfig.shield.count++;
            spawnConfig.shield.timer = 720; 
        }
    }
}

function spawnSpecialEvents() {
    if (boss) return;

    if (frames > 0 && frames % 900 === 0) { 
        let rand = Math.random();
        let type = 'SCORE';
        
        if (rand < 0.35) {
            if (healDropsInWave < 8) {
                type = 'HEAL';
                healDropsInWave++;
            } else {
                type = 'SCORE';
            }
        } else if (rand < 0.70) {
            type = 'SHIELD';
        } else if (rand < 0.90) {
            if (fireRateDropsInWave < 2) {
                type = 'FIRERATE';
                fireRateDropsInWave++;
            } else {
                type = 'SCORE';
            }
        }
        
        let x = 50 + Math.random() * (canvas.width - 100);
        items.push(new Item(x, -50, type));
        showNotification("SUPPLIES INCOMING!");
    }

    if (upgradeSchedule.includes(waveTimer)) {
         let x = 50 + Math.random() * (canvas.width - 100);
         items.push(new Item(x, -50, 'UPGRADE'));
         showNotification("WEAPON DROP!");
    }
}

function handleWeather() {
    let cycle = frames % weatherCycleLength; 
    
    if (cycle === 600) { 
        let r = Math.random();
        weatherInitFrame = frames;
        if (r < 0.33) weather = 'ACID_RAIN';
        else if (r < 0.66) weather = 'THUNDERSTORM';
        else weather = 'LAVA';
        
        showNotification("WARNING: " + weather + " DETECTED!");
        lightningStrikes = [];
    } else if (cycle === 0) { 
        weather = 'CLEAR';
        showNotification("WEATHER CLEARED");
    }

    if (weather === 'ACID_RAIN') {
        ctx.strokeStyle = '#a569bd'; 
        ctx.lineWidth = 2;
        for (let i = 0; i < 15; i++) {
            let rx = Math.random() * canvas.width;
            let ry = Math.random() * canvas.height;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 5, ry + 20);
            ctx.stroke();
        }
        if (frames % 12 === 0) { 
            let isSheltered = false;
            let pCenter = player.x + player.w/2;
            platforms.forEach(p => {
                if (pCenter > p.x && pCenter < p.x + p.w && player.y > p.y) isSheltered = true;
            });
            if (!isSheltered) {
                player.takeDamage(1); 
                createParticles(player.x + player.w/2, player.y, 1, '#a569bd'); 
            }
        }
    } 
    
    else if (weather === 'THUNDERSTORM') {
        if (frames % 60 === 0) {
            let pCenter = player.x + player.w / 2;
            let offset = 10 + Math.random() * 10; 
            let dir = Math.random() < 0.5 ? -1 : 1;
            let strikeX = pCenter + (offset * dir);

            if (strikeX < 20) strikeX = 20;
            if (strikeX > canvas.width - 20) strikeX = canvas.width - 20;

            lightningStrikes.push({ x: strikeX, timer: 18, state: 'WARN' }); 
        }

        for (let i = lightningStrikes.length - 1; i >= 0; i--) {
            let s = lightningStrikes[i];
            s.timer--;
            
            if (s.state === 'WARN') {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.fillRect(s.x - 20, 0, 40, canvas.height);
                
                if (s.timer <= 0) {
                    s.state = 'STRIKE';
                    s.timer = 10; 
                    if (player.x < s.x + 20 && player.x + player.w > s.x - 20) {
                        player.takeDamage(30); 
                        showNotification("ZAPPED!");
                    }
                }
            } else if (s.state === 'STRIKE') {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(s.x, 0);
                ctx.lineTo(s.x + (Math.random()-0.5)*20, canvas.height/2);
                ctx.lineTo(s.x, canvas.height);
                ctx.stroke();
                
                if (s.timer <= 0) lightningStrikes.splice(i, 1);
            }
        }
    } 
    
    else if (weather === 'LAVA') {
        let activeTime = frames - weatherInitFrame;
        
        if (activeTime > 60) {
            let lavaH = 110; 
            let currentLavaY = floorY - lavaH;
            
            ctx.fillStyle = 'rgba(255, 69, 0, 0.8)';
            ctx.fillRect(0, currentLavaY, canvas.width, lavaH);
            
            if (player.y + player.h > currentLavaY + 10) {
                if (frames % 45 === 0) { 
                    player.takeDamage(60); 
                }
            }
        }
    } 
}

function checkCollisions() {
    // --- 23. Add Ult Gain on Kill Logic ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (!b.active) continue;

        if (boss && b.isPlayer) {
            if (b.x > boss.x && b.x < boss.x + boss.w &&
                b.y > boss.y && b.y < boss.y + boss.h) {
                boss.takeDamage(player.damage);
                b.active = false;
                createParticles(b.x, b.y, 3, '#ffa');
                continue;
            }
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (b.isPlayer && b.x > e.x && b.x < e.x + e.w &&
                b.y > e.y && b.y < e.y + e.h) {
                
                e.takeDamage(player.damage); 
                
                if (!b.isExplosive) b.active = false; // Explo bullets don't vanish on 1 hit
                
                if (e.hp <= 0) {
                    if (Math.random() < 0.15) { 
                         items.push(new Item(e.x, e.y, 'HEAL'));
                    }
                    enemies.splice(j, 1);
                    score += e.scoreVal;
                    // Gain Ult Charge on Kill
                    player.gainUlt(player.killUltGain);
                }
                break;
            }
        }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let b = enemyBullets[i];
        if (b.x > player.x && b.x < player.x + player.w &&
            b.y > player.y && b.y < player.y + player.h) {
            
            player.takeDamage(b.damage);
            if (b.isPoison) player.applyPoison(); 
            
            b.active = false;
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        if (player.x < it.x + it.w && player.x + player.w > it.x &&
            player.y < it.y + it.h && player.y + player.h > it.y) {
            
            if (it.type === 'HEAL') { player.hp = Math.min(player.hp + 30, player.maxHp); showNotification("HEALED!"); }
            if (it.type === 'UPGRADE') { player.damage += 5; player.gunLevel++; showNotification("WEAPON UPGRADE!"); }
            if (it.type === 'SHIELD') { player.shield = 50; showNotification("SHIELD EQUIPPED!"); }
            if (it.type === 'SCORE') { score += 500; }
            if (it.type === 'MAXHP') { player.maxHp += 5; player.hp += 5; showNotification("MAX HP INCREASED!"); }
            if (it.type === 'FIRERATE') { 
                player.fireRate = Math.max(5, player.fireRate - 5); 
                showNotification("RAPID FIRE!"); 
            }
            
            items.splice(i, 1);
            updateHUD();
        }
    }
}

function updateHUD() {
    document.getElementById('hp-text').innerText = Math.ceil(player.hp);
    document.getElementById('hp-bar').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    document.getElementById('shield-bar').style.width = player.shield + '%'; 
    document.getElementById('score').innerText = score;
    document.getElementById('gun-level').innerText = player.gunLevel;
    document.getElementById('gun-dmg').innerText = player.damage;
    
    if (boss) {
         document.getElementById('wave-display').innerText = `BOSS: ${boss.bossType}`;
         document.getElementById('wave-display').style.color = 'red';
    } else {
         let timeLeft = Math.ceil(waveTimer / 60);
         document.getElementById('wave-display').innerText = `WAVE ${wave} (${timeLeft}s)`;
         document.getElementById('wave-display').style.color = 'white';
    }
}

function updateBossHUD(hp, max) {
    document.getElementById('boss-hp-text').innerText = `${Math.ceil(hp)}/${max}`;
    document.getElementById('boss-hp-bar').style.width = Math.max(0, (hp / max) * 100) + '%';
}

function showNotification(text) {
    const el = document.getElementById('notification');
    el.innerText = text;
    el.style.opacity = 1;
    setTimeout(() => { el.style.opacity = 0; }, 2000);
}

function announceWave(newWave) {
    const el = document.getElementById('wave-announcement');
    el.innerText = `WAVE ${newWave}`;
    el.classList.remove('animate-wave');
    void el.offsetWidth; 
    el.classList.add('animate-wave');
}

// --- Main Loop (FPS Locked) ---

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    requestAnimationFrame(gameLoop);

    let now = Date.now();
    elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        frames++;
        
        if (!boss) {
            waveTimer--;
            if (waveTimer <= 0) {
                boss = new Boss();
                showNotification("WARNING: BOSS SPAWNED!");
            }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grd.addColorStop(0, "#2c3e50");
        grd.addColorStop(1, "#4a235a");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        platforms.forEach(p => p.draw());

        ctx.fillStyle = '#212f3c';
        ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

        player.update();
        player.draw();

        bullets.forEach((b, i) => {
            b.update();
            b.draw();
            if (!b.active) bullets.splice(i, 1);
        });

        enemyBullets.forEach((b, i) => {
            b.update();
            b.draw();
            if (!b.active) enemyBullets.splice(i, 1);
        });

        enemies.forEach((e, i) => {
            e.update();
            e.draw();
            if (e.x < -100 && e.x > canvas.width + 100) { 
               // Cleanup
            }
        });

        items.forEach(it => { it.update(); it.draw(); });

        particles.forEach((p, i) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(i, 1);
        });

        if (boss) {
            boss.update();
            boss.draw();
        } else {
            // --- 17. Use Spawn System ---
            spawnSystem();
        }

        spawnSpecialEvents(); 
        handleWeather();
        checkCollisions();
        updateHUD();

        keys_last.space = keys.space;
        keys_last.s = keys.s;
        keys_last.ult = keys.ult; // Track ult key
    }
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('high-score').innerText = highScore;

    gameState = 'PLAYING';
    then = Date.now();
    score = 0;
    wave = 1;
    frames = 0; 
    player = new Player();
    bullets = [];
    enemies = [];
    enemyBullets = [];
    items = [];
    platforms = [];
    boss = null;
    weather = 'CLEAR';
    enemySpawnTimer = 0;
    spikes = [];
    
    // --- Responsive Platform Layout ---
    let w = canvas.width;
    
    // Left Zone
    platforms.push(new Platform(w * 0.05, floorY - 120, 180)); 
    platforms.push(new Platform(w * 0.02, floorY - 350, 250));
    platforms.push(new Platform(w * 0.08, floorY - 520, 150));
    
    // Middle Zone
    platforms.push(new Platform(w * 0.35, floorY - 220, 200));
    platforms.push(new Platform(w * 0.50, floorY - 420, 180));
    platforms.push(new Platform(w * 0.45, floorY - 600, 150));
    
    // Right Zone
    platforms.push(new Platform(w * 0.70, floorY - 300, 200));
    platforms.push(new Platform(w * 0.82, floorY - 500, 180));
    platforms.push(new Platform(w * 0.75, floorY - 150, 180)); 

    document.getElementById('boss-hud').style.display = 'none';
    document.getElementById('score-container').style.display = 'block';

    initWave(); 
    updateHUD();
    gameLoop();
}

function endGame() {
    gameState = 'GAMEOVER';
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sf_highscore', highScore);
    }
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function resetGame() {
    startGame();
}
