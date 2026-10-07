# Roadmap V2

El MVP se centra en una sola pregunta: **¿qué porcentaje de una suite son tests placebo, que siguen en verde haga lo que haga el código?**
Todo lo que no ayuda a responderla, o a publicar ese número de forma defendible, se ha aplazado a V2.
Este documento recoge qué se ha aplazado, por qué, y lo que hay que tener en cuenta al retomarlo.

## Reglas aplazadas

### `fragile-selector`

Detectaría selectores frágiles en tests de Playwright: `nth-child`, XPath absolutos (`/html/body/div[2]/...`), rutas CSS profundas (`div > div > span`) o índices posicionales (`.nth(3)`, `.first()` sin filtro).

**Por qué se aplaza:** un test con un selector frágil *sí puede fallar*, el problema es que falla por el motivo equivocado (un cambio de maquetación, no un bug).
No es un test placebo, así que no aporta nada al número del MVP.

**A tener en cuenta:** es la regla con más riesgo de falsos positivos.
`.first()` o `.nth(0)` son legítimos cuando la lista está ordenada a propósito, y un selector CSS largo puede ser estable si usa atributos de test.
Habrá que definir umbrales (¿cuántos niveles es "profundo"?) y decidirlos con quien mantiene el proyecto, no improvisarlos.

### `happy-path-only`

Detectaría ficheros o suites sin ningún test del camino de error: ningún `rejects`, ningún `toThrow`, ninguna aserción sobre un fallo.

**Por qué se aplaza:** es un hallazgo del fichero, no de un test concreto, y tampoco suma al porcentaje.

**A tener en cuenta:** hay código que legítimamente no tiene caminos de error (funciones puras de formateo, constantes), así que un fichero sin tests de error no siempre está mal.
Se había decidido que fuera un hallazgo de fichero (`testName: null`) con severidad `warning`.

## Detección de tests comentados

Parte de la regla `skipped-test`: reportaba tests comentados (`// it('...', () => { ... })`).

**Por qué se aplaza:** era la pieza más compleja del motor (unas 150 líneas) para el hallazgo de menos valor, y los tests comentados no cuentan en el total de tests analizados porque no son código.

**Cómo recuperarla:** la implementación completa, con sus tests y fixtures, está en el commit `50bc866`.

```sh
git show 50bc866:src/engine/commented-tests.ts
```

**Criterios que ya estaban decididos y probados:**

- Solo se reporta un comentario si, a partir de alguna línea, su texto es código válido formado únicamente por declaraciones de tests o suites.
  Así `// TODO: test('large input')` (no es código válido) y `// Usage: it('x', () => {})` (es una sentencia con etiqueta) no disparan.
- Las líneas `//` consecutivas se agrupan, porque así comenta un bloque cualquier editor.
- Se permite prosa antes del test ("// Disabled until the API is back:"), no después.
- Los bloques JSDoc (`/** ... */`) no se inspeccionan nunca.
- Un comentario al final de una línea de código (`foo(); // it(...)`) no cuenta.
- El texto dentro de JSX (`<p>// it(...)</p>`) parece un comentario para el scanner de TypeScript, pero no lo es, y se descarta.

## Salidas y capas aplazadas

### Formato SARIF (`--format=sarif`)

SARIF es el formato JSON estándar para resultados de análisis estático.
Si el CI sube el fichero SARIF a GitHub, cada hallazgo aparece como anotación en la línea exacta del diff del PR, con histórico de hallazgos nuevos y corregidos.

**Por qué se aplaza:** es lo más vistoso para una demo, pero no aporta nada al número.
El MVP se queda con `--json`.

**A tener en cuenta:** GitHub Code Scanning es gratis en repositorios públicos; en privados requiere GitHub Advanced Security.
Mientras no exista, `--format=sarif` termina con código de salida 2 ("not implemented yet").

### Capa LLM opcional (`--llm`)

Una capa aislada, activada solo con `--llm`, para las preguntas que el AST no puede responder.

**Por qué se aplaza:** no aporta nada al número, y el principio de diseño del proyecto es que un detector que alucina hallazgos es peor que no tener detector.
Antes de añadir una capa no determinista conviene tener el número del MVP publicado y validado.

**A tener en cuenta:** la arquitectura ya decidida sigue vigente.
Será un módulo aparte, nunca activo por defecto, y sin API key devolverá el resultado determinista con un aviso por stderr.
Mientras tanto, la CLI acepta `--llm` y avisa de que todavía no está disponible.

### Servidor MCP

Exponer test-critic como servidor MCP para que un agente que genera tests pueda auditarlos antes de entregarlos y corregir los que no pueden fallar.

**Por qué se aplaza:** cierra muy bien la historia de "auditar tests generados por IA", pero es una forma de distribuir la herramienta, no de medir.
Tiene más sentido cuando el número del MVP esté publicado.
