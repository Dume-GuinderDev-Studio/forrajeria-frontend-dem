# Bug: `.cardSub` renderiza `#94a3b8` cuando el fuente dice `#47596b`

> **Estado:** diagnóstico cerrado, **sin fix aplicado**.
> **Fecha:** 2026-09-10
> **Alcance:** solo lectura / investigación. No se modificó ningún archivo de código.
> **Veredicto:** ⚠️ **no es un bug del código fuente — es un build stale en `dist/`.**

---

## Resumen ejecutivo

La clase `.cardSub` del Dashboard renderiza `#94a3b8` en el navegador, mientras
el archivo fuente declara `color: #47596b`.

**La causa no está en el código.** El `dist/` que se está sirviendo fue
construido **antes** del cambio de color y nunca se regeneró. El CSS compilado
corresponde al estado **anterior** del archivo en git, no al que está en el
working tree.

**Indicador clave:** el nombre compilado es `._cardSub_17ekw_146`. El sufijo
numérico de CSS Modules es la **línea del selector en el archivo al momento de
generar el CSS**. El `146` corresponde al estado en HEAD; el archivo actual
tiene el selector en la línea **143**. Ese desfase de 3 líneas es la prueba
definitiva.

---

## PASO 1 — Todas las definiciones de `.cardSub`

Existen **dos** en el proyecto:

| Path | Línea | Color |
|---|---|---|
| `src/ui/pages/DashboardPage/DashboardPage.module.css` | 143 | **`#47596b`** ← el esperado |
| `src/ui/pages/CashRegisterPage/CashRegisterPage.module.css` | 258 | **`#94a3b8`** |

Ambas declaran exactamente las mismas propiedades:

```css
.cardSub {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: <distinto en cada archivo>;
}
```

### Esto NO es la causa del bug reportado

Los cuatro textos citados en el reporte ("0 tickets", "2 tickets",
"Promedio por venta confirmada", "Ventas menos costo de productos") están
todos en `src/ui/pages/DashboardPage/DashboardPage.tsx:177-205`:

```tsx
sub: `${metrics.today.orders} ${metrics.today.orders === 1 ? 'ticket' : 'tickets'}`,  // :177
sub: `${metrics.week.orders} ${metrics.week.orders === 1 ? 'ticket' : 'tickets'}`,   // :184
sub: `${metrics.month.orders} ${metrics.month.orders === 1 ? 'ticket' : 'tickets'}`, // :191
sub: 'Promedio por venta confirmada',                                               // :198
sub: 'Ventas menos costo de productos',                                             // :205
```

→ El elemento inspeionado pertenece al **DashboardPage**, no al CashRegisterPage.
La coincidencia de nombre de clase queda descartada como causa.

---

## PASO 2 — El import es correcto

`DashboardPage.tsx` importa su propio módulo CSS:

```tsx
import styles from './DashboardPage.module.css';
```

Cada componente tiene su módulo en su propia carpeta; no hay imports cruzados
ni rutas a archivos viejos o duplicados. **No hay import equivocado.**

---

## PASO 3 — La evidencia: el número `146` no corresponde al fuente actual

CSS Modules genera el sufijo de cada clase usando la **línea del selector en el
archivo en el momento de compilar**. Comparando los tres estados:

| Estado | Ubicación | `color` | Línea del selector |
|---|---|---|---|
| **HEAD** (commit `8407851`) | — | `#94a3b8` | **146** |
| **Working tree** (sin commitear) | `DashboardPage.module.css:143` | `#47596b` | **143** |
| **CSS compilado** | `dist/assets/index-BU9VeDgx.css` | `#94a3b8` | **`_cardSub_17ekw_146`** |

El `146` que se observa en el inspector coincide con **HEAD**, no con el archivo
que se tiene abierto.

Además, el CSS compilado es una única regla sin variantes:

```css
._cardSub_17ekw_146{margin-top:.25rem;font-size:.875rem;line-height:1.25rem;color:#94a3b8}
```

- No hay variante `.dark ._cardSub_...`
- No hay media query que toque `.cardSub`
- Las otras tres propiedades coinciden con el fuente porque **nunca se editaron**;
  solo se cambió el `color`

Por eso el síntoma se presenta como "todo coincide salvo el color", que es
exactamente la hipótesis planteada en el paso 3 del reporte original.

---

## PASO 4 — De dónde viene `#94a3b8`

### 4.1 Cadena de evidencia

| Chequeo | Resultado |
|---|---|
| `#47596b` presente en `dist/` | ❌ **no aparece en ningún archivo** |
| `#47596b` presente en `src/` | ✅ 2 veces (`:127` y `:147`) |
| mtime de `dist/assets/*` | `2026-09-24 23:24` |
| commit `8407851` | `2026-09-24 23:47` |
| `dist/index.html` sirve | `index-CWD7sa2U.js` + `index-DfG_qmxn.css` |
| ese JS importa | `index-BU9VeDgx.css` ← contiene `._cardSub_17ekw_146` con `#94a3b8` |

El `dist/` se construyó a las **23:24**; el commit es de las **23:47**; y el
cambio a `#47596b` está **sin commitear** (por eso el archivo figura como
modificado en `git status`). El build es anterior a la edición y nunca se
regeneró.

### 4.2 Por qué solo se manifiesta en algunos entornos

El `dist/` es un **artefacto**, no la fuente de verdad:

| Cómo se levanta | ¿Qué se sirve? | Color resultante |
|---|---|---|
| `npm run dev` | fuente, vía Vite | ✅ `#47596b` |
| `vite preview` / estático / deploy | `dist/` | ❌ `#94a3b8` (stale) |

### 4.3 Verificación rápida en el navegador

1. Panel **Network** → pestaña **CSS**: si `._cardSub_17ekw_146` proviene de
   `/assets/index-BU9VeDgx.css` servido desde `dist/`, es esto.
2. Consola:
   ```js
   getComputedStyle(document.querySelector('._cardSub_17ekw_146')).color
   ```
   Comparar con el archivo al que linkea DevTools.
3. Levantar `npm run dev` y recargar: si el color pasa a `#47596b`, cerrado.

---

## Riesgos abiertos (no resueltos por este diagnóstico)

### ⚠️ 1. El valor `#47596b` tampoco está versionado

`src/ui/pages/DashboardPage/DashboardPage.module.css` figura como **modificado
respecto a HEAD**, y el cambio a `#47596b` está entre esas modificaciones sin
commitear. Es decir: el valor que se considera correcto **no está en git**.

Los cambios sin commitear del archivo no se limitan al color: la línea 127
también pasó a `#47596b`, en un bloque distinto:

```css
:global(.dark) .cardTitle {
  color: #47596b;
}
```

> **Consecuencia:** regenerar el build va a cambiar el color, pero no
> necesariamente al valor final buscado, porque el resto del diff del archivo
> tampoco está versionado. **Hay que revisar ese diff antes de decidir que el fix
> es "rebuildear".**

### ⚠️ 2. `.cardSub` está duplicado en dos módulos

Dos archivos, mismo nombre de clase, mismas propiedades declaradas, distinto
color. Hoy no hay cascada (ninguna regla `.dark` ni media query lo toca), pero:

- cualquier cambio de estilo en uno exige revisar el otro
- el síntoma de un desincronismo futuro sería **idéntico** al de este bug

Conviene tratarlo como tarea aparte (extraer a un módulo compartido o renombrar),
no como parte de este fix.

---

## Opciones de resolución (propuestas, NO aplicadas)

Ninguna requiere tocar la lógica de los componentes.

| # | Acción | Consideración |
|---|---|---|
| 1 | Rebuild de `dist/` | Solo si el diff sin commitear ya está revisado y aprobado (ver riesgo 1) |
| 2 | Revisar y commitear el diff de `DashboardPage.module.css` | **Previo y necesario** antes de la opción 1 |
| 3 | Eliminar la duplicación de `.cardSub` | Tarea independiente, fuera del alcance de este bug |
| 4 | Agregar `dist/` a `.gitignore` | Evita que un build stale se confunda con fuente; decisión de proyecto |

---

## Referencias de código

| Ubicación | Qué contiene |
|---|---|
| `src/ui/pages/DashboardPage/DashboardPage.module.css:143` | `.cardSub` con `#47596b` (working tree) |
| `src/ui/pages/DashboardPage/DashboardPage.module.css:127` | `:global(.dark) .cardTitle` con `#47596b` |
| `src/ui/pages/CashRegisterPage/CashRegisterPage.module.css:258` | `.cardSub` con `#94a3b8` (duplicado) |
| `src/ui/pages/DashboardPage/DashboardPage.tsx:60` | Render de `<p className={styles.cardSub}>` |
| `src/ui/pages/DashboardPage/DashboardPage.tsx:177-205` | Origen de los textos "tickets" / "Promedio por venta" / "Ventas menos costo" |
| `dist/assets/index-BU9VeDgx.css` | CSS compilado stale con `._cardSub_17ekw_146` → `#94a3b8` |
| `dist/index.html` | Entrypoint que sirve `index-CWD7sa2U.js` |
| commit `8407851` | "refactor(styles): migrate Tailwind to CSS Modules with per-component folders" |
