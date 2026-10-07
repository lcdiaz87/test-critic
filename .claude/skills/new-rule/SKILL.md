---
name: new-rule
description: Procedimiento para añadir una regla nueva a test-critic, desde la definición con quien mantiene el proyecto hasta los fixtures, el test, la implementación, la caza de falsos positivos y la documentación. Usar cuando se pida crear, añadir o implementar una regla (por ejemplo "/new-rule conditional-assertion").
---

# Añadir una regla a test-critic

Regla a crear: **$ARGUMENTS**
Si no se ha indicado ninguna, pregunta cuál antes de seguir.

Antes de empezar, lee `CLAUDE.md` entero: las decisiones ya tomadas sobre esa regla mandan sobre cualquier cosa de este documento.
El id tiene que estar en `RULE_IDS` (`src/types.ts`) y en la tabla de reglas del MVP de `CLAUDE.md`; si no está, para y pregunta.

Trabaja paso a paso: explica cada paso en español mientras lo haces y para donde se indica.
La directiva principal es **cero falsos positivos**: si un caso es ambiguo, la regla no dice nada.

## 1. Definir antes de programar (parada obligatoria)

Escribe en el chat, sin tocar ningún fichero:

- **Qué patrón detecta**, con dos o tres ejemplos de código.
- **Por qué hace que un test sea placebo**: por qué sigue en verde haga lo que haga el código.
- **Si lo demuestra siempre o solo a veces.** Esto decide el valor de `provesPlacebo` en cada hallazgo. Ejemplo de referencia: una tautología junto a una aserción real se reporta, pero no demuestra nada, porque la otra aserción puede fallar.
- **Severidad** (`error` o `warning`) y por qué.
- **Casos dudosos**: formas legítimas de escribir tests que se parecen al patrón. Para cada una, propón si se reporta o no.
- **Qué queda fuera a propósito**, aunque sea un problema real.

Espera a que quien mantiene el proyecto decida los casos dudosos.
Apunta en `CLAUDE.md` ("Decisiones ya tomadas") lo que se decida.

## 2. Fixtures primero

En `test/fixtures/<rule-id>/`:

- `triggers.test.ts`: cada test tiene un título que dice qué caso cubre y debe disparar la regla.
- `clean.test.ts`: trampas, es decir, código correcto que se parece al patrón y **no** debe disparar. Incluye los casos dudosos que se decidió no reportar.
- `triggers.spec.ts` / `clean.spec.ts` si el patrón tiene una forma propia en Playwright.
- `triggers.test.js` si el patrón se escribe distinto en JavaScript.

Reglas para los fixtures:

- Se analizan, nunca se ejecutan: los imports pueden apuntar a módulos que no existen (`./math`).
- Cada fichero limpio tiene que contener tests. Un fichero sin tests no dispara nada y no demuestra nada.
- Los títulos en inglés, igual que el resto del código.

## 3. El test de la regla, que tiene que empezar en rojo

Crea `test/rules/<rule-id>.test.ts` siguiendo el patrón de los existentes (`test/rules/no-assertion.test.ts` es el más completo):

```ts
import { describe, expect, it } from 'vitest';
import { analyzeFixture, findingsOf } from '../helpers/fixtures.js';

describe('<rule-id>', () => {
  it('reports <qué casos>', () => {
    expect(findingsOf('<rule-id>/triggers.test.ts', '<rule-id>')).toEqual([
      { line: 5, column: 3, testName: 'suite › test title' },
      // one entry per expected finding, exact line and column
    ]);
  });

  it('reports with <severity> severity and explains why', () => {
    // severity and the exact message of at least one finding
  });

  it('counts <which tests> as placebos', () => {
    expect(analyzeFixture('<rule-id>/triggers.test.ts')).toMatchObject({ testCount: 0, placeboCount: 0 });
  });

  it.each([['<rule-id>/clean.test.ts', 0]])('stays silent on <qué trampas> in %s', (path, tests) => {
    const analysis = analyzeFixture(path);
    expect(analysis.testCount).toBe(tests);
    expect(analysis.findings).toEqual([]);
  });
});
```

Ejecuta `npm test`: este fichero **tiene que fallar**, porque la regla todavía no existe.
Si pasa en verde, el test no está comprobando lo que crees; arréglalo antes de seguir.

## 4. Implementar la regla

Crea `src/rules/<rule-id>.ts` exportando un objeto `Rule` (ver `src/rules/rule.ts`):

- Empieza con un comentario que explique **por qué** el patrón hace que un test sea placebo y **qué se deja fuera a propósito**. El proyecto también sirve para aprender, así que este comentario importa tanto como el código.
- Usa `runnableTests(context)` para no juzgar tests saltados ni `it.fails`.
- Usa `context.assertionSites(test)` en lugar de buscar aserciones a mano: ahí está la definición común de qué es una aserción (`src/engine/assertions.ts`).
- Devuelve `RuleHit`, nunca `Finding`: la regla dice dónde (`pos`) y por qué (`message`), y el motor calcula línea y columna.
- El mensaje es una sola frase en inglés que explica por qué importa, en la línea de los existentes: "This test has no assertion, so it passes whatever the code under test does."
- Si algo es común a varias reglas, va en `src/engine/`, no copiado en cada regla.

Regístrala en `src/rules/index.ts` y ejecuta `npm run check` hasta que esté en verde.

## 5. Comprobar que el test puede fallar

Rompe la regla a propósito (por ejemplo, que devuelva `[]`, o quita una de sus condiciones) y ejecuta su test: tiene que ponerse en rojo.
Restaura el código y confirma que vuelve a verde.
Haz lo mismo con alguna trampa importante del fixture limpio: si quitas la condición que la protege, el test del fixture limpio debe fallar.
Un test que no se pone en rojo al romper lo que protege es un test placebo, justo lo que esta herramienta busca.

## 6. Cazar falsos positivos

Lanza el agente `fp-hunter` sobre la regla.
Por cada caso que encuentre, si es de verdad código correcto:

1. Añádelo como trampa al fixture limpio.
2. Comprueba que su test se pone en rojo.
3. Arregla la regla hasta que vuelva a verde.

Si arreglarlo exige relajar la regla de forma que deje de detectar casos reales, para y consúltalo: puede que la regla no se pueda implementar sin falsos positivos, y entonces se decide si sale del MVP.

## 7. Revisar los fixtures de las otras reglas

Compila y pasa la CLI sobre todos los fixtures:

```sh
npm run build
node dist/bin.js "test/fixtures/**/*"
```

Mira los hallazgos de la regla nueva **fuera** de su carpeta.
Cada uno es un falso positivo (arreglar la regla) o un hallazgo correcto en un fixture ajeno (decidirlo con quien mantiene el proyecto y, si se acepta, ajustar ese fixture o su test).
No se ignora ninguno.

## 8. Documentación

- `README.md`: la fila de la regla en la tabla de reglas y la línea de "Estado".
- Si alguna decisión deja fuera casos a propósito, una entrada en "Por qué algunas cosas no se reportan".
- `CLAUDE.md`: las decisiones del paso 1, si no se apuntaron ya, y el estado de la fase.
- Todo en español, con una frase por línea.

## 9. Entregar y parar

Resume en el chat:

- qué detecta la regla y qué deja fuera a propósito;
- los ficheros nuevos y modificados;
- el resultado de `npm run check`;
- los falsos positivos que encontró `fp-hunter` y cómo se resolvieron.

Da el mensaje de commit en inglés (no hagas commit ni push) y espera antes de empezar la siguiente regla.
