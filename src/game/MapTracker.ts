// === НАВЬ: Карта — отслеживание пути и отметок ===
import { CFG } from './CFG';
import type { GameMap } from './engine';
import type { Nav, LiquidSpider } from './engine';

interface PathPoint {
  x: number;
  y: number;
  t: number; // время записи
}

interface Sighting {
  x: number;
  y: number;
  t: number; // время появления
  life: number; // оставшееся время жизни
  type: 'nav' | 'spider';
  jitter: { x: number; y: number }; // случайный сдвиг для стиля "от руки"
}

export class MapTracker {
  path: PathPoint[] = [];
  sightings: Sighting[] = [];
  private pathTimer = 0;
  private lastX = 0;
  private lastY = 0;

  // Кэш отрендеренной карты (статика)
  private staticCache: HTMLCanvasElement | null = null;
  private staticCacheKey = '';

  reset() {
    this.path = [];
    this.sightings = [];
    this.pathTimer = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.staticCache = null;
    this.staticCacheKey = '';
  }

  update(dt: number, playerX: number, playerY: number, navs: Nav[], spiders: LiquidSpider[], torchRadius: number) {
    // Запись пути
    this.pathTimer -= dt;
    const dx = playerX - this.lastX;
    const dy = playerY - this.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.pathTimer <= 0 && dist > 8) {
      this.pathTimer = CFG.MAP_PATH_INTERVAL;
      this.path.push({ x: playerX, y: playerY, t: performance.now() });
      this.lastX = playerX;
      this.lastY = playerY;

      // Ограничение длины пути
      if (this.path.length > 2000) {
        this.path = this.path.slice(-1500);
      }
    }

    // Обновление отметок монстров (fade)
    for (let i = this.sightings.length - 1; i >= 0; i--) {
      this.sightings[i].life -= dt;
      if (this.sightings[i].life <= 0) {
        this.sightings.splice(i, 1);
      }
    }

    // Добавление новых отметок — только если монстр виден в свете
    for (const nav of navs) {
      if (!nav.alive) continue;
      const ndx = nav.x - playerX;
      const ndy = nav.y - playerY;
      const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
      if (ndist < torchRadius * 0.9) {
        this.addSighting(nav.x, nav.y, 'nav');
      }
    }

    for (const spider of spiders) {
      if (!spider.alive) continue;
      const sdx = spider.x - playerX;
      const sdy = spider.y - playerY;
      const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sdist < torchRadius * 0.9) {
        this.addSighting(spider.x, spider.y, 'spider');
      }
    }
  }

  private addSighting(x: number, y: number, type: 'nav' | 'spider') {
    // Проверка — не слишком близко к существующей
    for (const s of this.sightings) {
      const d = Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2);
      if (d < 30) return;
    }

    // Ограничение количества
    if (this.sightings.length >= CFG.MAP_SIGHTING_MAX) {
      this.sightings.shift();
    }

    this.sightings.push({
      x, y,
      t: performance.now(),
      life: CFG.MAP_SIGHTING_LIFE,
      type,
      jitter: {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4
      }
    });
  }

  // Рендер карты (мини или полная)
  render(
    ctx: CanvasRenderingContext2D,
    map: GameMap,
    playerX: number,
    playerY: number,
    playerAngle: number,
    wellX: number,
    wellY: number,
    wellOpen: boolean,
    relics: { x: number; y: number; collected: boolean }[],
    x: number,
    y: number,
    size: number,
    fullAlpha: boolean = false
  ) {
    const scale = size / (map.w * CFG.TILE);
    const alpha = fullAlpha ? 1 : CFG.MINIMAP_OPACITY;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Фон — "бумага" с лёгким оттенком
    const bgGrad = ctx.createLinearGradient(x, y, x + size, y + size);
    bgGrad.addColorStop(0, 'rgba(18,20,16,0.92)');
    bgGrad.addColorStop(0.5, 'rgba(22,20,18,0.9)');
    bgGrad.addColorStop(1, 'rgba(16,18,14,0.92)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, size, size);

    // Лёгкий "шум" бумаги (несколько случайных пятен)
    ctx.fillStyle = 'rgba(40,35,28,0.15)';
    for (let i = 0; i < 8; i++) {
      const bx = x + (Math.sin(i * 3.7) * 0.5 + 0.5) * size;
      const by = y + (Math.cos(i * 2.3) * 0.5 + 0.5) * size;
      ctx.beginPath();
      ctx.arc(bx, by, 5 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Рамка (стиль "бумага" — двойная линия)
    ctx.strokeStyle = 'rgba(100,80,60,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    ctx.strokeStyle = 'rgba(80,65,45,0.2)';
    ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);

    // Стены (статика — с кэшем)
    this.renderWalls(ctx, map, x, y, scale, size);

    // Путь (стиль "от руки")
    this.renderPath(ctx, x, y, scale);

    // Обереги
    for (const r of relics) {
      if (r.collected) continue;
      const rx = x + r.x * scale;
      const ry = y + r.y * scale;
      ctx.fillStyle = CFG.MAP_RELIC_COLOR;
      // Крест-оберег
      ctx.beginPath();
      ctx.moveTo(rx - 3, ry);
      ctx.lineTo(rx + 3, ry);
      ctx.moveTo(rx, ry - 3);
      ctx.lineTo(rx, ry + 3);
      ctx.strokeStyle = CFG.MAP_RELIC_COLOR;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Колодец
    const wx = x + wellX * scale;
    const wy = y + wellY * scale;
    ctx.strokeStyle = wellOpen ? CFG.MAP_WELL_COLOR : 'rgba(80,100,70,0.4)';
    ctx.lineWidth = wellOpen ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(wx, wy, 4, 0, Math.PI * 2);
    ctx.stroke();
    if (wellOpen) {
      ctx.fillStyle = CFG.MAP_WELL_COLOR;
      ctx.beginPath();
      ctx.arc(wx, wy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Отметки монстров
    this.renderSightings(ctx, x, y, scale);

    // Игрок
    const px = x + playerX * scale;
    const py = y + playerY * scale;
    const pulse = Math.sin(performance.now() * 0.004) * 0.3 + 0.7;

    // Пульс-кольцо
    ctx.strokeStyle = `rgba(220,180,80,${0.3 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 5 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Конус направления
    ctx.strokeStyle = CFG.MAP_PLAYER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(playerAngle) * 8, py + Math.sin(playerAngle) * 8);
    ctx.stroke();

    // Точка игрока
    ctx.fillStyle = CFG.MAP_PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Яркое ядро
    ctx.fillStyle = `rgba(255,230,150,${0.6 * pulse})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderWalls(ctx: CanvasRenderingContext2D, map: GameMap, x: number, y: number, scale: number, size: number) {
    // Кэш статической карты
    const key = `${map.w}x${map.h}`;
    if (this.staticCacheKey !== key || !this.staticCache) {
      this.staticCache = document.createElement('canvas');
      this.staticCache.width = size;
      this.staticCache.height = size;
      const sctx = this.staticCache.getContext('2d')!;

      // Рисуем стены в стиле "наброска"
      sctx.strokeStyle = CFG.MAP_WALL_COLOR;
      sctx.lineWidth = 1;

      const T = CFG.TILE;
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          if (map.grid[ty * map.w + tx] !== 1) continue;

          const wx = x + tx * T * scale;
          const wy = y + ty * T * scale;
          const ws = T * scale;

          // Рисуем контур стены с jitter
          const j = () => (Math.random() - 0.5) * 1.5;

          // Проверяем границы с полом
          const isFloorRight = tx + 1 < map.w && map.grid[ty * map.w + tx + 1] === 0;
          const isFloorDown = ty + 1 < map.h && map.grid[(ty + 1) * map.w + tx] === 0;
          const isFloorLeft = tx - 1 >= 0 && map.grid[ty * map.w + tx - 1] === 0;
          const isFloorUp = ty - 1 >= 0 && map.grid[(ty - 1) * map.w + tx] === 0;

          if (isFloorRight || isFloorDown || isFloorLeft || isFloorUp) {
            sctx.beginPath();
            // Правая грань
            if (isFloorRight) {
              sctx.moveTo(wx + ws + j(), wy + j());
              sctx.lineTo(wx + ws + j(), wy + ws + j());
            }
            // Нижняя грань
            if (isFloorDown) {
              sctx.moveTo(wx + j(), wy + ws + j());
              sctx.lineTo(wx + ws + j(), wy + ws + j());
            }
            // Левая грань
            if (isFloorLeft) {
              sctx.moveTo(wx + j(), wy + j());
              sctx.lineTo(wx + j(), wy + ws + j());
            }
            // Верхняя грань
            if (isFloorUp) {
              sctx.moveTo(wx + j(), wy + j());
              sctx.lineTo(wx + ws + j(), wy + j());
            }
            sctx.stroke();
          }
        }
      }
      this.staticCacheKey = key;
    }

    ctx.drawImage(this.staticCache, 0, 0, size, size);
  }

  private renderPath(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number) {
    if (this.path.length < 2) return;

    const now = performance.now();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Рисуем путь сегментами с затуханием (старые части тусклее)
    // Разбиваем на сегменты по 20 точек для плавного затухания
    const segSize = 20;
    for (let seg = 0; seg < this.path.length - 1; seg += 1) {
      const p1 = this.path[seg];
      const p2 = this.path[seg + 1];
      if (!p2) break;

      // Возраст сегмента (0 = свежий, 1 = старый)
      const age = Math.min(1, (now - p1.t) / 120000); // 2 минуты до полного выцветания
      const alpha = 0.75 - age * 0.55;

      if (alpha <= 0.05) continue;

      // Jitter для hand-drawn стиля
      const jitter = CFG.MAP_PATH_JITTER;
      const jx1 = Math.sin(seg * 0.7 + p1.t * 0.0001) * jitter;
      const jy1 = Math.cos(seg * 0.9 + p1.t * 0.0001) * jitter;
      const jx2 = Math.sin((seg + 1) * 0.7 + p2.t * 0.0001) * jitter;
      const jy2 = Math.cos((seg + 1) * 0.9 + p2.t * 0.0001) * jitter;

      ctx.strokeStyle = `rgba(180,160,120,${alpha})`;
      ctx.lineWidth = CFG.MAP_PATH_WIDTH * (1 - age * 0.3);
      ctx.beginPath();
      ctx.moveTo(ox + p1.x * scale + jx1, oy + p1.y * scale + jy1);
      ctx.lineTo(ox + p2.x * scale + jx2, oy + p2.y * scale + jy2);
      ctx.stroke();
    }

    // Точки-засечки (стиль карандаша)
    for (let i = 0; i < this.path.length; i += 12) {
      const p = this.path[i];
      const age = Math.min(1, (now - p.t) / 120000);
      const alpha = 0.5 - age * 0.4;
      if (alpha <= 0.05) continue;
      ctx.fillStyle = `rgba(160,140,100,${alpha})`;
      ctx.beginPath();
      ctx.arc(ox + p.x * scale, oy + p.y * scale, 0.8 + (1 - age) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderSightings(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number) {
    for (const s of this.sightings) {
      const alpha = Math.min(1, s.life / (CFG.MAP_SIGHTING_LIFE * 0.3));
      const sx = ox + (s.x + s.jitter.x) * scale;
      const sy = oy + (s.y + s.jitter.y) * scale;
      const size = CFG.MAP_SIGHTING_SIZE;

      ctx.globalAlpha *= alpha;

      if (s.type === 'spider') {
        // Паук — крест с лучами
        ctx.strokeStyle = CFG.MAP_SPIDER_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + s.jitter.x;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * size * 1.5, sy + Math.sin(a) * size * 1.5);
        }
        ctx.stroke();
        ctx.fillStyle = CFG.MAP_SPIDER_COLOR;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Навь — клякса
        ctx.fillStyle = CFG.MAP_MONSTER_COLOR;
        ctx.beginPath();
        // Неровная форма
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = size * (0.7 + Math.sin(a * 3 + s.jitter.x) * 0.3);
          const px = sx + Math.cos(a) * r;
          const py = sy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Глаза
        ctx.fillStyle = 'rgba(200,180,100,0.6)';
        ctx.beginPath();
        ctx.arc(sx - 1.5, sy - 0.5, 0.8, 0, Math.PI * 2);
        ctx.arc(sx + 1.5, sy - 0.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha /= alpha;
    }
  }
}
