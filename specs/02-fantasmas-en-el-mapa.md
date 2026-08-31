# SPEC 02 — Fantasmas siempre en el mapa

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-31
> **Objetivo:** Hacer la puerta de la pocilga unidireccional (solo salida) y acelerar a 1/2/3 s la liberación tras perder una vida, para que los fantasmas estén en el mapa casi siempre.

## Por qué existe esta spec

Reporte del usuario: los fantasmas "quedan atrapados en la jaula". La simulación del código actual muestra que la salida escalonada 3/6/9 s **sí funciona**, pero hay dos causas reales: (a) los fantasmas liberados **re-entran por la puerta** cuando persiguen a un pacman situado bajo la pocilga (confirmado: inky entra por (14,12) una y otra vez), y (b) cada muerte reinicia los temporizadores a 3/6/9 s, así que con muertes frecuentes casi nunca se les ve fuera.

## Scope

**In:**

- Puerta unidireccional: la celda-puerta (valor 3) pasa a ser muro en `isWall` para todo actor. Un fantasma fuera de la pocilga nunca podrá elegir entrar; la salida no se rompe porque `leavePen` mueve a ciegas sin consultar `canMove`.
- `GHOST_RELEASE_AFTER_DEATH` en `maze.js` (0/1/2/3 s) usado por `resetPositions()` al perder una vida.
- La primera salida de la partida se mantiene en 3/6/9 s (`GHOST_RELEASE` sin cambios).

**Out of scope (para futuras specs):**

- Pausa o animación al perder una vida (congelado ~1.5 s, "READY!").
- Modo asustado, power pellets y ojos que regresan a la jaula.
- Cambiar los 3/6/9 s del arranque ni contadores de dots del arcade.
- Timestep fijo del bucle.

## Modelo de datos

```js
// maze.js (nuevo, junto a GHOST_RELEASE)
const GHOST_RELEASE_AFTER_DEATH = { blinky: 0, pinky: 1, inky: 2, clyde: 3 }; // segundos
window.GHOST_RELEASE_AFTER_DEATH = GHOST_RELEASE_AFTER_DEATH;
```

```js
// game.js — isWall: la puerta bloquea a TODOS en canMove
// antes: if ( v === 3 && actor === 'pacman' ) return true;
// ahora: if ( v === 3 ) return true;

// game.js — resetPositions()
g.releaseTimer = GHOST_RELEASE_AFTER_DEATH[ start.kind ] * 60; // antes GHOST_RELEASE
```

El parámetro `actor` de `isWall` se conserva aunque ahora trate igual a todos: la futura spec de modo asustado lo necesitará para los ojos que regresan a la jaula.

## Plan de implementación

1. `maze.js`: añadir `GHOST_RELEASE_AFTER_DEATH` y exportarla por `window`. Test manual: el juego carga sin errores de consola.
2. `game.js`: en `isWall`, la puerta (3) es muro para todos. Test manual: los 4 salen por la puerta a los ~3/~6/~9 s; con pacman quieto bajo la jaula, ningún fantasma vuelve a meterse (antes inky re-entraba cada ciclo).
3. `game.js`: `resetPositions()` usa `GHOST_RELEASE_AFTER_DEATH`. Test manual: perder una vida y comprobar que pinky/inky/clyde vuelven al mapa a los ~1/~2/~3 s.

## Criterios de aceptación

- [ ] En el arranque, pinky/inky/clyde salen a los ~3/~6/~9 s (spec 01 intacto).
- [ ] Ningún fantasma liberado vuelve a entrar por la puerta (pacman quieto bajo la pocilga, observar ≥30 s en modo persecución).
- [ ] Tras perder una vida, pinky/inky/clyde vuelven al mapa a los ~1/~2/~3 s.
- [ ] Blinky sale de inmediato tanto al inicio como tras una muerte.
- [ ] Pacman sigue sin poder entrar en la pocilga.
- [ ] Personalidades, ciclo dispersión/persecución, comer dots, ganar/perder siguen intactos.
- [ ] No hay errores en la consola del navegador.

## Decisiones

- **Sí:** puerta unidireccional vía `isWall` (1 línea). En el arcade ningún fantasma re-entra salvo los ojos comidos, que aún no existen; `leavePen` no consulta `canMove`, así que la salida sigue garantizada.
- **Sí:** liberación tras muerte a 1/2/3 s en vez de reiniciar 3/6/9 s. Con muertes frecuentes (~1 cada 10 s) clyde casi nunca salía; 1/2/3 mantiene el escalonado sin amontonar la puerta. Modifica la decisión del spec 01 de "reiniciar todos los temporizadores".
- **Sí:** mantener 3/6/9 s en el arranque y el rebote vertical previo (decisión del spec 01 confirmada por el usuario).
- **No:** salida inmediata (0 s) tras muerte. Los 4 se solaparían en la puerta.
- **No:** pausa/feedback post-muerte. Toca `main.js` y el bucle; merece su propia spec.
- **No:** archivos nuevos ni cambios en `index.html`; todo cabe en `maze.js`/`game.js`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La puerta como muro podría congelar a un fantasma dentro de la pocilga | Imposible por diseño: dentro de la pocilga `moveGhost` usa `leavePen` (a ciegas, sin `canMove`) e `inPenZone` cubre puerta + interior. Verificado en simulación. |
| El modo asustado futuro necesitará re-entrar por la puerta (ojos) | El parámetro `actor` de `isWall` se conserva; esa spec podrá relajar la regla solo para ojos. |

## Lo que **no** está en esta spec

- Pausa o animación al perder una vida.
- Modo asustado y ojos que regresan a la jaula.
- Cambios al escalonado 3/6/9 s del arranque.
