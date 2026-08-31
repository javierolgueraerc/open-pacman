// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, GHOST_CORNERS, GHOST_RELEASE,
// GHOST_RELEASE_AFTER_DEATH.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Ciclo global dispersión/persecución. 60 frames = 1 segundo (rAF).
const MODE_FRAMES = { scatter: 7 * 60, chase: 20 * 60 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      released: g.kind === 'blinky', // blinky nace fuera de la pen
      releaseTimer: GHOST_RELEASE[ g.kind ] * 60, // frames
    } ) ),
    ghostMode: 'scatter',
    modeTimer: MODE_FRAMES.scatter, // frames restantes de la fase actual
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado? Pared (1) y puerta (3) bloquean a
// todos: la puerta es unidireccional (solo salida; leavePen la cruza a
// ciegas sin consultar canMove, asi que la salida no se rompe). El parametro
// actor se conserva para la futura spec de ojos que regresan a la jaula.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo del fantasma segun modo y personalidad. Puede caer fuera del
// grid: solo se comparan distancias Manhattan, nunca se transita.
function ghostTarget( game, g ) {
  const corner = GHOST_CORNERS[ g.kind ];

  // Dispersión: cada fantasma va a su esquina.
  if ( game.ghostMode === 'scatter' ) return corner;

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ];

  if ( g.kind === 'blinky' ) {
    // Directo a la celda de Pacman.
    return { x: px, y: py };
  }

  if ( g.kind === 'pinky' ) {
    // 4 celdas por delante de Pacman segun su direccion (comportamiento
    // "correcto": sin el bug original del desplazamiento lateral con 'up').
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }

  if ( g.kind === 'inky' ) {
    // Flanqueo: 2 celdas por delante de Pacman; el vector desde Blinky
    // hasta ese punto se duplica para obtener el objetivo.
    const ax = px + pd.x * 2;
    const ay = py + pd.y * 2;
    const b = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    return { x: ax * 2 - Math.round( b.x ), y: ay * 2 - Math.round( b.y ) };
  }

  // clyde: persigue solo a mas de 8 celdas (Manhattan) de Pacman;
  // mas cerca que eso, se retira a su esquina.
  if ( Math.abs( g.x - px ) + Math.abs( g.y - py ) > 8 ) {
    return { x: px, y: py };
  }
  return corner;
}

// Elige direccion greedy: la opcion (sin marcha atras) que mas reduce la
// distancia Manhattan al objetivo. Callejon sin salida: giro de 180.
function decideGhost( game, g ) {
  const grid = game.grid;
  const t = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - t.x ) + Math.abs( ny - t.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Pocilga: mientras no esta liberado, rebota verticalmente entre las
// filas 13 y 15 del interior de la pen.
function bounceInPen( g ) {
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.dir === 'up' && g.y <= 13 ) g.dir = 'down';
    else if ( g.dir === 'down' && g.y >= 15 ) g.dir = 'up';
  }
  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// Zona pocilga: puerta (13-14, fila 12) mas interior (x 11-16, filas 13-15).
// Las demas celdas de la fila 12 son corredor normal y NO pertenecen a la
// pen, aunque compartan fila con la puerta.
function inPenZone( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  if ( y === 12 && ( x === 13 || x === 14 ) ) return true;
  return y >= 13 && y <= 15 && x >= 11 && x <= 16;
}

// Recien liberado pero aun en la pen: salir por la puerta apuntando a
// (13,11) — primero centrarse en la columna 13, luego subir. Salida
// garantizada por diseño; no hace falta comprobar muros.
function leavePen( g ) {
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.x < 13 ) g.dir = 'right';
    else if ( g.x > 13 ) g.dir = 'left';
    else g.dir = 'up';
  }
  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Dentro de la pocilga: cuenta atras de liberacion y rebote vertical.
  if ( !g.released ) {
    g.releaseTimer--;
    if ( g.releaseTimer > 0 ) {
      bounceInPen( g );
      return;
    }
    g.released = true;
  }

  // Recien liberado y aun en la pocilga: salir hasta fila <= 11. (Nadie puede
  // re-entrar: isWall trata la puerta como muro para todos.)
  if ( inPenZone( g ) ) {
    leavePen( g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.released = start.kind === 'blinky';
    g.releaseTimer = GHOST_RELEASE_AFTER_DEATH[ start.kind ] * 60;
  } );
  // El ciclo dispersión/persecución tambien vuelve a empezar.
  game.ghostMode = 'scatter';
  game.modeTimer = MODE_FRAMES.scatter;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Avanza el ciclo global: 7 s dispersion, 20 s persecucion, ciclo infinito.
function updateGhostMode( game ) {
  game.modeTimer--;
  if ( game.modeTimer <= 0 ) {
    game.ghostMode = game.ghostMode === 'scatter' ? 'chase' : 'scatter';
    game.modeTimer = MODE_FRAMES[ game.ghostMode ];
  }
}

function update( game ) {
  updateGhostMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
