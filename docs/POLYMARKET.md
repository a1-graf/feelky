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

## Ризики й обмеження

- Лінивий пул: якщо у користувача вже є рахунок з іншим id і назвою «Polymarket», пул буде
  створено другим — перевір `references` перед першим `poly_deposit`.
- Рядки леджера `POLY_*` захищені від прямого видалення; виправляти їх треба
  `delete`-ом угоди або зворотною операцією, а не `raw_*` (raw не рухає баланси).
- USDC прирівняно до USDT без курсу.
- `/poly` показує до 2000 останніх угод; статистика рахується з усіх.
- Slippage копітрейду потребує `signalPrice` в угоді.
- Не перевірено на реальній БД і в браузері (див. фінальний звіт).
