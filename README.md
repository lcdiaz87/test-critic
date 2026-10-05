# test-critic

**Find tests that cannot fail.**

`test-critic` is a static analyser for Jest, Vitest and Playwright test files (TypeScript and JavaScript).
It flags tests that add coverage without reducing risk: no assertion, tautological assertions, assertions that may never run, un-awaited promises, swallowed errors.
Built to audit AI-generated test suites, it favours zero false positives over recall, and runs fully offline on a deterministic AST engine.

*The rest of this document is in Spanish.*

---

> **Estado:** en desarrollo. Ya funcionan `no-assertion`, `tautological-assertion` y `skipped-test` con la salida en tabla; el resto de reglas y los formatos `json` y `sarif` se están implementando.
> Todavía no está publicado en npm.

## El problema

El coverage mide qué líneas *se ejecutaron*, no si algo *comprobó* lo que hicieron.
Este test consigue un 100% de coverage de líneas sobre `parseConfig` y no puede fallar nunca:

```ts
it('parses the config', async () => {
  try {
    const config = parseConfig(raw);
    if (config.valid) {
      expect(config).toEqual(config);
    }
  } catch (e) {
    console.log(e);
  }
});
```

La aserción es tautológica (compara un valor consigo mismo), está detrás de una condición que puede ser falsa, y cualquier excepción se captura y solo se imprime.
Alguien que revise por encima un fichero de 400 líneas de tests generados no lo va a ver.
Una herramienta sí.

Este patrón es especialmente frecuente en tests generados por IA: la suite está en verde, el coverage es alto, y una parte importante de los tests seguiría en verde hiciera lo que hiciera el código que dicen probar.

## Reglas

| Regla | Qué detecta |
| --- | --- |
| `no-assertion` | El cuerpo del test no contiene ninguna aserción. |
| `tautological-assertion` | Una aserción que siempre pasa: `expect(true).toBe(true)`, `expect(x).toBe(x)`, `expect(1).toBeTruthy()`. |
| `conditional-assertion` | La aserción está dentro de un `if`, un ternario o un `try` y puede no ejecutarse nunca. |
| `missing-await` | Una llamada que devuelve una Promise sin `await`, incluidos `expect(...).resolves` y las APIs de Playwright. |
| `swallowed-error` | Un `catch` vacío, o uno que solo hace `console.log` sin relanzar el error ni hacer ninguna aserción. |
| `fragile-selector` | Selectores por `nth-child`, XPath absolutos, rutas CSS profundas o índices posicionales. |
| `skipped-test` | `.skip`, `.todo`, `xit`, `xdescribe` o tests comentados. |
| `happy-path-only` | Un fichero o suite sin ningún test del camino de error: ningún `rejects`, ningún `toThrow`, ninguna aserción sobre un fallo. |

Cada hallazgo indica el id de la regla, la severidad (`error` o `warning`), el fichero, la línea, la columna, el nombre del test y una frase explicando por qué importa.

### Qué cuenta como aserción

`no-assertion` es estricta: las acciones que *podrían* lanzar un error (`page.click()`, `getByRole()`, llamar al código bajo prueba) no cuentan como aserción.
Si un test solo hace clic en botones, pasa aunque la página muestre datos incorrectos.

Sí cuentan:

- Llamadas a `expect`, `assert` o `should` en cualquier punto de la cadena: `expect(x).toBe(y)`, `assert.equal(a, b)`, `sinon.assert.calledOnce(spy)`, `x.should.equal(y)`.
- Helpers que siguen la convención `expect*` / `assert*`, como `expectValidUser(user)`.
- Funciones del mismo fichero que a su vez hacen una aserción o lanzan un error.
- Un `throw` explícito.
- Un callback `done` que puede recibir un error: `done(err)`, `done.fail()` o pasarlo a otra función (`server.close(done)`). Un `done()` sin argumentos solo dice "he terminado" y no comprueba nada.

### Por qué algunas cosas no se reportan

Con la prioridad de cero falsos positivos, varias decisiones dejan pasar casos reales a propósito:

- **`expect(obj.prop).toBe(obj.prop)` no se reporta.** Leer una propiedad dos veces puede ejecutar un getter dos veces, y comprobar que un getter memoizado devuelve la misma instancia es un test legítimo que sí puede fallar. Con variables simples (`expect(x).toBe(x)`) no hay esa ambigüedad.
- **Si un fichero define su propio `it` o `test`**, sus llamadas no se tratan como tests: no sabemos qué hacen. Las importaciones, incluido `require`, sí se aceptan.
- **Un fichero con errores de sintaxis se salta entero** y se avisa por stderr. El parser de TypeScript siempre devuelve un árbol aunque el código esté roto, y analizar un árbol a medias es la forma más fácil de inventarse hallazgos.
- **Un test comentado solo se reporta si el comentario, a partir de alguna línea, es código válido formado únicamente por declaraciones de tests.** `// TODO: test('large input')` no es código válido, y `// Usage: it('x', () => {})` se parsea como una sentencia con etiqueta, no como un test. Los bloques JSDoc no se inspeccionan nunca.
- **Los skips condicionales no se reportan:** `test.skip(browserName === 'webkit', 'motivo')` en Playwright o `it.skipIf(cond)` en Vitest son decisiones deliberadas según el entorno.

## Uso

```
test-critic <glob...> [--format=table|json|sarif] [--json] [--min-severity=warning|error] [--llm]
```

```sh
npx test-critic "src/**/*.test.ts" "e2e/**/*.spec.ts"
```

La salida por defecto es una tabla seguida de un resumen de una línea:

```
120 tests analysed · 34 cannot fail (28%) · 51 findings across 8 rules
```

Un test cuenta como *cannot fail* cuando está saltado (incluidos los que están dentro de una suite saltada) o cuando tiene un hallazgo que, por sí solo, demuestra que no puede fallar.
No todos los hallazgos lo demuestran: una aserción tautológica junto a otra real se reporta, pero el test sigue pudiendo fallar gracias a la otra, así que no cuenta.
Los tests comentados se reportan, pero no están en el total de tests analizados porque no son código.
`fragile-selector` y `happy-path-only` se reportan como hallazgos pero no cuentan para ese porcentaje: un test con un selector frágil sí puede fallar, el problema es que puede fallar por el motivo equivocado.

| Código de salida | Significado |
| --- | --- |
| `0` | Ningún hallazgo de severidad `error`. |
| `1` | Al menos un hallazgo de severidad `error`. |
| `2` | Error de ejecución: argumentos inválidos, ningún fichero encontrado o un fallo interno. |

Distinguir `1` de `2` permite que un pipeline de CI sepa si los tests tienen problemas o si la herramienta está mal configurada.

## Arquitectura: determinista primero, LLM opcional

Todas las reglas se ejecutan sobre una **capa determinista basada en el AST**, construida con [`ts-morph`](https://ts-morph.com/).
El AST (árbol de sintaxis abstracta) es la representación estructurada del código que usa el propio compilador de TypeScript: en lugar de buscar texto con expresiones regulares, la herramienta recorre llamadas, bloques y expresiones reales.
No necesita red ni API keys, y la misma entrada produce siempre la misma salida.

Existe una **capa LLM opcional** para las pocas preguntas que el AST no puede responder.
Vive en su propio módulo, solo se activa con el flag explícito `--llm`, nunca está activa por defecto, y si no hay API key configurada devuelve el resultado determinista sin más.

El motivo de esta separación:

> **Un detector que alucina hallazgos es peor que no tener detector.**

Un falso positivo en una herramienta de calidad no solo le hace perder un minuto a quien revisa.
Le enseña al equipo que la salida de la herramienta se puede ignorar, y a partir de ahí también se ignoran los hallazgos verdaderos.
Por eso `test-critic` prioriza **cero falsos positivos** por encima de detectarlo todo.
Una regla que no se puede implementar sin falsos positivos se deja fuera, no se relaja.
Ante la duda, la herramienta no dice nada.

## Una suite de tests que sí puede fallar

Una herramienta que audita tests necesita tests que puedan fallar.
Cada regla viene con fixtures: ficheros de test reales que **deben** disparar la regla, y ficheros limpios que **no deben** dispararla.
Se comprueban las dos direcciones, así que si una regla deja de detectar lo que debe, el build falla, y si empieza a marcar código correcto, también.

## Desarrollo

Requiere Node.js 22 o superior.

```sh
npm install
npm run check      # typecheck + lint + tests
npm run build      # compila a dist/
node dist/bin.js "test/fixtures/**/*.ts"
```

## Licencia

[MIT](LICENSE)
