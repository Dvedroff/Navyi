// === НАВЬ: Последний Факел — Игровой движок ===
import { CFG } from './CFG';

// === Шина событий ===
type Handler = (...args: any[]) => void;
export class Bus {
  private handlers: Map<string, Set<Handler>> = new Map();
  on(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
  }
  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
  }
  emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach(fn => { try { fn(...args); } catch(e) { console.error(e); } });
  }
}

// === Кэш-спрайты ===
export class Sprites {
  lightSprite: HTMLCanvasElement | null = null;
  torchGlow: HTMLCanvasElement | null = null;
  eyeSprite: HTMLCanvasElement | null = null;
  glowBody: HTMLCanvasElement | null = null;

  build() {
    // Спрайт света (радиальный градиент)
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.lightSprite = c;

    // Тёплый подкрас факела
    const tc = document.createElement('canvas');
    tc.width = tc.height = 128;
    const tctx = tc.getContext('2d')!;
    const tg = tctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    tg.addColorStop(0, 'rgba(200,140,50,0.3)');
    tg.addColorStop(0.5, 'rgba(160,100,30,0.1)');
    tg.addColorStop(1, 'rgba(100,60,20,0)');
    tctx.fillStyle = tg;
    tctx.fillRect(0, 0, 128, 128);
    this.torchGlow = tc;

    // Глаза навьи
    const ec = document.createElement('canvas');
    ec.width = ec.height = 16;
    const ectx = ec.getContext('2d')!;
    const eg = ectx.createRadialGradient(8, 8, 0, 8, 8, 8);
    eg.addColorStop(0, 'rgba(180,200,140,0.9)');
    eg.addColorStop(0.4, 'rgba(120,160,80,0.5)');
    eg.addColorStop(1, 'rgba(60,80,40,0)');
    ectx.fillStyle = eg;
    ectx.fillRect(0, 0, 16, 16);
    this.eyeSprite = ec;

    // Glow-тело для паука
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gctx = gc.getContext('2d')!;
    const gg = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(120,180,160,0.15)');
    gg.addColorStop(0.4, 'rgba(80,140,120,0.08)');
    gg.addColorStop(1, 'rgba(40,80,60,0)');
    gctx.fillStyle = gg;
    gctx.fillRect(0, 0, 128, 128);
    this.glowBody = gc;
  }
}

// === Ввод (клавиатура + тач) ===
export class Input {
  keys: Set<string> = new Set();
  moveX = 0;
  moveY = 0;
  running = false;
  flarePressed = false;
  touchActive = false;
  touchJoyX = 0;
  touchJoyY = 0;
  touchFlare = false;
  private touchId: number | null = null;
  private joyCenter = { x: 0, y: 0 };

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyF') this.flarePressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = false;
    });
    // Touch
    const el = document.getElementById('game-canvas');
    if (el) {
      el.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      el.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      el.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    }
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault();
    this.touchActive = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth * 0.5) {
        this.touchId = t.identifier;
        this.joyCenter = { x: t.clientX, y: t.clientY };
      } else {
        this.touchFlare = true;
      }
    }
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        const dx = t.clientX - this.joyCenter.x;
        const dy = t.clientY - this.joyCenter.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = 50;
        if (dist > 0) {
          const clamped = Math.min(dist, maxDist);
          this.touchJoyX = (dx / dist) * (clamped / maxDist);
          this.touchJoyY = (dy / dist) * (clamped / maxDist);
        }
        this.running = dist > maxDist * 0.7;
      }
    }
  }

  private onTouchEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        this.touchId = null;
        this.touchJoyX = 0;
        this.touchJoyY = 0;
        this.touchActive = false;
        this.running = false;
      } else {
        this.touchFlare = false;
      }
    }
  }

  update() {
    // Клавиатура
    let kx = 0, ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;

    // Тач
    if (this.touchActive) {
      kx += this.touchJoyX;
      ky += this.touchJoyY;
    }

    // Нормализация
    const len = Math.sqrt(kx*kx + ky*ky);
    if (len > 0) {
      this.moveX = kx / len;
      this.moveY = ky / len;
    } else {
      this.moveX = 0;
      this.moveY = 0;
    }

    // Вспышка из тача
    if (this.touchFlare) {
      this.flarePressed = true;
      this.touchFlare = false;
    }
  }

  consumeFlare(): boolean {
    if (this.flarePressed) {
      this.flarePressed = false;
      return true;
    }
    return false;
  }
}

// === Камера ===
export class Camera {
  x = 0;
  y = 0;
  shakeX = 0;
  shakeY = 0;
  shakeMag = 0;

  follow(tx: number, ty: number, mapW: number, mapH: number, viewW: number, viewH: number) {
    const targetX = tx - viewW / 2;
    const targetY = ty - viewH / 2;
    this.x += (targetX - this.x) * CFG.CAM_SMOOTH;
    this.y += (targetY - this.y) * CFG.CAM_SMOOTH;
    // Кламп к границам
    this.x = Math.max(0, Math.min(this.x, mapW - viewW));
    this.y = Math.max(0, Math.min(this.y, mapH - viewH));
  }

  shake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  update() {
    if (this.shakeMag > 0.5) {
      this.shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeMag * 2;
      this.shakeMag *= CFG.CAM_SHAKE_DECAY;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeMag = 0;
    }
  }
}

// === Карта ===
interface Room { x: number; y: number; w: number; h: number; }

export class GameMap {
  grid: Uint8Array = new Uint8Array(0); // 0=пол, 1=стена
  w = 0;
  h = 0;
  rooms: Room[] = [];
  spawnPoints: {x: number; y: number}[] = [];
  navAnchors: {x: number; y: number}[] = [];
  staticCanvas: HTMLCanvasElement | null = null;

  generate(seed: number) {
    this.w = CFG.MAP_W;
    this.h = CFG.MAP_H;
    const size = this.w * this.h;
    this.grid = new Uint8Array(size);
    this.grid.fill(1); // всё стена

    // RNG с seed
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

    // Генерация комнат
    const numRooms = randInt(CFG.ROOMS_MIN, CFG.ROOMS_MAX);
    this.rooms = [];
    for (let i = 0; i < numRooms * 3; i++) {
      if (this.rooms.length >= numRooms) break;
      const rw = randInt(CFG.ROOM_SIZE_MIN, CFG.ROOM_SIZE_MAX);
      const rh = randInt(CFG.ROOM_SIZE_MIN, CFG.ROOM_SIZE_MAX);
      const rx = randInt(2, this.w - rw - 2);
      const ry = randInt(2, this.h - rh - 2);
      // Проверка перекрытия
      let overlap = false;
      for (const r of this.rooms) {
        if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y) {
          overlap = true; break;
        }
      }
      if (!overlap) {
        this.rooms.push({ x: rx, y: ry, w: rw, h: rh });
        // Вырубаем комнату
        for (let y = ry; y < ry + rh; y++) {
          for (let x = rx; x < rx + rw; x++) {
            this.grid[y * this.w + x] = 0;
          }
        }
      }
    }

    // Коридоры между комнатами
    for (let i = 1; i < this.rooms.length; i++) {
      const a = this.rooms[i - 1];
      const b = this.rooms[i];
      const ax = Math.floor(a.x + a.w / 2);
      const ay = Math.floor(a.y + a.h / 2);
      const bx = Math.floor(b.x + b.w / 2);
      const by = Math.floor(b.y + b.h / 2);
      this.carveCorridor(ax, ay, bx, by, rand);
    }
    // Дополнительные коридоры для петель
    for (let i = 0; i < 3; i++) {
      const a = this.rooms[randInt(0, this.rooms.length - 1)];
      const b = this.rooms[randInt(0, this.rooms.length - 1)];
      if (a !== b) {
        this.carveCorridor(
          Math.floor(a.x + a.w/2), Math.floor(a.y + a.h/2),
          Math.floor(b.x + b.w/2), Math.floor(b.y + b.h/2), rand
        );
      }
    }

    // Точки спавна (центры комнат)
    this.spawnPoints = this.rooms.map(r => ({
      x: (r.x + r.w / 2) * CFG.TILE,
      y: (r.y + r.h / 2) * CFG.TILE
    }));

    // Якоря для навий (углы комнат)
    this.navAnchors = [];
    for (const r of this.rooms) {
      this.navAnchors.push({ x: (r.x + 1) * CFG.TILE, y: (r.y + 1) * CFG.TILE });
      this.navAnchors.push({ x: (r.x + r.w - 1) * CFG.TILE, y: (r.y + r.h - 1) * CFG.TILE });
    }

    // Рендер статичной карты
    this.renderStatic();
  }

  private carveCorridor(x1: number, y1: number, x2: number, y2: number, rand: () => number) {
    const cw = CFG.CORRIDOR_W;
    // Горизонтально, потом вертикально (или наоборот)
    if (rand() > 0.5) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        for (let dy = 0; dy < cw; dy++) {
          const y = y1 + dy;
          if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y * this.w + x] = 0;
        }
      }
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let dx = 0; dx < cw; dx++) {
          const x = x2 + dx;
          if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y * this.w + x] = 0;
        }
      }
    } else {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let dx = 0; dx < cw; dx++) {
          const x = x1 + dx;
          if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y * this.w + x] = 0;
        }
      }
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        for (let dy = 0; dy < cw; dy++) {
          const y = y2 + dy;
          if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y * this.w + x] = 0;
        }
      }
    }
  }

  renderStatic() {
    const c = document.createElement('canvas');
    c.width = this.w * CFG.TILE;
    c.height = this.h * CFG.TILE;
    const ctx = c.getContext('2d')!;
    const T = CFG.TILE;

    // Пол
    ctx.fillStyle = '#080a0c';
    ctx.fillRect(0, 0, c.width, c.height);

    // Стены
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.grid[y * this.w + x] === 1) {
          // Вариация цвета стен
          const v = ((x * 7 + y * 13) % 5) * 2;
          ctx.fillStyle = `rgb(${16+v},${18+v},${20+v})`;
          ctx.fillRect(x * T, y * T, T, T);
          // Тень на стене (нижняя грань, где пол)
          if (y + 1 < this.h && this.grid[(y+1) * this.w + x] === 0) {
            ctx.fillStyle = 'rgba(25,30,22,0.7)';
            ctx.fillRect(x * T, y * T + T - 6, T, 6);
          }
          // Трещины
          if ((x * 11 + y * 23) % 37 === 0) {
            ctx.strokeStyle = 'rgba(10,12,14,0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x * T + T * 0.3, y * T + T * 0.2);
            ctx.lineTo(x * T + T * 0.6, y * T + T * 0.7);
            ctx.stroke();
          }
        } else {
          // Пол — вариации
          const v = ((x * 3 + y * 7) % 4);
          const base = 11 + v;
          ctx.fillStyle = `rgb(${base},${base+1},${base-1})`;
          ctx.fillRect(x * T, y * T, T, T);
          // Случайные пятна (грязь, кровь)
          if ((x * 17 + y * 31) % 23 === 0) {
            ctx.fillStyle = 'rgba(35,45,30,0.25)';
            ctx.beginPath();
            ctx.arc(x * T + T/2, y * T + T/2, T * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          // Запёкшаяся кровь
          if ((x * 41 + y * 59) % 97 === 0) {
            ctx.fillStyle = 'rgba(60,25,20,0.2)';
            ctx.beginPath();
            ctx.arc(x * T + T * 0.4, y * T + T * 0.6, T * 0.15, 0, Math.PI * 2);
            ctx.fill();
          }
          // Корни
          if ((x * 13 + y * 29) % 61 === 0) {
            ctx.strokeStyle = 'rgba(30,40,25,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x * T, y * T + T * 0.5);
            ctx.quadraticCurveTo(x * T + T * 0.5, y * T + T * 0.3, x * T + T, y * T + T * 0.6);
            ctx.stroke();
          }
        }
      }
    }

    this.staticCanvas = c;
  }

  isWall(px: number, py: number): boolean {
    const tx = Math.floor(px / CFG.TILE);
    const ty = Math.floor(py / CFG.TILE);
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return true;
    return this.grid[ty * this.w + tx] === 1;
  }

  isWalkable(px: number, py: number, r: number): boolean {
    return !this.isWall(px - r, py - r) && !this.isWall(px + r, py - r) &&
           !this.isWall(px - r, py + r) && !this.isWall(px + r, py + r);
  }

  // BFS-поле от цели
  bfsField(goalTx: number, goalTy: number): Int32Array {
    const field = new Int32Array(this.w * this.h);
    field.fill(-1);
    const queue: number[] = [];
    const idx = goalTy * this.w + goalTx;
    field[idx] = 0;
    queue.push(idx);
    let head = 0;
    while (head < queue.length) {
      const ci = queue[head++];
      const cx = ci % this.w;
      const cy = (ci - cx) / this.w;
      const dist = field[ci];
      // 4 направления
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= this.w || ny < 0 || ny >= this.h) continue;
        const ni = ny * this.w + nx;
        if (this.grid[ni] === 1) continue;
        if (field[ni] !== -1) continue;
        field[ni] = dist + 1;
        queue.push(ni);
      }
    }
    return field;
  }
}

// === Освещение ===
export class Light {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale = 1;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  resize(w: number, h: number, scale: number) {
    this.scale = scale;
    this.canvas.width = Math.ceil(w * scale);
    this.canvas.height = Math.ceil(h * scale);
  }

  render(sprites: Sprites, lights: {x: number; y: number; r: number; intensity: number}[], camX: number, camY: number, viewW: number, viewH: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this.scale;

    // Заполняем темнотой
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(4,5,7,${CFG.LIGHT_DARKNESS})`;
    ctx.fillRect(0, 0, w, h);

    // Пробиваем свет
    if (!sprites.lightSprite) return;
    ctx.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      if (light.r <= 1 || light.intensity <= 0.004) continue;
      const sx = (light.x - camX) * s;
      const sy = (light.y - camY) * s;
      const r = light.r * s;
      ctx.globalAlpha = Math.min(1, light.intensity);
      ctx.drawImage(sprites.lightSprite, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// === Игрок ===
export class Player {
  x = 0;
  y = 0;
  fuel = CFG.FUEL_MAX;
  spirit = CFG.SPIRIT_MAX;
  flareCD = 0;
  flareT = 0;
  torchIntensity = 1;
  angle = 0;
  bobPhase = 0;
  alive = true;
  isMoving = false;

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.fuel = CFG.FUEL_MAX;
    this.spirit = CFG.SPIRIT_MAX;
    this.flareCD = 0;
    this.flareT = 0;
    this.torchIntensity = 1;
    this.alive = true;
  }

  update(dt: number, input: Input, map: GameMap) {
    if (!this.alive) return;

    const moving = input.moveX !== 0 || input.moveY !== 0;
    this.isMoving = moving;
    const speed = input.running ? CFG.PLAYER_RUN : CFG.PLAYER_SPEED;
    const fuelRate = input.running ? CFG.FUEL_RUN : CFG.FUEL_IDLE;

    // Движение
    if (moving) {
      const nx = this.x + input.moveX * speed * dt;
      const ny = this.y + input.moveY * speed * dt;
      // Коллизия по осям раздельно
      if (map.isWalkable(nx, this.y, CFG.PLAYER_R)) this.x = nx;
      if (map.isWalkable(this.x, ny, CFG.PLAYER_R)) this.y = ny;
      this.angle = Math.atan2(input.moveY, input.moveX);
      this.bobPhase += dt * (input.running ? 14 : 8);
    }

    // Расход смолы
    this.fuel -= fuelRate * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      // Урон от темноты
      this.spirit -= CFG.SPIRIT_DARK_DMG * dt;
    }

    // Интенсивность факела зависит от смолы
    const fuelRatio = this.fuel / CFG.FUEL_MAX;
    this.torchIntensity = 0.3 + fuelRatio * 0.7;

    // Кулдаун вспышки
    if (this.flareCD > 0) this.flareCD -= dt;
    if (this.flareT > 0) this.flareT -= dt;

    // Вспышка
    if (input.consumeFlare() && this.flareCD <= 0 && this.fuel >= CFG.FLARE_COST) {
      this.flareT = CFG.FLARE_DUR;
      this.flareCD = CFG.FLARE_CD;
      this.fuel -= CFG.FLARE_COST;
    }

    // Смерть
    if (this.spirit <= 0) {
      this.spirit = 0;
      this.alive = false;
    }
  }

  getTorchRadius(): number {
    const fuelRatio = this.fuel / CFG.FUEL_MAX;
    const base = CFG.TORCH_R_MIN + (CFG.TORCH_R - CFG.TORCH_R_MIN) * fuelRatio;
    const flicker = 1 + Math.sin(performance.now() * 0.001 * CFG.TORCH_FLICKER_SPD) * CFG.TORCH_FLICKER;
    let r = base * flicker * this.torchIntensity;
    if (this.flareT > 0) r = CFG.FLARE_R;
    return r;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const bob = Math.sin(this.bobPhase) * 2;
    const t = performance.now() * 0.001;

    // Тело
    ctx.fillStyle = '#3a3530';
    ctx.beginPath();
    ctx.ellipse(sx, sy + bob, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 12, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Факел (палка)
    const fx = sx + Math.cos(this.angle) * 6;
    const fy = sy + Math.sin(this.angle) * 6 + bob - 8;
    ctx.strokeStyle = '#5a4a30';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + bob - 4);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    // Пламя
    if (this.fuel > 0) {
      const intensity = this.fuel / CFG.FUEL_MAX;
      const flameR = (3 + Math.random() * 3) * (0.5 + intensity * 0.5);
      // Внешнее пламя
      ctx.fillStyle = `rgba(180,100,20,${(0.5 + Math.random() * 0.3) * intensity})`;
      ctx.beginPath();
      ctx.arc(fx + Math.sin(t * 8) * 1, fy - 3, flameR * 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Внутреннее пламя
      ctx.fillStyle = `rgba(255,200,60,${(0.5 + Math.random() * 0.3) * intensity})`;
      ctx.beginPath();
      ctx.arc(fx, fy - 4, flameR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Яркое ядро
      ctx.fillStyle = `rgba(255,240,180,${0.3 * intensity})`;
      ctx.beginPath();
      ctx.arc(fx, fy - 4, flameR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Угли (маленькие яркие точки, летящие вверх)
      for (let i = 0; i < 3; i++) {
        const ex = fx + Math.sin(t * 5 + i * 2) * 4;
        const ey = fy - 8 - (t * 20 + i * 7) % 20;
        const ea = Math.max(0, 1 - ((t * 20 + i * 7) % 20) / 20);
        ctx.fillStyle = `rgba(255,160,40,${ea * 0.6 * intensity})`;
        ctx.fillRect(ex, ey, 1.5, 1.5);
      }
    }
  }
}

// === Навь (существо) ===
type NavState = 'lurk' | 'hunt' | 'circle' | 'dart' | 'flee' | 'return' | 'dissolve';

export class Nav {
  x = 0;
  y = 0;
  homeX = 0;
  homeY = 0;
  state: NavState = 'lurk';
  hp = 100;
  speed = CFG.NAV_SPEED;
  dartTimer = 0;
  windupT = 0;
  angle = 0;
  circleAngle = 0;
  tentacles: {angle: number; len: number; phase: number}[] = [];
  eyeGlow = 0;
  isMidnight = false;
  alive = true;
  dissolveT = 0;

  constructor(x: number, y: number, isMidnight = false) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.isMidnight = isMidnight;
    this.speed = isMidnight ? CFG.MIDNIGHT_SPEED : CFG.NAV_SPEED;
    // Генерация щупалец
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      this.tentacles.push({
        angle: (i / count) * Math.PI * 2,
        len: 12 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  update(dt: number, player: Player, map: GameMap, tension: number) {
    if (!this.alive) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const inLight = dist < player.getTorchRadius() * 0.7 && player.fuel > 0;
    const inAggro = dist < (this.isMidnight ? CFG.MIDNIGHT_HEAR : CFG.NAV_AGGRO);
    const homeDist = Math.sqrt((this.x-this.homeX)**2 + (this.y-this.homeY)**2);

    // Урон от света
    if (inLight && !this.isMidnight) {
      this.hp -= CFG.NAV_BURN_LIT * 100 / CFG.NAV_BURN_RATE * dt;
      if (this.hp <= 0) {
        this.state = 'dissolve';
        this.dissolveT = 1;
      }
    }

    // FSM
    switch (this.state) {
      case 'lurk':
        if (inAggro && !inLight) {
          this.state = 'hunt';
        }
        if (this.isMidnight && inAggro) {
          // Полуночница идёт на звук бега
          this.state = 'hunt';
        }
        break;

      case 'hunt':
        if (inLight && !this.isMidnight) {
          this.state = 'flee';
        } else if (dist < CFG.NAV_CIRCLE_DIST) {
          this.state = 'circle';
          this.circleAngle = Math.atan2(dy, dx);
        } else if (dist < CFG.NAV_AGGRO * 0.5 && this.dartTimer <= 0) {
          this.state = 'dart';
          this.windupT = CFG.NAV_DART_WINDUP;
        }
        // Полуночница замирает если игрок стоит (слепая, идёт на звук)
        if (this.isMidnight && !player.isMoving && dist > 60) {
          break;
        }
        // Движение к игроку
        if (dist > 1) {
          const mx = (dx / dist) * this.speed * dt;
          const my = (dy / dist) * this.speed * dt;
          const nx = this.x + mx;
          const ny = this.y + my;
          if (map.isWalkable(nx, this.y, 6)) this.x = nx;
          if (map.isWalkable(this.x, ny, 6)) this.y = ny;
          this.angle = Math.atan2(dy, dx);
        }
        break;

      case 'circle':
        this.circleAngle += dt * 1.5;
        const cx = player.x + Math.cos(this.circleAngle) * CFG.NAV_CIRCLE_DIST;
        const cy = player.y + Math.sin(this.circleAngle) * CFG.NAV_CIRCLE_DIST;
        const cdx = cx - this.x;
        const cdy = cy - this.y;
        const cdist = Math.sqrt(cdx*cdx + cdy*cdy);
        if (cdist > 1) {
          const mx = (cdx / cdist) * CFG.NAV_CIRCLE_SPD * dt;
          const my = (cdy / cdist) * CFG.NAV_CIRCLE_SPD * dt;
          if (map.isWalkable(this.x + mx, this.y, 6)) this.x += mx;
          if (map.isWalkable(this.x, this.y + my, 6)) this.y += my;
        }
        if (this.dartTimer <= 0 && !inLight) {
          this.state = 'dart';
          this.windupT = CFG.NAV_DART_WINDUP;
        }
        if (inLight && !this.isMidnight) this.state = 'flee';
        break;

      case 'dart':
        if (this.windupT > 0) {
          this.windupT -= dt;
          // Замах — тело сжимается
        } else {
          // Выпад
          const ddx = player.x - this.x;
          const ddy = player.y - this.y;
          const dd = Math.sqrt(ddx*ddx + ddy*ddy);
          if (dd > 1) {
            const mx = (ddx / dd) * CFG.NAV_DART_SPEED * dt;
            const my = (ddy / dd) * CFG.NAV_DART_SPEED * dt;
            if (map.isWalkable(this.x + mx, this.y, 6)) this.x += mx;
            if (map.isWalkable(this.x, this.y + my, 6)) this.y += my;
          }
          this.dartTimer = CFG.NAV_DART_CD;
          if (dd < 20 || inLight) {
            this.state = inLight ? 'flee' : 'circle';
          }
        }
        break;

      case 'flee':
        // Отступаем от света
        if (dist > 1) {
          const fx = -(dx / dist) * this.speed * 1.5 * dt;
          const fy = -(dy / dist) * this.speed * 1.5 * dt;
          if (map.isWalkable(this.x + fx, this.y, 6)) this.x += fx;
          if (map.isWalkable(this.x, this.y + fy, 6)) this.y += fy;
        }
        if (!inLight || dist > CFG.NAV_AGGRO * 1.5) {
          this.state = 'return';
        }
        break;

      case 'return':
        // Возврат к дому
        const hdx = this.homeX - this.x;
        const hdy = this.homeY - this.y;
        const hd = Math.sqrt(hdx*hdx + hdy*hdy);
        if (hd > 5) {
          const mx = (hdx / hd) * this.speed * 0.7 * dt;
          const my = (hdy / hd) * this.speed * 0.7 * dt;
          if (map.isWalkable(this.x + mx, this.y, 6)) this.x += mx;
          if (map.isWalkable(this.x, this.y + my, 6)) this.y += my;
        } else {
          this.state = 'lurk';
        }
        break;

      case 'dissolve':
        this.dissolveT -= dt;
        if (this.dissolveT <= 0) this.alive = false;
        break;
    }

    // Leash — ограничение радиуса от дома
    if (homeDist > CFG.NAV_LEASH && this.state !== 'dissolve') {
      this.state = 'return';
    }

    // Кулдаун выпада (всегда, не только в dart)
    if (this.dartTimer > 0) this.dartTimer -= dt;

    // Глаза — яркость зависит от состояния
    if (this.state === 'lurk') {
      this.eyeGlow = Math.min(1, this.eyeGlow + dt * 0.8);
    } else if (this.state === 'hunt' || this.state === 'dart') {
      this.eyeGlow = Math.min(1, this.eyeGlow + dt * 2);
    } else {
      this.eyeGlow = Math.max(0, this.eyeGlow - dt * 1.5);
    }
  }

  // Проверка контакта с игроком
  checkHit(player: Player): number {
    if (!this.alive || this.state === 'dissolve' || this.state === 'flee' || this.state === 'return') return 0;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 18) {
      return this.isMidnight ? CFG.MIDNIGHT_DMG : CFG.NAV_DMG;
    }
    return 0;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, sprites: Sprites) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const t = performance.now() * 0.001;

    // Альфа при растворении
    const alpha = this.state === 'dissolve' ? this.dissolveT : 1;
    ctx.globalAlpha = alpha;

    if (this.isMidnight) {
      // Полуночница — тонкая высокая фигура
      ctx.fillStyle = '#1a1a20';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 5, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Длинные конечности
      ctx.strokeStyle = '#1a1a20';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ta = this.tentacles[i]?.angle || 0;
        const wave = Math.sin(t * 3 + ta) * 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5 + i * 4);
        ctx.lineTo(sx + Math.cos(ta + wave * 0.1) * 15, sy + Math.sin(ta) * 12 + wave);
        ctx.stroke();
      }
    } else {
      // Тихая — тёмная масса со щупальцами
      ctx.fillStyle = '#0d0f10';
      ctx.beginPath();
      const bodyR = 10 + Math.sin(t * 2) * 2;
      ctx.ellipse(sx, sy, bodyR, bodyR * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Щупальца
      ctx.strokeStyle = '#0d0f10';
      ctx.lineWidth = 3;
      for (const tent of this.tentacles) {
        const wave = Math.sin(t * 2 + tent.phase) * 5;
        const ex = sx + Math.cos(tent.angle + wave * 0.05) * tent.len;
        const ey = sy + Math.sin(tent.angle + wave * 0.05) * tent.len;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(tent.angle) * 6, sy + Math.sin(tent.angle) * 6);
        ctx.quadraticCurveTo(
          sx + Math.cos(tent.angle) * tent.len * 0.5 + wave,
          sy + Math.sin(tent.angle) * tent.len * 0.5 - wave,
          ex, ey
        );
        ctx.stroke();
      }

      // Замах — сжатие
      if (this.state === 'dart' && this.windupT > 0) {
        ctx.fillStyle = 'rgba(60,20,20,0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, bodyR * 0.6, bodyR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Глаза (видны в темноте)
    if (sprites.eyeSprite && this.eyeGlow > 0.1) {
      ctx.globalAlpha = alpha * this.eyeGlow * 0.8;
      const eyeOff = this.isMidnight ? 4 : 3;
      ctx.drawImage(sprites.eyeSprite, sx - eyeOff - 4, sy - 4, 8, 8);
      ctx.drawImage(sprites.eyeSprite, sx + eyeOff - 4, sy - 4, 8, 8);
    }

    ctx.globalAlpha = 1;
  }
}

// === Процедурный звук ===
export class Sound {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  droneOsc: OscillatorNode | null = null;
  droneGain: GainNode | null = null;
  enabled = true;
  heartRate = 0;
  heartOsc: OscillatorNode | null = null;
  heartGain: GainNode | null = null;

  init() {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      // Дрон
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sawtooth';
      this.droneOsc.frequency.value = 42;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.04;
      const droneFilter = this.ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 120;
      this.droneOsc.connect(droneFilter);
      droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc.start();

      // Сердцебиение
      this.heartOsc = this.ctx.createOscillator();
      this.heartOsc.type = 'sine';
      this.heartOsc.frequency.value = 50;
      this.heartGain = this.ctx.createGain();
      this.heartGain.gain.value = 0;
      this.heartOsc.connect(this.heartGain);
      this.heartGain.connect(this.masterGain);
      this.heartOsc.start();
    } catch(e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setTension(t: number) {
    if (!this.droneGain || !this.ctx) return;
    this.droneGain.gain.value = 0.03 + t * 0.06;
    if (this.droneOsc) this.droneOsc.frequency.value = 42 + t * 20;
    this.heartRate = t;
  }

  updateHeartbeat(dt: number, spiritRatio: number) {
    if (!this.heartGain || !this.ctx) return;
    // Чем меньше дух — тем быстрее сердце
    const urgency = 1 - spiritRatio;
    const rate = 1 + urgency * 4; // 1-5 ударов в секунду
    const phase = (this.ctx.currentTime * rate) % 1;
    const beat = phase < 0.1 ? Math.sin(phase * Math.PI * 10) : 0;
    this.heartGain.gain.value = beat * urgency * 0.15;
  }

  playWhisper() {
    if (!this.ctx || !this.masterGain) return;
    // Шёпот — шумовой буфер с фильтром
    const dur = 0.8;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + Math.random() * 400;
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  playHurt() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 120;
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playPickup() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playFlare() {
    if (!this.ctx || !this.masterGain) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.2;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  playNavDissolve() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playSpiderAmbient() {
    if (!this.ctx || !this.masterGain) return;
    // Низкий пульсирующий гул
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55 + Math.random() * 10;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 2);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 0.3 : 0;
    }
  }
}

// === Щупальце паука ===
interface Anchor {
  x: number;
  y: number;
  cooldownUntil: number;
  claimedBy: LiquidSpider | null;
  highlight: number;
}

class Tentacle {
  spider: LiquidSpider;
  anchor: Anchor;
  progress = 0;
  dead = false;
  retracting = false;
  startX = 0;
  startY = 0;
  hue: number;

  constructor(spider: LiquidSpider, anchor: Anchor) {
    this.spider = spider;
    this.anchor = anchor;
    this.startX = spider.x;
    this.startY = spider.y;
    this.hue = spider.hue;
  }

  update(dt: number, globalTime: number) {
    // Обновляем начальную точку (паук двигается)
    this.startX = this.spider.x;
    this.startY = this.spider.y;

    if (this.retracting) {
      this.progress -= dt * 2;
      if (this.progress <= 0) this.dead = true;
    } else {
      this.progress += dt * CFG.SPIDER_TENTACLE_SPEED;
      if (this.progress >= 1) {
        // Полностью вытянуто — начинаем втягивать через некоторое время
        this.retracting = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (this.dead) return;
    const sx = this.startX - camX;
    const sy = this.startY - camY;
    const ax = this.anchor.x - camX;
    const ay = this.anchor.y - camY;

    // Интерполированная конечная точка
    const ex = sx + (ax - sx) * Math.min(1, this.progress);
    const ey = sy + (ay - sy) * Math.min(1, this.progress);

    // Волнистая линия щупальца
    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const nx = -dy / len;
    const ny = dx / len;
    const wave = Math.sin(this.progress * 6 + this.spider.pulse) * 8 * this.progress;

    const mx = (sx + ex) / 2 + nx * wave;
    const my = (sy + ey) / 2 + ny * wave;

    ctx.strokeStyle = `hsla(${this.hue},60%,50%,${0.3 + this.progress * 0.3})`;
    ctx.lineWidth = 2 + this.progress;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();

    // Точка прикрепления
    if (this.progress > 0.5) {
      ctx.fillStyle = `hsla(${this.hue},70%,60%,${(this.progress - 0.5) * 0.6})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 3 + this.progress * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// === Жидкий паук (редкое главное существо) ===
export class LiquidSpider {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  id: number;
  tentacles: Tentacle[] = [];
  maxTentacles: number;
  reachRadius: number;
  attachTimer = 0;
  pulse = 0;
  hue: number;
  alive = true;
  anchors: Anchor[] = [];
  spawnAlpha = 0; // эффект проявления (0→1 за 3 секунды)
  private anchorRegenTimer = 5; // регенерация якорей каждые 5с

  constructor(x: number, y: number, id: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.maxTentacles = CFG.SPIDER_MAX_TENTACLES;
    this.reachRadius = CFG.SPIDER_REACH;
    this.hue = CFG.SPIDER_HUE + id * 25;
    this.pulse = Math.random() * Math.PI * 2;
    this.attachTimer = Math.random() * 0.5;
  }

  // Генерация якорей вокруг паука
  generateAnchors(map: GameMap) {
    this.anchors = [];
    // Создаём якоря по кругу и у стен в радиусе досягаемости
    const ringCount = 12;
    const rings = 3;

    for (let ring = 1; ring <= rings; ring++) {
      const radius = (this.reachRadius / rings) * ring;
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2 + (ring * 0.3);
        const jitter = (Math.random() - 0.5) * 30;
        const ax = this.x + Math.cos(angle) * (radius + jitter);
        const ay = this.y + Math.sin(angle) * (radius + jitter);

        // Проверяем что якорь на проходимой территории или у стены
        const dist = Math.sqrt((ax - this.x) ** 2 + (ay - this.y) ** 2);
        if (dist > this.reachRadius * 1.1 || dist < 25) continue;

        // 60% якорей у стен, 40% на полу (для разнообразия)
        const nearWall = map.isWall(ax + 15, ay) || map.isWall(ax - 15, ay) ||
                         map.isWall(ax, ay + 15) || map.isWall(ax, ay - 15);
        if (nearWall || Math.random() < 0.35) {
          this.anchors.push({
            x: ax, y: ay,
            cooldownUntil: 0,
            claimedBy: null,
            highlight: nearWall ? 0.4 : Math.random() * 0.2
          });
        }
      }
    }
  }

  attachToBest(now: number, playerX: number, playerY: number) {
    let best: Anchor | null = null;
    let bestScore = Infinity;

    // Направление к игроку (паук медленно тянется к свету)
    const ldx = playerX - this.x;
    const ldy = playerY - this.y;
    const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
    const hasDir = ldist > 50;
    const lx = hasDir ? ldx / ldist : 0;
    const ly = hasDir ? ldy / ldist : 0;

    for (const a of this.anchors) {
      if (a.cooldownUntil > now) continue;
      if (a.claimedBy) continue;

      const dx = a.x - this.x;
      const dy = a.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > this.reachRadius || d < 18) continue;

      let score = d;

      if (hasDir) {
        const nx = dx / d;
        const ny = dy / d;
        const dot = nx * lx + ny * ly;
        score -= dot * 200; // бонус за якоря в направлении игрока
      }

      score -= a.highlight * 400;

      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }

    if (best) {
      this.tentacles.push(new Tentacle(this, best));
      best.claimedBy = this;
    }
  }

  releaseTentacle(t: Tentacle) {
    if (t.anchor && t.anchor.claimedBy === this) {
      t.anchor.claimedBy = null;
    }
  }

  update(dt: number, player: Player, map: GameMap, spiders: LiquidSpider[]) {
    if (!this.alive) return;
    const now = performance.now();
    this.pulse += dt * 2.5;

    // Проявление
    if (this.spawnAlpha < 1) {
      this.spawnAlpha = Math.min(1, this.spawnAlpha + dt * 0.33); // ~3 секунды
    }

    // Периодическая регенерация якорей
    this.anchorRegenTimer -= dt;
    if (this.anchorRegenTimer <= 0) {
      this.anchorRegenTimer = 4 + Math.random() * 3;
      this.generateAnchors(map);
    }

    // Обновляем якоря если паук сильно сдвинулся
    const centerAnchor = this.anchors.length > 0
      ? this.anchors.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 })
      : { x: this.x, y: this.y };
    if (this.anchors.length > 0) {
      centerAnchor.x /= this.anchors.length;
      centerAnchor.y /= this.anchors.length;
    }

    // Обновление щупалец
    for (let i = this.tentacles.length - 1; i >= 0; i--) {
      const t = this.tentacles[i];
      t.update(dt, now);

      if (t.dead) {
        this.releaseTentacle(t);
        this.tentacles.splice(i, 1);
        continue;
      }

      // Если щупальце полностью вытянуто и паук рядом — отпустить
      if (t.progress >= 1) {
        const d = Math.sqrt((t.anchor.x - this.x) ** 2 + (t.anchor.y - this.y) ** 2);
        if (d < 30) {
          t.anchor.cooldownUntil = now + 1500;
          t.anchor.highlight = Math.min(t.anchor.highlight, 0.15);
          this.releaseTentacle(t);
          this.tentacles.splice(i, 1);
        }
      }
    }

    // Прикрепление новых щупалец
    this.attachTimer -= dt;
    if (this.attachTimer <= 0 && this.tentacles.length < this.maxTentacles) {
      this.attachTimer = CFG.SPIDER_ATTACH_INTERVAL + Math.random() * 0.3;
      this.attachToBest(now, player.x, player.y);
    }

    // Движение — только через щупальца
    let activeCount = 0;
    let tx = 0, ty = 0;
    for (const t of this.tentacles) {
      if (t.progress > 0.45) {
        activeCount++;
        tx += t.anchor.x;
        ty += t.anchor.y;
      }
    }

    if (activeCount > 0) {
      tx /= activeCount;
      ty /= activeCount;

      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const desiredSpeed = Math.min(CFG.SPIDER_SPEED, dist * 1.5);
      const ax = (dx / dist) * desiredSpeed;
      const ay = (dy / dist) * desiredSpeed;

      const k = Math.min(1, dt * 3);
      this.vx += (ax - this.vx) * k;
      this.vy += (ay - this.vy) * k;

      // Разделение с другими пауками
      let sepX = 0, sepY = 0;
      for (const other of spiders) {
        if (other === this) continue;
        const dxs = this.x - other.x;
        const dys = this.y - other.y;
        const ds = Math.sqrt(dxs * dxs + dys * dys);
        if (ds < CFG.SPIDER_SEPARATION && ds > 0.01) {
          const f = (CFG.SPIDER_SEPARATION - ds) / CFG.SPIDER_SEPARATION;
          sepX += (dxs / ds) * f * 80;
          sepY += (dys / ds) * f * 80;
        }
      }
      this.vx += sepX * dt;
      this.vy += sepY * dt;
    } else {
      // Без щупалец — затухание
      const damp = Math.pow(0.01, dt);
      this.vx *= damp;
      this.vy *= damp;
    }

    // Реакция на свет — паук отступает от яркого факела
    const toPlayerDx = this.x - player.x;
    const toPlayerDy = this.y - player.y;
    const toPlayerDist = Math.sqrt(toPlayerDx * toPlayerDx + toPlayerDy * toPlayerDy);
    const torchR = player.getTorchRadius();

    if (toPlayerDist < torchR * 0.8 && player.fuel > 10) {
      // Отталкивание от света (мягкое)
      const repelForce = (1 - toPlayerDist / (torchR * 0.8)) * 30;
      if (toPlayerDist > 1) {
        this.vx += (toPlayerDx / toPlayerDist) * repelForce * dt;
        this.vy += (toPlayerDy / toPlayerDist) * repelForce * dt;
      }
    }

    // Интеграция позиции (единственная!)
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (map.isWalkable(nx, this.y, 12)) this.x = nx;
    if (map.isWalkable(this.x, ny, 12)) this.y = ny;

    // Кламп к карте
    this.x = Math.max(20, Math.min(map.w * CFG.TILE - 20, this.x));
    this.y = Math.max(20, Math.min(map.h * CFG.TILE - 20, this.y));
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, sprites: Sprites) {
    if (!this.alive) return;

    // Применяем альфу проявления
    ctx.globalAlpha = this.spawnAlpha;

    // Щупальца
    for (const t of this.tentacles) t.draw(ctx, camX, camY);

    const sx = this.x - camX;
    const sy = this.y - camY;

    // Glow-тело
    if (sprites.glowBody) {
      const size = CFG.SPIDER_SIZE + Math.sin(this.pulse) * 6;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(sprites.glowBody, sx - size, sy - size, size * 2, size * 2);
      ctx.globalAlpha = 1;
    }

    // Тело — органическая форма
    ctx.beginPath();
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 14 + Math.sin(this.pulse + i * 1.7) * 4;
      const px = sx + Math.cos(a) * r;
      const py = sy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `hsla(${this.hue},50%,40%,0.2)`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${this.hue},60%,50%,0.3)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Центральная точка (ядро)
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue},70%,70%,0.6)`;
    ctx.fill();

    // Внутреннее свечение
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,240,230,0.5)';
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}

// === Режиссёр ===
export class Director {
  tension = 0;
  whisperTimer = 0;
  spawnTimer = 0;
  spiderSpawnTimer = 30; // первый паук через ~30с
  bus: Bus;

  constructor(bus: Bus) {
    this.bus = bus;
  }

  update(dt: number, relics: number, timeAlive: number, navs: Nav[], player: Player, map: GameMap) {
    // Напряжение
    this.tension = Math.min(1, (relics / CFG.RELICS_TOTAL) * 0.7 + (timeAlive / 300) * 0.3);

    // Шёпот
    this.whisperTimer -= dt;
    const whisperInterval = CFG.WHISPER_INTERVAL - this.tension * (CFG.WHISPER_INTERVAL - CFG.WHISPER_MIN);
    if (this.whisperTimer <= 0) {
      this.whisperTimer = whisperInterval + Math.random() * 2;
      this.bus.emit('whisper');
    }

    // Спавн навий
    this.spawnTimer -= dt;
    const maxNavs = Math.floor(CFG.NAV_MAX_BASE + this.tension * (CFG.NAV_MAX_TENSION - CFG.NAV_MAX_BASE));
    const aliveNavs = navs.filter(n => n.alive).length;
    const spawnInterval = CFG.SPAWN_INTERVAL - this.tension * (CFG.SPAWN_INTERVAL - CFG.SPAWN_MIN);

    if (this.spawnTimer <= 0 && aliveNavs < maxNavs) {
      this.spawnTimer = spawnInterval + Math.random() * 3;
      this.spawnNav(player, map, navs);
    }

    // Спавн пауков (редких главных существ)
    this.spiderSpawnTimer -= dt;
    if (this.spiderSpawnTimer <= 0 && this.tension >= CFG.SPIDER_SPAWN_TENSION) {
      this.spiderSpawnTimer = 80 + Math.random() * 60; // следующий через 80-140с (очень редко)
      this.bus.emit('spider.spawn', player, map);
    }
  }

  private spawnNav(player: Player, map: GameMap, navs: Nav[]) {
    // Спавн в тёмном углу, вне поля зрения игрока
    const anchors = map.navAnchors.filter(a => {
      const dx = a.x - player.x;
      const dy = a.y - player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      return dist > CFG.NAV_AGGRO * 1.5 && dist < CFG.NAV_AGGRO * 4;
    });

    if (anchors.length === 0) return;
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];

    // 20% шанс полуночницы при высоком напряжении
    const isMidnight = this.tension > 0.4 && Math.random() < 0.2;
    const nav = new Nav(anchor.x, anchor.y, isMidnight);
    navs.push(nav);
    this.bus.emit('nav.spawn', nav);
  }
}

// === Пропы (обереги, смола, записки, колодец) ===
export interface Prop {
  type: 'relic' | 'resin' | 'note' | 'well';
  x: number;
  y: number;
  collected: boolean;
  noteIdx?: number;
}

// === Партикли ===
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  r: number;
  color: string;
}

export class Particles {
  items: Particle[] = [];
  dust: {x: number; y: number; vx: number; vy: number; alpha: number}[] = [];

  addDust(count: number, viewW: number, viewH: number, camX: number, camY: number) {
    while (this.dust.length < count) {
      this.dust.push({
        x: camX + Math.random() * viewW,
        y: camY + Math.random() * viewH,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        alpha: Math.random() * 0.4
      });
    }
  }

  addBurst(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 60;
      this.items.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        r: 1 + Math.random() * 3,
        color
      });
    }
  }

  update(dt: number, camX: number, camY: number, viewW: number, viewH: number) {
    // Обновление партиклов
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.items.splice(i, 1);
    }
    // Пыль
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < camX || d.x > camX + viewW || d.y < camY || d.y > camY + viewH) {
        d.x = camX + Math.random() * viewW;
        d.y = camY + viewH + 10;
        d.alpha = Math.random() * 0.3;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    // Пыль
    for (const d of this.dust) {
      ctx.fillStyle = `rgba(140,130,100,${d.alpha})`;
      ctx.fillRect(d.x - camX, d.y - camY, 1.5, 1.5);
    }
    // Партиклы
    for (const p of this.items) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// === Quality адаптер ===
export class QualityAdapter {
  level = 2; // 0=низкое, 1=среднее, 2=высокое
  fpsHistory: number[] = [];
  dpr = 1;
  lightScale = 1;
  dustCount = 120;

  update(fps: number) {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();
    const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    if (avg < CFG.QUALITY_FPS_LOW && this.level > 0) {
      this.downgrade();
    } else if (avg > CFG.QUALITY_FPS_HIGH && this.level < 2) {
      this.upgrade();
    }
  }

  private downgrade() {
    this.level--;
    this.apply();
  }

  private upgrade() {
    this.level++;
    this.apply();
  }

  private apply() {
    this.dpr = CFG.QUALITY_DPR[this.level];
    this.lightScale = CFG.QUALITY_LIGHT_SCALE[this.level];
    this.dustCount = CFG.QUALITY_DUST[this.level];
  }
}

// === Основной игровой класс ===
export type GameState = 'menu' | 'loading' | 'play' | 'pause' | 'dead' | 'win';

export class Game {
  // Системы
  bus = new Bus();
  sprites = new Sprites();
  input = new Input();
  camera = new Camera();
  map = new GameMap();
  light = new Light();
  player = new Player();
  sound = new Sound();
  director: Director;
  particles = new Particles();
  quality = new QualityAdapter();

  // Состояние
  state: GameState = 'menu';
  navs: Nav[] = [];
  spiders: LiquidSpider[] = [];
  props: Prop[] = [];
  relics = 0;
  timeAlive = 0;
  score = 0;
  seed = Date.now();
  wellPos = { x: 0, y: 0 };
  wellOpen = false;
  deathMsg = '';
  wellAngle = 0;
  fps = 60;
  private lastFpsTime = 0;
  private frameCount = 0;

  // Canvas
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  viewW = 0;
  viewH = 0;

  // Callbacks для UI
  onStateChange?: (state: GameState) => void;
  onToast?: (msg: string) => void;
  onDeath?: (msg: string, score: number) => void;
  onWin?: (score: number) => void;
  onHudUpdate?: (fuel: number, spirit: number, relics: number, wellOpen: boolean) => void;

  constructor() {
    this.director = new Director(this.bus);
  }

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      console.error('Failed to get 2d context');
      return;
    }
    this.sprites.build();
    this.input.init();
    this.sound.init();
    this.resize();

    // Слушатели событий
    this.bus.on('whisper', () => {
      const msg = CFG.WHISPERS[Math.floor(Math.random() * CFG.WHISPERS.length)];
      this.sound.playWhisper();
      this.onToast?.(msg);
    });

    this.bus.on('nav.spawn', () => {
      // Тряска при появлении навьи рядом
    });

    this.bus.on('spider.spawn', (player: Player, map: GameMap) => {
      if (this.spiders.length >= CFG.SPIDER_MAX) return;
      // Спавн паука вдали от игрока, в тёмном углу
      const farAnchors = map.navAnchors.filter(a => {
        const dx = a.x - player.x;
        const dy = a.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist > 400 && dist < 900;
      });
      if (farAnchors.length === 0) return;
      const anchor = farAnchors[Math.floor(Math.random() * farAnchors.length)];
      const spider = new LiquidSpider(anchor.x, anchor.y, this.spiders.length);
      spider.generateAnchors(map);
      this.spiders.push(spider);
      this.camera.shake(3);
      this.sound.playSpiderAmbient();
      this.onToast?.('Что-то большое шевелится в темноте...');
    });

    // Resize с дебаунсом
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.resize(), 250);
    });

    // Пауза при потере фокуса
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') {
        this.state = 'pause';
        this.onStateChange?.('pause');
      }
    });

    // Клавиша паузы
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'play') {
          this.state = 'pause';
          this.onStateChange?.('pause');
        } else if (this.state === 'pause') {
          this.state = 'play';
          this.onStateChange?.('play');
          this.sound.resume();
        }
      }
      if (e.code === 'KeyM') {
        this.sound.toggle();
      }
    });
  }

  resize() {
    if (!this.canvas) return;
    const dpr = this.quality.dpr;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.canvas.style.width = this.viewW + 'px';
    this.canvas.style.height = this.viewH + 'px';
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Resize light canvas
    this.light.resize(this.viewW, this.viewH, this.quality.lightScale);
  }

  startGame() {
    try {
      this.state = 'loading';
      this.onStateChange?.('loading');

      // Ленивая генерация — даём браузеру отрисовать loading
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            this.seed = Date.now();
            this.map.generate(this.seed);
            this.setupLevel();
            this.state = 'play';
            this.onStateChange?.('play');
            this.sound.resume();
          } catch (e) {
            console.error('Game start error:', e);
            this.state = 'menu';
            this.onStateChange?.('menu');
          }
        });
      });
    } catch (e) {
      console.error('Game start error:', e);
    }
  }

  private setupLevel() {
    this.navs = [];
    this.spiders = [];
    this.props = [];
    this.relics = 0;
    this.timeAlive = 0;
    this.score = 0;
    this.wellOpen = false;
    this.deathMsg = '';

    // Спавн игрока в первой комнате
    const startRoom = this.map.rooms[0];
    const px = (startRoom.x + startRoom.w / 2) * CFG.TILE;
    const py = (startRoom.y + startRoom.h / 2) * CFG.TILE;
    this.player.reset(px, py);

    // Колодец в последней комнате
    const endRoom = this.map.rooms[this.map.rooms.length - 1];
    this.wellPos = {
      x: (endRoom.x + endRoom.w / 2) * CFG.TILE,
      y: (endRoom.y + endRoom.h / 2) * CFG.TILE
    };

    // Расставляем пропы
    const usedRooms = new Set<number>();
    usedRooms.add(0); // не в стартовой
    usedRooms.add(this.map.rooms.length - 1); // не в финишной

    // Обереги (5 шт, в разных комнатах)
    for (let i = 0; i < CFG.RELICS_TOTAL; i++) {
      const roomIdx = this.pickRoom(usedRooms);
      if (roomIdx >= 0) {
        const r = this.map.rooms[roomIdx];
        this.props.push({
          type: 'relic',
          x: (r.x + 1 + Math.random() * (r.w - 2)) * CFG.TILE,
          y: (r.y + 1 + Math.random() * (r.h - 2)) * CFG.TILE,
          collected: false
        });
        usedRooms.add(roomIdx);
      }
    }

    // Смола (8 банок)
    for (let i = 0; i < CFG.RESIN_COUNT; i++) {
      const roomIdx = this.pickRoom(usedRooms);
      if (roomIdx >= 0) {
        const r = this.map.rooms[roomIdx];
        this.props.push({
          type: 'resin',
          x: (r.x + 1 + Math.random() * (r.w - 2)) * CFG.TILE,
          y: (r.y + 1 + Math.random() * (r.h - 2)) * CFG.TILE,
          collected: false
        });
      }
    }

    // Записки (6 шт)
    for (let i = 0; i < CFG.NOTES_COUNT; i++) {
      const roomIdx = this.pickRoom(usedRooms);
      if (roomIdx >= 0) {
        const r = this.map.rooms[roomIdx];
        this.props.push({
          type: 'note',
          x: (r.x + 1 + Math.random() * (r.w - 2)) * CFG.TILE,
          y: (r.y + 1 + Math.random() * (r.h - 2)) * CFG.TILE,
          collected: false,
          noteIdx: i
        });
      }
    }

    // Колодец как проп
    this.props.push({
      type: 'well',
      x: this.wellPos.x,
      y: this.wellPos.y,
      collected: false
    });

    // Камера
    this.camera.x = px - this.viewW / 2;
    this.camera.y = py - this.viewH / 2;

    // Пыль
    this.particles.dust = [];
    this.particles.addDust(this.quality.dustCount, this.viewW, this.viewH, this.camera.x, this.camera.y);
  }

  private pickRoom(used: Set<number>): number {
    const available: number[] = [];
    for (let i = 0; i < this.map.rooms.length; i++) {
      if (!used.has(i)) available.push(i);
    }
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)];
  }

  update(dt: number) {
    if (this.state !== 'play') return;

    this.input.update();
    this.timeAlive += dt;

    // Игрок
    this.player.update(dt, this.input, this.map);

    // Проверка смерти
    if (!this.player.alive) {
      this.die();
      return;
    }

    // Камера
    const mapPxW = this.map.w * CFG.TILE;
    const mapPxH = this.map.h * CFG.TILE;
    this.camera.follow(this.player.x, this.player.y, mapPxW, mapPxH, this.viewW, this.viewH);
    this.camera.update();

    // Навьи
    for (const nav of this.navs) {
      nav.update(dt, this.player, this.map, this.director.tension);
      // Проверка контакта
      const dmg = nav.checkHit(this.player);
      if (dmg > 0) {
        this.player.spirit -= dmg;
        this.camera.shake(8);
        this.sound.playHurt();
        this.particles.addBurst(this.player.x, this.player.y, 8, 'rgba(120,30,30,0.8)');
        // Отбрасываем навью
        nav.state = 'flee';
      }
      // Растворение
      if (nav.state === 'dissolve' && nav.dissolveT > 0.9) {
        this.sound.playNavDissolve();
        this.particles.addBurst(nav.x, nav.y, 12, 'rgba(80,120,60,0.6)');
      }
    }
    // Удаляем мёртвых
    this.navs = this.navs.filter(n => n.alive || n.state === 'dissolve');

    // Пауки (медленные, не атакуют — только создают атмосферу)
    for (const spider of this.spiders) {
      spider.update(dt, this.player, this.map, this.spiders);
      // Звуковое и визуальное присутствие при близости
      const sdx = spider.x - this.player.x;
      const sdy = spider.y - this.player.y;
      const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sdist < 300) {
        if (Math.random() < dt * 0.3) {
          this.sound.playSpiderAmbient();
        }
        if (sdist < 180) {
          this.camera.shake(1.5); // лёгкое дрожание при близости
        }
      }
    }

    // Подбор пропов
    for (const prop of this.props) {
      if (prop.collected) continue;
      const dx = this.player.x - prop.x;
      const dy = this.player.y - prop.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 24) {
        prop.collected = true;
        this.sound.playPickup();
        switch (prop.type) {
          case 'relic':
            this.relics++;
            this.score += 100;
            this.particles.addBurst(prop.x, prop.y, 15, 'rgba(180,160,80,0.7)');
            this.camera.shake(4);
            if (this.relics >= CFG.RELICS_TOTAL) {
              this.wellOpen = true;
              this.onToast?.('Колодец открыт. Беги.');
            }
            break;
          case 'resin':
            this.player.fuel = Math.min(CFG.FUEL_MAX, this.player.fuel + CFG.FUEL_PICKUP);
            this.particles.addBurst(prop.x, prop.y, 8, 'rgba(180,120,40,0.6)');
            break;
          case 'note':
            const noteText = CFG.NOTES[prop.noteIdx || 0];
            this.onToast?.(noteText);
            this.score += 20;
            break;
        }
      }
    }

    // Проверка колодца (победа)
    if (this.wellOpen) {
      const wdx = this.wellPos.x - this.player.x;
      const wdy = this.wellPos.y - this.player.y;
      const wdist = Math.sqrt(wdx*wdx + wdy*wdy);
      this.wellAngle = Math.atan2(wdy, wdx);
      if (wdist < CFG.WELL_PULL) {
        this.win();
        return;
      }
    }

    // Режиссёр
    this.director.update(dt, this.relics, this.timeAlive, this.navs, this.player, this.map);
    this.sound.setTension(this.director.tension);
    this.sound.updateHeartbeat(dt, this.player.spirit / CFG.SPIRIT_MAX);

    // Партикли
    this.particles.update(dt, this.camera.x, this.camera.y, this.viewW, this.viewH);

    // FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime > 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.quality.update(this.fps);
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const camX = this.camera.x + this.camera.shakeX;
    const camY = this.camera.y + this.camera.shakeY;

    // 1. Очистка
    ctx.fillStyle = '#040507';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (this.state === 'menu' || this.state === 'loading') return;

    // 2. Статичная карта (один drawImage)
    if (this.map.staticCanvas) {
      const sx = Math.floor(camX);
      const sy = Math.floor(camY);
      const sw = Math.min(this.viewW, this.map.w * CFG.TILE - sx);
      const sh = Math.min(this.viewH, this.map.h * CFG.TILE - sy);
      if (sw > 0 && sh > 0) {
        ctx.drawImage(this.map.staticCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      }
    }

    // 3. Пропы
    this.drawProps(ctx, camX, camY);

    // 4. Пыль
    this.particles.draw(ctx, camX, camY);

    // 5. Навьи
    for (const nav of this.navs) {
      nav.draw(ctx, camX, camY, this.sprites);
    }

    // 5.5. Пауки (редкие главные существа)
    for (const spider of this.spiders) {
      spider.draw(ctx, camX, camY, this.sprites);
    }

    // 6. Игрок
    this.player.draw(ctx, camX, camY);

    // 7. Маска темноты
    const torchR = this.player.getTorchRadius();
    this.light.render(this.sprites, [
      { x: this.player.x, y: this.player.y, r: torchR, intensity: this.player.torchIntensity }
    ], camX, camY, this.viewW, this.viewH);
    ctx.drawImage(this.light.canvas, 0, 0, this.viewW, this.viewH);

    // 8. Тёплый подкрас факела
    if (this.sprites.torchGlow && this.player.fuel > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 * this.player.torchIntensity;
      const tr = torchR;
      ctx.drawImage(this.sprites.torchGlow,
        this.player.x - camX - tr, this.player.y - camY - tr,
        tr * 2, tr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // 9. Вспышка
    if (this.player.flareT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.player.flareT / CFG.FLARE_DUR * 0.3;
      ctx.fillStyle = 'rgba(200,160,80,0.2)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawProps(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const t = performance.now() * 0.001;
    for (const prop of this.props) {
      if (prop.collected) continue;
      const sx = prop.x - camX;
      const sy = prop.y - camY;
      // Проверка видимости
      if (sx < -40 || sx > this.viewW + 40 || sy < -40 || sy > this.viewH + 40) continue;

      switch (prop.type) {
        case 'relic':
          // Оберег — светящийся символ
          const glow = 0.5 + Math.sin(t * 3) * 0.3;
          ctx.fillStyle = `rgba(180,160,80,${glow})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(200,180,100,${glow * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // Крест-оберег
          ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy);
          ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5);
          ctx.stroke();
          break;

        case 'resin':
          // Смола — банка
          ctx.fillStyle = '#6a4a1a';
          ctx.fillRect(sx - 4, sy - 6, 8, 12);
          ctx.fillStyle = '#8a6a2a';
          ctx.fillRect(sx - 3, sy - 4, 6, 8);
          break;

        case 'note':
          // Записка
          ctx.fillStyle = '#8a7a60';
          ctx.fillRect(sx - 5, sy - 4, 10, 8);
          ctx.fillStyle = '#5a4a30';
          ctx.fillRect(sx - 3, sy - 2, 6, 1);
          ctx.fillRect(sx - 3, sy, 4, 1);
          break;

        case 'well':
          // Колодец
          const wellGlow = this.wellOpen ? 0.6 + Math.sin(t * 2) * 0.3 : 0.2;
          ctx.strokeStyle = `rgba(100,120,80,${wellGlow})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, CFG.WELL_R, 0, Math.PI * 2);
          ctx.stroke();
          if (this.wellOpen) {
            // Пар из колодца
            ctx.fillStyle = `rgba(140,160,120,${wellGlow * 0.3})`;
            for (let i = 0; i < 5; i++) {
              const px = sx + Math.sin(t * 2 + i) * 10;
              const py = sy - 10 - Math.sin(t + i * 0.7) * 15;
              ctx.beginPath();
              ctx.arc(px, py, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
      }
    }
  }

  private die() {
    this.state = 'dead';
    this.deathMsg = CFG.DEATHS[Math.floor(Math.random() * CFG.DEATHS.length)];
    this.score += this.relics * 50 + Math.floor(this.timeAlive);
    this.onDeath?.(this.deathMsg, this.score);
    this.onStateChange?.('dead');
    this.saveRecord();
  }

  private win() {
    this.state = 'win';
    this.score += this.relics * 100 + Math.floor(this.player.spirit) + Math.floor(this.player.fuel) + Math.floor(300 - this.timeAlive);
    this.onWin?.(this.score);
    this.onStateChange?.('win');
    this.saveRecord();
  }

  private saveRecord() {
    try {
      const best = parseInt(localStorage.getItem('nav_best') || '0');
      if (this.score > best) {
        localStorage.setItem('nav_best', String(this.score));
      }
    } catch(e) { /* ignore */ }
  }

  getRecord(): number {
    try {
      return parseInt(localStorage.getItem('nav_best') || '0');
    } catch(e) { return 0; }
  }
}
