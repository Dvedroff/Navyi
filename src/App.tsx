import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, GameState } from './game/engine';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(performance.now());

  const [gameState, setGameState] = useState<GameState>('menu');
  const [fuel, setFuel] = useState(100);
  const [spirit, setSpirit] = useState(100);
  const [relics, setRelics] = useState(0);
  const [wellOpen, setWellOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [deathMsg, setDeathMsg] = useState('');
  const [finalScore, setFinalScore] = useState(0);
  const [record, setRecord] = useState(0);
  const [bloodActive, setBloodActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wellAngle, setWellAngle] = useState(0);

  // Тост-таймер
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 4000);
  }, []);

  // HUD throttled до 8 Hz
  const lastHudRef = useRef(0);
  const updateHUD = useCallback((now: number) => {
    if (now - lastHudRef.current < 125) return;
    lastHudRef.current = now;
    const g = gameRef.current;
    if (!g || g.state !== 'play') return;
    setFuel(g.player.fuel);
    setSpirit(g.player.spirit);
    setRelics(g.relics);
    setWellOpen(g.wellOpen);
    setBloodActive(g.player.spirit < 35);
    if (g.wellOpen) setWellAngle(g.wellAngle);
  }, []);

  // Игровой цикл
  const gameLoop = useCallback((now: number) => {
    rafRef.current = requestAnimationFrame(gameLoop);
    const g = gameRef.current;
    if (!g) return;

    let dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    if (dt > 0.05) dt = 0.05; // clamp

    try {
      g.update(dt);
      g.render();
      updateHUD(now);
    } catch (e) {
      console.error('Game loop error:', e);
    }
  }, [updateHUD]);

  // Инициализация
  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game();
    gameRef.current = game;
    game.init(canvasRef.current);
    setRecord(game.getRecord());

    // Callbacks
    game.onStateChange = (state) => {
      setGameState(state);
      if (state === 'loading') setIsLoading(true);
      else setIsLoading(false);
    };
    game.onToast = (msg) => showToast(msg);
    game.onDeath = (msg, score) => {
      setDeathMsg(msg);
      setFinalScore(score);
      setRecord(game.getRecord());
    };
    game.onWin = (score) => {
      setFinalScore(score);
      setRecord(game.getRecord());
    };

    // Запуск цикла
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop, showToast]);

  // Начало игры
  const handleStart = () => {
    gameRef.current?.startGame();
    // Инициализация звука при первом взаимодействии
    gameRef.current?.sound.resume();
  };

  // Рестарт
  const handleRestart = () => {
    gameRef.current?.startGame();
  };

  // Продолжить
  const handleResume = () => {
    if (gameRef.current) {
      gameRef.current.state = 'play';
      setGameState('play');
      gameRef.current.sound.resume();
    }
  };

  const fuelPct = (fuel / 100) * 100;
  const spiritPct = (spirit / 100) * 100;

  return (
    <div className="game-container">
      {/* Canvas */}
      <canvas ref={canvasRef} className="game-canvas" id="game-canvas" />

      {/* CSS оверлеи */}
      <div className="overlay-torch" />
      <div className="overlay-vignette" />
      <div className="overlay-grain" />
      <div className={`overlay-blood ${bloodActive ? 'active' : ''}`} />

      {/* HUD */}
      {gameState === 'play' && (
        <>
          <div className="hud">
            <div className="hud-bars">
              <div className="hud-bar" title="Смола">
                <div className="hud-bar-fill fuel" style={{ transform: `scaleX(${fuelPct / 100})` }} />
              </div>
              <div className="hud-bar" title="Дух">
                <div className="hud-bar-fill spirit" style={{ transform: `scaleX(${spiritPct / 100})` }} />
              </div>
              <div style={{ fontSize: '10px', color: '#5a4a3a', marginTop: '2px' }}>
                🕯 {Math.floor(fuel)}% · ✦ {Math.floor(spirit)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hud-relics">◈ {relics} / 5</div>
              <div className="hud-score">рекорд: {record}</div>
            </div>
          </div>
          {/* Подсказка управления для мобильных */}
          <div style={{
            position: 'fixed',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            color: 'rgba(100,80,60,0.4)',
            pointerEvents: 'none',
            zIndex: 15,
            textAlign: 'center'
          }}>
            ← тач слева: движение · тач справа: вспышка →
          </div>
        </>
      )}

      {/* Индикатор колодца */}
      {wellOpen && gameState === 'play' && (
        <div className="well-indicator visible">
          <svg viewBox="0 0 32 32" style={{ 
            animation: 'pulse 2s ease-in-out infinite',
            transform: `rotate(${wellAngle}rad)`,
            transition: 'transform 0.3s ease-out'
          }}>
            <circle cx="16" cy="16" r="10" strokeWidth="1.5" />
            <path d="M16 4 L16 10 M14 6 L16 3 L18 6" strokeWidth="2" />
          </svg>
          <div style={{ color: '#8a9a6a', fontSize: '11px', textAlign: 'center', marginTop: '4px', letterSpacing: '2px' }}>
            ◈ КОЛОДЕЦ ◈
          </div>
        </div>
      )}

      {/* Тост */}
      <div className={`toast ${toastVisible ? 'visible' : ''}`}>{toast}</div>

      {/* Экран меню */}
      {gameState === 'menu' && !isLoading && (
        <div className="screen-overlay">
          <div style={{
            position: 'absolute',
            top: '15%',
            fontSize: '60px',
            opacity: 0.15,
            animation: 'pulse 4s ease-in-out infinite'
          }}>🕯</div>
          <div className="screen-title">НАВЬ</div>
          <div className="screen-subtitle">
            Последний факел
            <br /><br />
            <span style={{ fontSize: '12px', color: '#5a4a3a', lineHeight: '1.8' }}>
              Тёмные подклети. Сырой камень.<br />
              Гнилое дерево и ржавая жесть.<br />
              Факел — твой единственный долг.<br /><br />
              <em>Собери пять оберегов. Найди колодец. Выйди.</em>
            </span>
          </div>
          <button className="screen-btn" onClick={handleStart}>
            ▽ СПУСТИТЬСЯ ▽
          </button>
          <div style={{ marginTop: '24px', fontSize: '11px', color: '#4a3a2a', lineHeight: '1.8' }}>
            <span style={{ color: '#6a5a4a' }}>WASD</span> — движение · <span style={{ color: '#6a5a4a' }}>Shift</span> — бег<br />
            <span style={{ color: '#6a5a4a' }}>Space</span> — вспышка · <span style={{ color: '#6a5a4a' }}>P</span> — пауза · <span style={{ color: '#6a5a4a' }}>M</span> — звук
          </div>
          {record > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#6a5a4a' }}>
              Лучший забег: {record}
            </div>
          )}
        </div>
      )}

      {/* Загрузка */}
      {isLoading && (
        <div className="loading-screen">
          СПУСК...
        </div>
      )}

      {/* Пауза */}
      {gameState === 'pause' && (
        <div className="screen-overlay">
          <div className="screen-title" style={{ fontSize: '32px' }}>ПАУЗА</div>
          <div className="screen-subtitle">
            Тьма ждёт. Факел тоже.
          </div>
          <button className="screen-btn" onClick={handleResume}>
            ПРОДОЛЖИТЬ
          </button>
        </div>
      )}

      {/* Смерть */}
      {gameState === 'dead' && (
        <div className="screen-overlay">
          <div className="screen-title" style={{ color: '#6a3030' }}>НАВЬ ВЗЯЛА</div>
          <div className="screen-subtitle" style={{ fontStyle: 'italic' }}>
            {deathMsg}
          </div>
          <div className="screen-stats">Очки: {finalScore}</div>
          <div className="screen-stats">Рекорд: {record}</div>
          <button className="screen-btn" onClick={handleRestart} style={{ marginTop: '16px' }}>
            СНОВА СПУСТИТЬСЯ
          </button>
        </div>
      )}

      {/* Победа */}
      {gameState === 'win' && (
        <div className="screen-overlay">
          <div className="screen-title" style={{ color: '#6a8a5a' }}>ВЫХОД</div>
          <div className="screen-subtitle">
            Колодец открыл глотку. Ты прошёл.
            <br /><br />
            <span style={{ fontSize: '12px', color: '#5a6a4a' }}>
              Но навь помнит. Она всегда помнит.
            </span>
          </div>
          <div className="screen-stats">Очки: {finalScore}</div>
          <div className="screen-stats">Рекорд: {record}</div>
          <button className="screen-btn" onClick={handleRestart} style={{ marginTop: '16px' }}>
            СНОВА СПУСТИТЬСЯ
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
