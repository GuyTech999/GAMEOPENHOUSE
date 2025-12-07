/**
 * CORE GAME ENGINE
 * Soldier Frontline: Operation Survival (Max HP & Enemy Movement Update)
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
const WAVE_DURATION = 40 * 60; // 40 วินาที
let waveTimer = WAVE_DURATION;
let healDropsInWave = 0; 

// Schedules
let upgradeSchedule = []; 
let tankSchedule = [];      
let shieldEnemySchedule = []; 

// Environment
let gravity = 0.6;
let floorY = 0;

// Weather
let weather = 'CLEAR'; 
const weatherCycleLength = 900; 

// Entities
let player;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let items = [];
let platforms = []; 
let boss = null;

// Spawn Timers
let enemySpawnTimer = 0;

// Inputs
const mousePos = { x: 0, y: 0 };
const keys = {
    a: false, d: false, w: false, s: false, space: false, mouse: false
};
const keys_last = {
    a: false, d: false, w: false, s: false, space: false, mouse: false
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
});
window.addEventListener('keyup', e => {
    if(e.key === 'a' || e.key === 'A') keys.a = false;
    if(e.key === 'd' || e.key === 'D') keys.d = false;
    if(e.key === 's' || e.key === 'S') keys.s = false; 
    if(e.key === 'w' || e.key === 'W' || e.key === ' ') keys.space = false;
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
}

// --- Wave Init Function ---
function initWave() {
    waveTimer = WAVE_DURATION;
    upgradeSchedule = [];
    tankSchedule = [];
    shieldEnemySchedule = [];
    healDropsInWave = 0; 
    
    // 1. สุ่มเวลา Drop ปืน (3 ครั้ง)
    for (let i = 0; i < 3; i++) {
        upgradeSchedule.push(randomFrameInWave());
    }

    // 2. Wave 2+: Tank Enemy (3 ตัว)
    if (wave >= 2) {
        for (let i = 0; i < 3; i++) {
            tankSchedule.push(randomFrameInWave());
        }
    }

    // 3. Wave 5+: Shield Enemy (4 ตัว)
    if (wave >= 5) {
        for (let i = 0; i < 4; i++) {
            shieldEnemySchedule.push(randomFrameInWave());
        }
    }
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
    }

    update() {
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
            this.poisonTimer = 600; 
            showNotification("POISONED!");
        }
    }
}

class Bullet {
    constructor(x, y, vx, vy, dmg, isPlayer, isPoison) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.r = 5;
        this.damage = dmg;
        this.isPlayer = isPlayer;
        this.isPoison = isPoison || false;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50) {
            this.active = false;
        }
    }
    draw() {
        if (this.isPoison) ctx.fillStyle = '#00ff00';
        else ctx.fillStyle = this.isPlayer ? '#ffff00' : '#ff0000';
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy {
    constructor(type) {
        this.type = type; 
        this.shield = 0; 
        
        // --- Stat Configuration ---
        let baseHp = 0;
        let baseSpd = 0;

        if (type === 'TANK') { 
            this.w = 60; this.h = 90;
            baseHp = 200; 
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
        else { // SOLDIER
            this.w = 40; this.h = 70;
            baseHp = 40;
            baseSpd = 1.0;
            this.color = '#2ecc71';
            this.scoreVal = 50;
        }

        this.hp = baseHp + (wave * 15);
        this.speed = baseSpd + (wave * 0.05);

        // --- 12. Spawn Random Left/Right & Movement Logic ---
        if (Math.random() < 0.5) {
            // Spawn Left
            this.x = -50; 
            this.vx = this.speed; 
        } else {
            // Spawn Right
            this.x = canvas.width + 50; 
            this.vx = -this.speed;
        }
        this.entered = false; // flag to check if entered screen

        // Spawn Y Position
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
        // --- 12. Movement Update with Bounce ---
        this.x += this.vx;

        // Check entry
        if (!this.entered) {
            if (this.x > 0 && this.x < canvas.width - this.w) {
                this.entered = true;
            }
        } else {
            // Bounce logic
            if (this.x <= 0) {
                this.vx = Math.abs(this.speed); // Go Right
            } else if (this.x >= canvas.width - this.w) {
                this.vx = -Math.abs(this.speed); // Go Left
            }
        }

        // Drone movement pattern
        if (this.type === 'DRONE') {
            this.y += Math.sin(frames * 0.1) * 2;
        }

        // Shooting
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
            
            // Gun direction
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
        
        if (wave % 3 === 1) {
            this.bossType = 'TANK'; 
            this.color = '#8e44ad';
        } else if (wave % 3 === 2) {
            this.bossType = 'SPEED'; 
            this.color = '#c0392b';
        } else {
            this.bossType = 'OVERLORD'; 
            this.color = '#2c3e50';
        }

        document.getElementById('boss-hud').style.display = 'block';
        document.getElementById('score-container').style.display = 'none'; 
        updateBossHUD(this.hp, this.maxHp);
    }
    update() {
        if (this.phase === 'ENTER') {
            if (this.x > this.targetX) {
                this.x -= 2; 
            } else {
                this.phase = 'ATTACK';
            }
        } else if (this.phase === 'ATTACK') {
            let floatSpeed = this.bossType === 'SPEED' ? 0.1 : 0.03;
            this.y = (floorY - this.h - 50) + Math.sin(frames * floatSpeed) * 80; 

            let attackRate = this.bossType === 'SPEED' ? 60 : 100;
            
            if (frames % attackRate === 0) { 
                let angle = Math.atan2((player.y + player.h/2) - (this.y + this.h/2), (player.x + player.w/2) - this.x);
                let bSpeed = this.bossType === 'SPEED' ? 8 : 5;
                let dmg = 20 + wave;
                enemyBullets.push(new Bullet(this.x, this.y + this.h/2, Math.cos(angle)*bSpeed, Math.sin(angle)*bSpeed, dmg, false));
            }

            if (frames % (attackRate * 2) === 0) {
                if (this.bossType === 'OVERLORD') {
                    for(let i=0; i<8; i++) {
                        let a = (Math.PI*2 / 8) * i;
                        enemyBullets.push(new Bullet(this.x + this.w/2, this.y + this.h/2, Math.cos(a)*5, Math.sin(a)*5, 15, false));
                    }
                } else {
                    for(let i=-1; i<=1; i++) {
                         enemyBullets.push(new Bullet(this.x, this.y + this.h/2, -5, i * 2, 15, false));
                    }
                }
            }
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + 20, this.y + 30, 40, 10);
        ctx.fillRect(this.x + this.w - 60, this.y + 30, 40, 10);
        
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(this.x + this.w/2, this.y + this.h/2 + 20, 20, 0, Math.PI*2);
        ctx.fill();
    }
    takeDamage(amount) {
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
            
            // --- 13. MAX HP Drop (Boss Only) ---
            items.push(new Item(this.x + 80, floorY - 30, 'MAXHP'));

            document.getElementById('boss-hud').style.display = 'none';
            document.getElementById('score-container').style.display = 'block';
            updateHUD();
            
            announceWave(wave);
            initWave(); 
        }
    }
}

class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.w = 30;
        this.h = 30;
        this.type = type; // HEAL, UPGRADE, SHIELD, SCORE, MAXHP
        this.vy = 0;
        this.grounded = false;
        
        if (type === 'HEAL') this.color = '#2ecc71'; 
        if (type === 'UPGRADE') this.color = '#e67e22'; 
        if (type === 'SHIELD') this.color = '#3498db'; 
        if (type === 'SCORE') this.color = '#f1c40f'; 
        if (type === 'MAXHP') this.color = '#9b59b6'; // Purple for Max HP
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

function spawnEnemy() {
    if (boss) return; 
    enemySpawnTimer--;
    
    if (enemySpawnTimer <= 0) {
        let types = ['SOLDIER'];
        if (wave >= 1) types.push('DRONE');
        if (wave >= 2) types.push('TANK');
        if (wave >= 3) types.push('POISON');
        if (wave >= 5) types.push('SHIELDED');
        
        let type = types[Math.floor(Math.random() * types.length)];
        enemies.push(new Enemy(type));
        
        let baseDelay = Math.max(40, 180 - (wave * 5)); 
        enemySpawnTimer = baseDelay + Math.random() * 60; 
    }
}

function spawnSpecialEvents() {
    if (boss) return;

    // 1. General Airdrop
    if (frames > 0 && frames % 900 === 0) { 
        let rand = Math.random();
        let type = 'SCORE';
        
        if (rand < 0.4) {
            if (healDropsInWave < 8) {
                type = 'HEAL';
                healDropsInWave++;
            } else {
                type = 'SCORE';
            }
        } else if (rand < 0.8) {
            type = 'SHIELD';
        }
        
        let x = 50 + Math.random() * (canvas.width - 100);
        items.push(new Item(x, -50, type));
        showNotification("SUPPLIES INCOMING!");
    }

    // 2. Scheduled UPGRADE Airdrop
    if (upgradeSchedule.includes(waveTimer)) {
         let x = 50 + Math.random() * (canvas.width - 100);
         items.push(new Item(x, -50, 'UPGRADE'));
         showNotification("WEAPON DROP!");
    }

    // 3. Scheduled TANK Enemy
    if (tankSchedule.includes(waveTimer)) {
        enemies.push(new Enemy('TANK'));
        showNotification("HEAVY ENEMY!");
    }

    // 4. Scheduled SHIELD Enemy
    if (shieldEnemySchedule.includes(waveTimer)) {
        enemies.push(new Enemy('SHIELDED'));
        showNotification("SHIELDED UNIT!");
    }
}

function handleWeather() {
    let cycle = frames % weatherCycleLength; 
    if (cycle > 600) {
        if (weather !== 'ACID_RAIN') {
            weather = 'ACID_RAIN';
            showNotification("WARNING: ACID RAIN!");
        }
    } else {
        if (weather !== 'CLEAR') {
            weather = 'CLEAR';
            showNotification("WEATHER CLEARED");
        }
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

        if (frames % 60 === 0) {
            let isSheltered = false;
            let pCenter = player.x + player.w/2;
            platforms.forEach(p => {
                if (pCenter > p.x && pCenter < p.x + p.w && player.y > p.y) {
                    isSheltered = true;
                }
            });

            if (!isSheltered) {
                player.takeDamage(2);
                createParticles(player.x + player.w/2, player.y, 3, '#a569bd'); 
            }
        }
    }
}

function checkCollisions() {
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
                
                b.active = false;
                if (e.hp <= 0) {
                    // Enemy Drop Item Logic (Only HEAL)
                    if (Math.random() < 0.15) { 
                         items.push(new Item(e.x, e.y, 'HEAL'));
                    }

                    enemies.splice(j, 1);
                    score += e.scoreVal;
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
            
            // Item Effects Update
            if (it.type === 'HEAL') { player.hp = Math.min(player.hp + 30, player.maxHp); showNotification("HEALED!"); }
            if (it.type === 'UPGRADE') { player.damage += 5; player.gunLevel++; showNotification("WEAPON UPGRADE!"); }
            if (it.type === 'SHIELD') { player.shield = 50; showNotification("SHIELD EQUIPPED!"); }
            if (it.type === 'SCORE') { score += 500; }
            if (it.type === 'MAXHP') { player.maxHp += 5; player.hp += 5; showNotification("MAX HP INCREASED!"); }
            
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
         document.getElementById('wave-display').innerText = `WAVE ${wave} (BOSS!)`;
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
                // Cleanup out of bounds if really far, but normal movement bounces back
                // We leave this mostly empty or specific cleanup logic
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
            spawnEnemy();
        }

        spawnSpecialEvents(); 
        handleWeather();
        checkCollisions();
        updateHUD();

        keys_last.space = keys.space;
        keys_last.s = keys.s;
    }
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
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
