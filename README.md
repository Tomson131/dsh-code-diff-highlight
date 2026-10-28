# dsh-code-diff-highlight

Proof-of-concept **клиентского плагина** для DeepSeek Harness: собственная
diff-панель с **кастомной подсветкой**, которая читает **реальные изменения
хоста** и рисует их по-своему (не через штатный Shiki).

Плагин использует ровно те же механизмы, что и штатный
`dsh-client-ui-deliverables` (проверено по исходникам DSH `0.2.1-rc.2` из
`app.asar`).

---

## Что делает

В хвосте каждого завершённого хода (слот `conversation.chat.turnTail`) плагин
рисует карточку **«Custom diff panel»** со списком изменённых файлов.

1. Сводка изменений хода читается с хоста через авторизованный роут
   `api/changes.summary?sessionId=…&seq=…` → список файлов с `+added / -deleted`.
2. **Клик по файлу открывает diff в отдельной вкладке правой панели** (не в
   диалоге). Плагин регистрирует собственный тип вкладки `dsh-demo-diff-review`
   и её тело в слоте `sidebar.right.pane.tab`.
3. Вкладка читает сравнение через `api/changes.diff?sessionId=…&seq=…&index=…`
   и рендерит **свой** diff:
   - режимы **Unified** и **Side-by-side** (переключатель);
   - номера строк для старой/новой стороны;
   - зелёные `+` / красные `-`, свой построчный **токенизатор** (подсветка
     ключевых слов) вместо штатного Shiki;
   - статусы `binary` / `too large` / `coarse`;
   - переключение файлов внутри вкладки.
4. Если для хода нет записанных изменений — карточка **не показывается**.

---

## Структура

```
dsh-code-diff-highlight/
├── package.json             # dsh.client → platform "web", export "./client"
├── lib/
│   ├── index.js             # node-половина (пустая, но обязательная)
│   └── client.js            # браузерная половина (готовый бандл, UI + данные)
├── cordis.patch.example.yml # строка подключения
├── smoke-test.cjs           # самопроверка (node, без браузера)
└── README.md
```

---

## Ключевые точки плагинной системы DSH (выверено по исходникам)

### 1. Cordis-плагин

Плагин = npm-пакет, экспортирующий `apply(ctx)` и `inject` (массив имён
сервисов). Клиентская половина экспортирует то же самое.

### 2. Манифест `dsh.client`

```json
"dsh": { "client": { "platform": "web", "inject": [] } }
```

Node-половина `dsh-client-modules` сканирует loader-записи, находит пакет с
`dsh.client` и отдаёт его `./client` как `/plugins/<id>/client.js`.

### 3. Формат клиентского бандла

```js
window.__ModuleLoader__.load({
  id: "dsh-code-diff-highlight",
  factory: (require) => { /* … */ return module.exports; },
});
```

`require(...)` резолвится против замороженной таблицы общих модулей
(`PLATFORM_MODULES`): `react`, `react/jsx-runtime`, `react-dom`,
`react-dom/client`, `@deepseek-ai/cordis`, `zod`,
`@tanstack/react-virtual`, `@deepseek-ai/dsh-client-store`,
`@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/dsh-client-ui-dockkit`. Всё остальное — в `dsh.client.external`.

### 4. Регистрация в слот

```js
ctx.effect(() => ctx.slots.inject("conversation.chat.turnTail", () =>
  ctx.slots.register({
    name: "conversation.chat.turnTail",
    id: "dsh-code-diff-highlight",
    inject: () => ({}),          // свои props
  }, DemoDiffPanel),
), "label");
```

Слот `turnTail` (объявлен `dsh-client-ui-chat`) передаёт компоненту стандартные
props: `turn` (с `turn.data.get(key)`), `seq`, `sessionId`, `useSessions`, `t`,
`renderSlot`, `openFile`. Наш `inject()` добавляет только свои.

### 5. Реальные данные

Событие `workspace/changes` сворачивается в данные хода через
`ctx.uiConversation.events.register(definition)`:

```js
const definition = {
  kind: "demo-diff",
  match(event) { /* turn/start → start; workspace/changes → update */ },
  start(_c, match) { return { turn: match.event.data.turn }; },
  update(context, match) { return { ...context.state, seq: match.event.seq }; },
  buildLocationData(context, scope, previous) {
    if (scope !== "turn") return null;
    return { kind: "turn", turn: context.state.turn, key: "demo-diff", value: { seq: context.state.seq } };
  },
};
```

Дальше в компоненте: `props.turn.data.get("demo-diff")?.seq` → последовательность
события → строим URL к `changes.summary` / `changes.diff`.

Формат ответов:
- summary: `{ turn, files: [{ path, display, added, deleted, binary, oversized }], total, added, deleted }`
- diff: `{ kind: "text"|"binary"|"oversized", path, display, before, after, coarse, hunks: [{ oldStart, oldLines, newStart, newLines, lines: ["+…", "-…", " …"] }] }`

---

## Как собрать

`lib/client.js` — готовый бандл (ручной `React.createElement`, без JSX/TS),
дополнительная сборка не нужна. Проверка без браузера:

```powershell
node smoke-test.cjs
# ожидается: … OK
```

## Как установить и включить

Пакет — **бандл** (`dsh.bundle.patch`): при установке его `cordis.patch.yml` сам
вставляет строку плагина, вручную править профиль не нужно.

**Для пользователей (после публикации в npm / из tarball):**

```powershell
cd C:\Users\<user>\.dsh\profiles\desktop
pnpm add dsh-code-diff-highlight
# или из архива:
pnpm add .\dsh-code-diff-highlight-0.1.0.tgz
```

Затем добавить `dsh-code-diff-highlight` в `dsh.profile.bundles`
(или поставить через GUI: сайдбар → **Plugins**).

**Локальная разработка (link):**

```powershell
cd C:\Users\<user>\.dsh\profiles\desktop
pnpm add link:M:\TEST\dsh-code-diff-highlight
```

и вручную добавить строку из `cordis.patch.example.yml` в `cordis.patch.yml`
(при ручном монтаже бандл в `dsh.profile.bundles` добавлять не нужно).

---

## Публикация

Из каталога пакета:

```powershell
# 1) при необходимости поднимите version в package.json
npm login
npm publish --access public
```

Сборка не требуется: `lib/client.js` — готовый бандл.

Если имя `dsh-code-diff-highlight` занято в реестре — поменяйте `name` на
`@tomson131/dsh-code-diff-highlight` и опубликуйте так же; пользователи ставят
его через `pnpm add @tomson131/dsh-code-diff-highlight`.

---

## Куда развивать

- **Полноценная подсветка (Shiki)** — добавить в `dsh.client.external` или
  собрать внутрь бандла (сейчас — свой мини-токенизатор).
- **Хост-логика** в `lib/index.js`: свои API-роуты через
  `ctx.connection.fetch.register(...)`, инструменты, секции системного промпта.
- **Кэширование сравнений** в правой панели, чтобы переключение файлов не
  перезапрашивало diff.
