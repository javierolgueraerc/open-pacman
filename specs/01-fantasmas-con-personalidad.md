# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-08-31
> **Objetivo:** Sustituir los 2 fantasmas genéricos actuales por los 4 del arcade (Blinky, Pinky, Inky y Clyde) con su personalidad clásica, alternancia dispersión/persecución y salida escalonada de la pocilga.

## Scope

**In:**

- 4 fantasmas con `kind` propio: `blinky`, `pinky`, `inky`, `clyde` (sustituyen a `hunter`/`random`).
- Persecución clásica: Blinky directo a Pac-Man; Pinky 4 celdas delante según su dirección; Inky flanquea combinando 2-celdas-delante con la posición de Blinky; Clyde persigue solo si está a más de 8 celdas de Manhattan, si no va a su esquina.
- Modo global dispersión/persecución con temporizador: 7 s dispersión / 20 s persecución, ciclo infinito.
- Pocilga: Blinky inicia fuera (sobre la puerta); Pinky, Inky y Clyde dentro, liberados a los 3, 6 y 9 s; mientras esperan rebotan verticalmente.
- Color fijo por fantasma en `render.js` (mapeado por `kind`, no por índice).
- Reinicio de posiciones y de todos los temporizadores al perder una vida.

**Out of scope (para futuras specs):**

- Power pellets y modo asustado (fantasmas comibles).
- "Cruise Elroy" (Blinky acelera al quedar pocos dots).
- Giro forzado de los fantasmas al cambiar de modo.
- Contadores de dots del arcade para liberar fantasmas.
- Timestep fijo del bucle.

## Modelo de datos

```js
// maze.js (nuevo)
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // sobre la puerta, fuera de la pocilga
  { x: 13, y: 14, kind: 'pinky'  },
  { x: 11, y: 14, kind: 'inky'   },
  { x: 16, y: 14, kind: 'clyde'  },
];
const GHOST_CORNERS = {
  blinky: { x: 26, y: 1 }, pinky: { x: 1, y: 1 },
  inky:   { x: 26, y: 29 }, clyde: { x: 1, y: 29 },
};
const GHOST_RELEASE = { blinky: 0, pinky: 3, inky: 6, clyde: 9 }; // segundos
```

```js
// game.js — cambios en createGame()
ghosts: GHOST_STARTS.map( ( g ) => ( {
  x: g.x, y: g.y, dir: 'up', speed: GHOST_SPEED, kind: g.kind,
  released: g.kind === 'blinky',
  releaseTimer: GHOST_RELEASE[ g.kind ] * 60, // frames
} ) ),
ghostMode: 'scatter',
modeTimer: 7 * 60, // frames restantes de la fase actual
```

Convenciones: 60 frames = 1 segundo (rAF); esquinas de dispersión aunque caigan en pared (solo se comparan distancias, no se transitan); los objetivos fuera del grid no se recortan por el mismo motivo.

## Plan de implementación

1. `maze.js`: sustituir `GHOST_STARTS` por las 4 entradas y añadir `GHOST_CORNERS` y `GHOST_RELEASE`, exportándolas por `window`. Test manual: el juego carga con 4 fantasmas apilados (aún con lógica vieja).
2. `render.js`: mapear color por `kind` en lugar de por índice. Test manual: rojo/rosa/cian/naranja fijos.
3. `game.js`: añadir `ghostMode`, `modeTimer`, `released` y `releaseTimer` en `createGame()`, y avanzar/alternar el modo en `update()`. Test manual: se aprecia el cambio de ritmo cada ~27 s.
4. `game.js`: comportamiento en la pocilga — rebote vertical mientras `!released`, cuenta atrás de `releaseTimer`, y al liberarse apuntar a (13,11) hasta salir (fila ≤ 11). Test manual: salidas escalonadas por la puerta.
5. `game.js`: objetivo por personalidad en persecución y esquina en dispersión, unificando `decideGhost` en un greedy por distancia para los 4. Test manual: cada uno actúa distinto.
6. `game.js`: `resetPositions()` restaura también `released`, `releaseTimer` y el ciclo de modo. Test manual: morir reinicia el patrón de salidas.

## Criterios de aceptación

- [ ] Hay exactamente 4 fantasmas y cada uno conserva su color fijo toda la partida.
- [ ] Blinky empieza fuera de la pocilga y traza ruta directa hacia la celda de Pac-Man.
- [ ] Pinky, Inky y Clyde salen escalonados de la pocilga a los ~3, ~6 y ~9 s.
- [ ] Pinky corta el paso por delante de Pac-Man, no sigue su celda actual.
- [ ] Inky converge en flanqueo combinando la posición de Pac-Man y la de Blinky.
- [ ] Clyde se retira a su esquina al acercarse a ≤8 celdas de Pac-Man.
- [ ] Cada ~27 s se observa una fase de dispersión donde los 4 van a su esquina.
- [ ] Comer todos los dots gana y la tercera colisión pierde (reglas intactas).
- [ ] Al perder una vida, fantasmas y temporizadores vuelven a su estado inicial.
- [ ] No hay errores en la consola del navegador.

## Decisiones

- **Sí:** personalidades clásicas del arcade. Fieles a la petición y contrastables con el original.
- **Sí:** ciclo fijo 7 s dispersión / 20 s persecución, infinito. Simplifica el calendario del arcade (7,20,7,20,5,20,5,∞).
- **Sí:** liberación por temporizador (3/6/9 s) reiniciado al morir. Los contadores de dots del arcade aportan poco aquí.
- **Sí:** misma velocidad para los 4. La agresividad de Blinky es de objetivo, no de velocidad.
- **No:** modo asustado y power pellets. Requiere cambios en `MAZE_STR`, estado frightened y regreso de ojos; merece su propia spec.
- **No:** giro forzado al cambiar de modo. Detalle fino del arcade que complica el cambio de fase sin aportar jugabilidad clara.
- **No:** bug original de Pinky con dirección 'up' (objetivo desplazado 4 a la izquierda). Se implementa el comportamiento "correcto".
- **No:** archivos nuevos. Todo cabe en `maze.js`/`game.js`/`render.js`; `index.html` no cambia.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Objetivos de Pinky/Inky caen fuera del grid | No hace falta recortar: solo se comparan distancias Manhattan, nunca se transita el objetivo. |
| Fantasma liberado no encuentra la salida de la pocilga | Salida garantizada por diseño: objetivo (13,11) y puerta transitable para fantasmas (ya en `isWall`). |
| Monitores de 120+ Hz aceleran los temporizadores | Problema preexistente (todo el juego es por frame); no se agrava con esta spec. Timestep fijo va en otra spec. |

## Lo que **no** está en esta spec

- Power pellets y modo asustado.
- "Cruise Elroy" y velocidades diferenciadas.
- Giro forzado en el cambio de modo ni contadores de dots.
- Timestep fijo del bucle.

Cada una de esas, si llega, va en su propia spec.
