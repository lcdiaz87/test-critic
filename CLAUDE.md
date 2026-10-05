# test-critic: contexto del proyecto

CLI en TypeScript que analiza estáticamente ficheros de test (Jest / Vitest / Playwright, en TS y JS) y detecta **tests que no pueden fallar**: los que suman cobertura pero no reducen riesgo.
Está pensada para auditar tests generados por IA.
Es un proyecto de portfolio público y también está pensado para que otras personas aprendan de él: el código, los comentarios y la documentación deben explicar el *porqué* (por qué un patrón no puede fallar, por qué se tomó una decisión de diseño), no solo el *qué*.

## Idioma y estilo de escritura

- **Español:** README (salvo el resumen inicial), documentación, este fichero y la conversación con quien mantiene el proyecto.
- **Inglés:** el código (identificadores y comentarios), la salida de la CLI, los mensajes de commit y el resumen en inglés al principio del README.
- La prosa nunca se corta a mitad de frase: una frase por línea, salto de línea solo después de un punto.

## Arquitectura (no negociable)

- **La capa determinista con AST (`ts-morph`) es el motor.** Todas las reglas del MVP viven aquí. Sin red, sin API keys, salida reproducible.
- **Capa LLM opcional** detrás del flag explícito `--llm`, en un módulo aparte, nunca activa por defecto, solo para lo que el AST no alcanza. Si no hay API key, degrada limpiamente (resultado determinista + aviso por stderr).
- El motivo, escrito en el README: *un detector que alucina hallazgos es peor que no tener detector*. Un falso positivo en una herramienta de calidad destruye la confianza en la herramienta.

## Cero falsos positivos antes que detectarlo todo

Es la directiva principal al implementar reglas.
Si una regla no se puede implementar sin falsos positivos, **se consulta con quien mantiene el proyecto** y se deja fuera del MVP.
Nunca se relaja en silencio.
Si un patrón es ambiguo, la regla no dice nada.

## Reglas del MVP (exactamente estas seis)

| id | qué detecta |
| --- | --- |
| `no-assertion` | el cuerpo del test no tiene ninguna aserción alcanzable |
| `tautological-assertion` | `expect(true).toBe(true)`, `expect(x).toBe(x)`, literal comparado consigo mismo |
| `conditional-assertion` | aserción dentro de `if` / ternario / `try`, puede no ejecutarse nunca |
| `missing-await` | llamada que devuelve Promise sin `await` (incluido `expect(...).resolves` y APIs de Playwright) |
| `swallowed-error` | `catch` vacío, o que solo hace `console.log` sin relanzar ni aserción |
| `skipped-test` | `.skip`, `.todo`, `xit`, `xdescribe`, tests comentados |

`fragile-selector` y `happy-path-only` se aplazaron a V2 porque un test con esos problemas sí puede fallar; ver `ROADMAP-V2.md`.

Cada hallazgo lleva: `ruleId`, `severity` (`error` | `warning`), fichero, línea, columna, nombre del test y una frase de por qué importa.
Ver `src/types.ts`.

### Decisiones ya tomadas

- **Recuento "cannot fail"** (porcentaje del resumen): un test cuenta si está **saltado** (también por estar dentro de una suite saltada) o tiene un hallazgo que *por sí solo* demuestra que no puede fallar (`RuleHit.makesTestUnableToFail`). Ejemplo: una tautología junto a una aserción real se reporta pero no cuenta. Los tests comentados se reportan pero no entran en el total (no son código).
- **`no-assertion` es estricta:** un test sin aserción explícita es `error`, aunque haga acciones que puedan lanzar (p. ej. `click()` o `getBy*` de Playwright). Las aserciones implícitas no cuentan. Sí cuentan: `expect`/`assert`/`should` en la cadena del callee, helpers `expect*`/`assert*`, funciones del mismo fichero que aseveran o lanzan, `throw`, y `done(err)` / `done.fail` / pasar `done` a otra función (no en tests `.each`). Ver `src/engine/assertions.ts`.
- **`tautological-assertion` no reporta accesos a propiedades** (`expect(a.b).toBe(a.b)`): un getter memoizado hace que sea un test legítimo. Solo literales y la misma variable simple en los dos lados.
- **Ficheros con errores de sintaxis se saltan** con aviso por stderr; nunca se analizan árboles a medias.
- **Un `it`/`test`/`describe` declarado localmente en el fichero** (no importado ni `require`) no se trata como runner.
- **`missing-await` es sintáctica,** no usa el type checker: solo patrones conocidos (`expect().resolves/rejects`, matchers async de Playwright, métodos de `page`/`locator`, funciones `async` declaradas en el mismo fichero). Funciona en JS y sin las dependencias del proyecto auditado.
- **Tests comentados:** solo se reportan cuando el texto del comentario se parsea como una llamada real `it(...)`/`test(...)`, así que una frase que mencione "test" nunca dispara.
- Recuento de tests: cada llamada `it`/`test` cuenta una vez; `it.each(...)` cuenta una vez.

- **Nombre del concepto: "placebo tests"** (en español, "tests placebo"): tienen la forma de un test pero no tienen efecto, siguen en verde haga lo que haga el código. Sustituye a "cannot fail" en README, resumen de la CLI (`120 tests analysed · 34 placebo (28%) · ...`) y nombres internos. Se descartó "fake tests" porque *fake* ya es un tipo de doble de prueba (como mock o stub). El renombrado está pendiente como paso propio.
- **El proyecto mide, no solo detecta.** `eslint-plugin-jest` ya tiene reglas parecidas (`expect-expect`, `no-conditional-expect`, `no-disabled-tests`, `valid-expect`); lo que aporta test-critic es el porcentaje de tests placebo de una suite y el estudio sobre tests generados por IA. El README tendrá una sección "¿Por qué no basta con eslint-plugin-jest?".

### Pendiente de decidir

- **Corpus para el número publicado:** antes de la fase 4 hay que parar y proponer opciones (qué aplicaciones, qué modelo, qué prompt, cómo documentarlo para que el número sea defendible). Propuesta a discutir: validar los hallazgos de test-critic contra mutation testing (Stryker) sobre las mismas apps, para medir la precisión con una referencia externa, y pasar también `eslint-plugin-jest` sobre el mismo corpus para comparar. Puede afectar a si `conditional-assertion` cuenta como placebo.

## Contrato de la CLI

```
test-critic <glob...> [--json] [--format=table|json|sarif] [--llm] [--min-severity=X]
```

- Salida por defecto: tabla legible + línea de resumen final, exactamente con esta forma: `120 tests analysed · 34 cannot fail (28%) · 51 findings across 8 rules`
- `--json` es un alias de `--format=json`; la forma del JSON es un **contrato estable** que procesan herramientas externas (incluir `schemaVersion`).
- `--min-severity` filtra tanto lo que se reporta como lo que decide el código de salida.
- Códigos de salida: `0` sin hallazgos `error`, `1` con al menos uno, `2` error de ejecución (argumentos inválidos, ningún fichero, fallo interno).
- `node_modules` se ignora siempre; los `.d.ts` se saltan.

## Tests que sí pueden fallar

Cada regla tiene fixtures en `test/fixtures/<rule-id>/`: al menos un fichero que **debe** disparar y uno limpio que **no debe**.
Se comprueban las dos direcciones, con línea y columna exactas.
Los fixtures están excluidos de tsc, ESLint y de la búsqueda de tests de Vitest.

## Fases (parar al final de cada una y enseñar el resultado)

1. Andamiaje: repo, TS estricto, Vitest, ESLint, este fichero, README, CLI que parsea argumentos y resuelve globs. **(verificada)**
2. Motor AST + `no-assertion`, `tautological-assertion`, `skipped-test`, con fixtures y tests. Tabla de salida funcionando. **(en revisión)**
3. Las 3 reglas restantes (`conditional-assertion`, `missing-await`, `swallowed-error`), una a una, cada una con sus fixtures.
4. Formatos de salida (`--json`, `sarif`) + GitHub Actions que corre los tests y ejecuta la CLI sobre los fixtures.
5. Capa `--llm` opcional, aislada, degradando limpiamente sin API key.
6. *(Opcional, después del MVP.)* Exponer test-critic como servidor MCP, para que un agente que genera tests pueda auditarlos antes de entregarlos.

**Al cerrar la fase 2**, antes de empezar la 3, crear en `.claude/`:

- **Skill `/new-rule`:** fija el procedimiento para añadir una regla (fichero en `src/rules/`, fixtures que disparan y limpios, test de las dos direcciones, registro en el motor, fila en la tabla del README). Se crea a partir del patrón real de las tres primeras reglas, no antes.
- **Agente `fp-hunter`:** subagente con contexto propio cuyo único objetivo es escribir código de test *correcto* que una regla marque por error. Cada caso que encuentre se convierte en fixture limpio y en un arreglo de la regla. Va aparte porque quien escribe la regla comparte sus puntos ciegos.

## Flujo de trabajo

- **No hacer commit ni push.** Al final de cada fase, dar el mensaje de commit por el chat; el commit y el push los hace quien mantiene el proyecto.
- `npm run check` (typecheck + lint + tests) debe pasar antes de entregar una fase.
- Node >= 22 (la 20 ya no tiene soporte). TypeScript fijado en 6.0.x porque typescript-eslint aún no soporta TS 7; `@types/node` sigue la versión mayor mínima de Node.
- Estructura: `src/` (código), `test/` (tests de Vitest), `test/fixtures/` (se analizan, nunca se ejecutan), `src/bin.ts` es el ejecutable, `src/cli.ts` exporta un `main(argv, io)` testeable.
- Motor: `src/engine/parse.ts` (ts-morph en memoria, sin type checker), `test-inventory.ts` (qué llamadas son tests/suites), `assertions.ts` (qué cuenta como aserción), `commented-tests.ts`, `analyze.ts` (ejecuta reglas y convierte `RuleHit` en `Finding`). Las reglas viven en `src/rules/` y se registran en `src/rules/index.ts`; nunca calculan posiciones.
- Cada fixture limpio debe contener tests (se comprueba `testCount`), si no "cero hallazgos" no demuestra nada.
- En Windows, `npm test` debe lanzarse desde una ruta con la letra de unidad en mayúscula (`C:\...`). Con `c:\...` Vitest carga dos veces sus propios módulos y todas las suites fallan con `Cannot read properties of undefined (reading 'config')`.
- Los tests corren en Node y ejecutan el TypeScript de `src/` directamente; `dist/` (lo que se publica) solo se prueba en el CI de la fase 4.
