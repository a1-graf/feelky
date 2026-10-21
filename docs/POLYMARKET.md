# Polymarket у Feelky

Категорія для обліку торгівлі на Polymarket. Власник торгує трьома способами, і кожна угода
пишеться окремим рядком, щоб статистика була чіткою:

| Розділ (`PolySection`) | Що це |
|---|---|
| `MANUAL` | ручні угоди |
| `COPYTRADE` | бот poly-flipper-follow (копітрейд) |
| `AI_AGENT` | три AI-агенти Polyvsn (гроші блокуються на 30 днів) |

## Моделі даних

Міграція: `prisma/migrations/0010_polymarket/migration.sql` (написана вручну, перевірена на
Postgres-рушії pglite).

- **`PolyTrade`** — одна угода. Унікальна пара `[userId, externalId]` дає ідемпотентність.
  Поля: `section`, `agentName`, `walletRef`, `marketSlug`, `title`, `marketKind`
  (`BTC_5M`/`BTC_15M`/`ETH_5M`/`ETH_15M`/`OTHER`), `outcome`, `entryPrice` (0–1), `sizeUsd`,
  `shares`, `feesUsd`, `status` (`OPEN`/`WON`/`LOST`/`VOID`), `pnlUsd` (чистий результат після
  комісій), `openedAt`, `resolvedAt`, `signalPrice` (ціна лідера для slippage), `note`.
- **`PolyLock`** — блокування грошей в AI-агенті: `amountUsd`, `lockedAt`, `unlockAt`
  (за замовчуванням +30 днів), `status` (`LOCKED`/`RELEASED`), `releasedAmountUsd`,
  `resultPnlUsd`. FK на `Account` з `RESTRICT`.
- **Пул** — звичайний `Account` типу `EXCHANGE`, USDT, id `${userId}-polymarket`, ім'я
  «Polymarket». Створюється ліниво при першому використанні (`ensurePolyPool`), окремої
  міграції даних не потрібно.

## Як рахуються гроші

Нових типів проводок у леджері немає. Використовуються наявні `MANUAL_ADJUSTMENT` і `TRANSFER`
з `metadata.source`:

- `POLY_FLOW` (`TRANSFER`) — `poly_deposit` / `poly_withdraw` між власним рахунком і пулом.
- `POLY_PNL` (`MANUAL_ADJUSTMENT`) — результат угод `MANUAL` і `COPYTRADE`. При повторній
  відправці або переході `OPEN → WON` проводиться лише різниця.
- `POLY_LOCK` — гроші з пулу в AI-агента. Баланс пулу зменшується, сума лишається в банку
  через `polyLockedUsdt`, тому подвійного обліку чи втрати немає.
- `POLY_RELEASE` — кінець блокування: на пул повертається `returned`, різниця до principal і
  є результатом агента (`resultPnlUsd`).

Угоди `AI_AGENT` у пул **не проводяться**: їхній PnL — аналітика всередині блокування, а
реальний результат агента з'являється при `poly_release`. Рядки `POLY_*` не можна архівувати
чи відновлювати напряму (`lib/ledger.ts`), а агентський `delete` на них відмовляє — зміни
робляться операціями.

`polyLockedUsdt` (сума `LOCKED`) додається в потенційний банк і в «доступно з оборотом», але
не в гроші для витрат. Звірка `reconcilePolyPool` порівнює баланс пулу з проводками й
PnL угод із проведеним; розбіжність показується на `/poly`.

## Код

- `lib/poly-stats.ts` — чиста статистика без БД (PnL, кошики цін, години UTC, дні/тижні,
  slippage, звірка).
- `lib/poly-input.ts` — Zod-схеми входу.
- `lib/poly.ts` — робота з БД: `upsertPolyTrade(s)`, `deletePolyTrade`, `listPolyTrades`,
  `movePolyFunds`, `lockPolyFunds`, `releasePolyLock`, `getPolyOverview`.
- `app/poly/page.tsx`, `components/poly-statistics.tsx`, `components/poly-trades-table.tsx` — UI.
- Тести: `tests/poly.test.ts`.

## API (Bearer-токен агента)

`POST /api/agent/poly/trades` — один об'єкт або масив до 200. Відповідь:
`{ results[], created, updated, duplicate, failed }`; помилка однієї угоди не валить пакет.
Обов'язкові: `externalId`, `section`, `marketSlug`, `outcome`, `entryPrice`, `sizeUsd`,
`openedAt` (для `AI_AGENT` ще `agentName`). Результат: `pnl` (чистий) або `status`; без
обох — `OPEN`.

`GET /api/agent/poly/trades?from&to&section&agent&limit` — список.
`DELETE /api/agent/poly/trades?externalId=` або `?id=` — видалення з відкатом проведеного PnL.
`GET /api/agent/poly/summary` — та сама статистика, що на `/poly`.

`POST /api/agent/operations`:

| type | поля |
|---|---|
| `poly_deposit` | `amount`, `from`, `note`, `date` |
| `poly_withdraw` | `amount`, `to`, `note`, `date` |
| `poly_lock` | `amount`, `agent`, `days` (30), `note`, `date` |
| `poly_release` | `lock` або `agent`, `returned`, `note`, `date` |

Також: `GET /api/agent/references` повертає `polymarket{sections, marketKinds, agents,
activeLocks}`, а `/api/agent/data` містить таблиці `PolyTrade` і `PolyLock`. Бекап
(`/api/backup`, `npm run export:user`) містить `polyTrades` і `polyLocks`.

## Як застосувати міграцію на проді

1. Зроби бекап БД (або `/api/backup`).
2. З машини, що має доступ до прод-БД і `DIRECT_URL` (прямий, не pooler) у env:
   `npx prisma migrate deploy`. Це додає 4 енуми, 2 таблиці й індекси; наявні таблиці не
   змінюються.
3. Лише після цього деплой коду гілки (інакше `/poly` і `getDashboard` впадуть на
   відсутній таблиці `PolyLock`).
4. Перевір, що `GET /api/agent/poly/summary` повертає 200.
5. Наповнення: `poly_deposit` (скільки лежить на Polymarket, напр. ~$52 на Wallet 1) →
   `poly_lock` для кожного AI-агента (~$250) → далі угоди через `/poly/trades`.

Автоматично міграція в цій гілці не запускалась; жодних дій проти реальної БД не
виконувалось.

## Імпорт історії Polyvsn (одноразово)

Дані: `scripts/data/polyvsn-trades.json` (26 угод зі зрізу 2026-10-20) + потоки грошей у
`lib/polyvsn-import.ts`. Усе має стабільний id (`polyvsn:...`), тож повторний запуск нічого не
дублює (угоди — `externalId`, рухи — `metadata.importId`, лок — агент + час).

Що імпортується: 26 угод (MANUAL 5, COPYTRADE 21, з них бот poly-flipper 1; джерело в `note`),
депозити 249.10 / 1.67 / 10.87 / 79.58 з головного гаманця (`poly_deposit`), вивід 9.19
(`poly_withdraw`, призначення — припущення), лок 250.77 в «AI Quantum Predator» з
2026-10-11 13:13:46 UTC на 30 днів. Внутрішні переводи W1↔W2 та цикл 50.09 нетто 0 пропущені.
Відкриті позиції (46.34) не імпортуються — вони не підтверджені.

Шість розрахунків 14.10 без рядка в історії (виручка 138.37, вхід невідомий) окремими угодами
не заносяться: у `PolyTrade` обов'язкові ціна входу й розмір. Замість цього одна коригуюча
проводка `POLY_UNATTRIBUTED` (+28.28) доводить пул до підтвердженого кеша 52.63. Вона не
входить у статистику угод: `/poly` показує PnL угод −56.91, а реальний підсумок −28.63
(52.63 + 250.77 − внесено нетто 332.03). Різниця 28.28 — і є ці шість розрахунків.

Порядок на проді:

1. Бекап: `npm run export:user -- <email>` (або `/api/backup`).
2. `npx prisma migrate deploy` (з `DIRECT_URL`), потім деплой коду гілки.
3. Подивись на сухий прогін: `npm run import:polyvsn -- <email> --dry-run` (друкує очікувані
   підсумки: pool 52.63, locked 250.77, totalPnl −28.63).
4. Імпорт: `npm run import:polyvsn -- <email> [--account "Мейн гаманець"] [--allow-overdraft]`.
   Депозити списуються з рахунку «Мейн гаманець»; якщо там недостатньо коштів, без
   `--allow-overdraft` операція впаде, з ним рахунок піде в мінус (Feelky міг не знати про ці гроші).
5. Перевірка: `GET /api/agent/poly/summary` — пул 52.63, заблоковано 250.77 (разом 303.40),
   `reconcile.ok = true`, 26 угод. Повторний запуск імпорту дає `duplicate: 26` і `skipped`.

Тест на БД: `tests/polyvsn-import.db.test.ts` вмикається змінною `POLY_IMPORT_DB_TEST=1` і
потребує мігрованого Postgres у `DATABASE_URL` (перевірено на pglite через pglite-socket).

## Ризики й обмеження

- Лінивий пул: якщо у користувача вже є рахунок з іншим id і назвою «Polymarket», пул буде
  створено другим — перевір `references` перед першим `poly_deposit`.
- Рядки леджера `POLY_*` захищені від прямого видалення; виправляти їх треба
  `delete`-ом угоди або зворотною операцією, а не `raw_*` (raw не рухає баланси).
- USDC прирівняно до USDT без курсу.
- `/poly` показує до 2000 останніх угод; статистика рахується з усіх.
- Slippage копітрейду потребує `signalPrice` в угоді.
- Не перевірено на реальній БД і в браузері (див. фінальний звіт).
