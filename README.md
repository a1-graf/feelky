# Feelky

Feelky - персональний MVP для обліку грошей, криптовалютних балансів, доходів, витрат, P2P-виводів, готівки, заморожених і очікуваних коштів.

## Стек

- Next.js App Router, TypeScript, Tailwind CSS
- PostgreSQL, Prisma ORM
- NextAuth: Google OAuth та email/password credentials
- Decimal.js і Prisma Decimal для фінансової точності
- Recharts для dashboard-графіків
- Vitest для unit-тестів фінансової логіки
- PWA manifest + service worker
- Docker Compose для PostgreSQL

## Структура

- `app/` - сторінки та API routes
- `components/` - layout, форми, UI-компоненти
- `lib/ledger.ts` - єдиний service layer для зміни балансів
- `lib/telegram/` - парсер швидких записів, сценарії бота, стан діалогів, безпека
- `app/api/telegram/webhook/` - Telegram webhook (App Router, Node runtime)
- `lib/dashboard.ts` - агрегації dashboard
- `lib/calculations.ts` - pure фінансові розрахунки з тестами
- `prisma/` - schema, migration, seed
- `scripts/` - backup/export/import helpers
- `tests/` - unit-тести
- `public/` - PWA manifest, service worker, icon

## Запуск локально

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Після seed можна увійти credentials:

- email: значення `SEED_EMAIL`, за замовчуванням `admin@example.com`
- password: значення `SEED_PASSWORD`, за замовчуванням `change-me-please`

## Env

```env
DATABASE_URL="postgresql://feelky:feelky@localhost:5432/feelky?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-random-secret"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
SEED_EMAIL="admin@example.com"
SEED_PASSWORD="change-me-please"

TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_USER_EMAIL=""
TELEGRAM_ALLOWED_USER_IDS=""
TELEGRAM_WEBHOOK_URL=""
```

Для Google OAuth створи OAuth client у Google Cloud Console, додай redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

і заповни `GOOGLE_CLIENT_ID` та `GOOGLE_CLIENT_SECRET`.

## Команди

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:seed
npm run db:backup
npm run export:user -- admin@example.com
npm run import:user -- backups/user.json
npm run telegram:webhook
```

## Telegram-бот

Telegram - основний інтерфейс введення операцій, сайт - інтерфейс перегляду балансів, історії та аналітики.
Бот пише в ту саму PostgreSQL через `lib/ledger.ts`, тому кожна операція одразу змінює баланси і зʼявляється в аналітиці сайту.

### 1. Створити бота через BotFather

1. Відкрий [@BotFather](https://t.me/BotFather) у Telegram.
2. `/newbot`, вкажи назву та username, який закінчується на `bot`.
3. Скопіюй токен виду `123456789:AA...` у `TELEGRAM_BOT_TOKEN`.
4. Токен не комітиться: `.env` уже в `.gitignore`.

### 2. Дізнатись свій Telegram user ID

Напиши будь-яке повідомлення боту [@userinfobot](https://t.me/userinfobot) - він відповість числовим `Id`.
Це значення йде в `TELEGRAM_ALLOWED_USER_IDS` (кілька ID - через кому).

### 3. Згенерувати webhook secret

```bash
openssl rand -hex 32
```

Результат - у `TELEGRAM_WEBHOOK_SECRET`. Telegram надсилатиме його в заголовку `X-Telegram-Bot-Api-Secret-Token`, а webhook відхилить будь-який запит без правильного секрету.

### 4. Застосувати міграцію Prisma

```bash
npx prisma migrate deploy
npx prisma generate
```

Локально під час розробки: `npx prisma migrate dev`.
Міграція `0006_telegram_bot` додає `TelegramSession` (стан діалогів) і `TelegramUpdate` (захист від повторної доставки).

### 5. Налаштувати env

```env
TELEGRAM_BOT_TOKEN="123456789:AA..."
TELEGRAM_WEBHOOK_SECRET="згенерований-секрет"
TELEGRAM_USER_EMAIL="admin@example.com"
TELEGRAM_ALLOWED_USER_IDS="123456789"
TELEGRAM_WEBHOOK_URL="https://feelky.example.com"
```

`TELEGRAM_USER_EMAIL` - email користувача Feelky, до акаунта якого привʼязані дозволені Telegram ID.

### 6. Підключити webhook

```bash
npm run telegram:webhook
```

Команда встановлює webhook на `${TELEGRAM_WEBHOOK_URL}/api/telegram/webhook`, передає секрет, обмежує updates до `message` і `callback_query` та реєструє список команд через `setMyCommands`. Токен у консоль не виводиться.
Потрібна публічна HTTPS-адреса - `localhost` Telegram не прийме.

### Керування

Під полем вводу постійно висить клавіатура з головними діями - її не треба викликати
командою, вона завжди на місці. Натиск кнопки одразу починає сценарій і перебиває
поточний крок, тож із будь-якого місця можна перескочити на іншу дію.

Усередині сценаріїв усе робиться інлайн-кнопками: меню, рахунки, категорії, джерела доходу, сетапи фліпів.
Текстом вводяться лише числа - суми, курси, баланси. Емодзі в інтерфейсі не використовуються,
кнопки йдуть по дві в ряд, щоб проміжки між ними лишались мінімальними.

### Дата операції

За замовчуванням береться поточний момент. На кожному кроці є кнопка `Дата: Сьогодні` -
натисни, і можна вписати іншу цифрами: `30.08.2026` або `30.08` (цьогоріч). Кнопка `Сьогодні`
повертає все назад. Минула дата зберігається як полудень UTC, щоб операція не поїхала
в сусідній день чи місяць ні в Києві, ні на UTC-сервері.

### Швидкі повідомлення

Необовʼязковий шлях для тих, кому зручніше друкувати:

```text
- 250 кава
- 1250,50 грн продукти
- 20 USDT #Steam ключі
+ 1500 UAH #Робота аванс
+ 300 USDT #Боти виплата
```

- `-` витрата, `+` дохід, без знака - витрата.
- Без валюти - UAH. Підтримуються `UAH`, `грн`, `₴`, `USDT`, `USD`, `$`.
- Кома і крапка як десятковий роздільник, пробіли в сумі: `1 250,50`.
- `#Категорія` для витрат, `#Джерело` для доходів; назва може бути з кількох слів (`#Повернення боргу`).
- Текст після суми й хештега - примітка.
- Без хештега береться остання використана категорія/джерело, при першому використанні - `Інше`.
- Витрата йде з дефолтного рахунку з налаштувань Feelky, дохід - на останній рахунок для цієї валюти.
- Під підтвердженням є кнопка `↩️ Скасувати операцію`; повторне натискання не змінює баланс удруге.

Однорядкові формати сценаріїв:

```text
5000 41.25 Binance          → P2P-вивід: отримано UAH, курс UAH/USDT, примітка
10000 UAH 41.2 Cashalot     → готівка UAH
500 USD 1 Cashalot          → готівка USD
250 USDT холд біржі         → очікувані/заморожені гроші
+35.5 Buff → TM             → фліп із додатним PnL
-12 Site → Steam            → фліп із відʼємним PnL
```

### Команди

```text
/menu       головне меню
/expense    витрата
/income     дохід
/work       робоча витрата
/p2p        P2P-вивід
/cash       вивід у готівку
/savings    відкладення
/expected   очікувані/заморожені гроші
/flip       фліп
/balance    поточні баланси
/accounts   список рахунків
/cancel     скасувати поточну дію
/help       довідка
```

`/start` теж відкриває меню.

### Безпека і надійність

- Webhook перевіряє заголовок `X-Telegram-Bot-Api-Secret-Token` (constant-time порівняння).
- Команди приймаються лише від ID зі списку `TELEGRAM_ALLOWED_USER_IDS` і лише в приватному чаті. Порожній список означає "нікому".
- ID рахунків, категорій і джерел ніколи не беруться з callback data напряму: кнопки несуть лише індекс, а обʼєкт перевіряється на належність користувачу в базі.
- Кожен `update_id` спершу claim-иться в таблиці `TelegramUpdate`, тому повторна доставка webhook не створює другу операцію.
- Стан діалогів лежить у Postgres (`TelegramSession`), тому сценарії переживають рестарт сервера і працюють на кількох інстансах.
- Технічні помилки логуються на сервері, користувач бачить коротке повідомлення; після помилки чернетка очищається.
- Дефолтна дата операції - поточний момент, який відображається в часовому поясі `Europe/Kyiv`.

## Реалізовано в MVP

- Реєстрація першого користувача через UI та seed/admin setup
- NextAuth credentials login, Google OAuth підготовлений
- Захищені сторінки й API
- Рахунки: біржа, картка, готівка UAH/USD, дочірні crypto-акаунти
- Доходи, витрати, P2P-вивід, cash withdrawal, manual adjustment
- Заморожені кошти, розмороження без подвійного збільшення балансу
- Очікувані гроші та потенційний банк
- Архівація/відновлення операцій із відкотом впливу на баланси
- BalanceHistory для ручних коригувань
- AuditLog для архіву/відновлення
- Dashboard: доступний банк, потенційний банк, crypto, cash, витрати місяця, останні операції
- Пошук/фільтри/pagination на API `/api/transactions`
- Налаштування курсу, теми, порогів витрат і приховування сум
- JSON export через UI та CLI validation для import
- Docker PostgreSQL із healthcheck і backup service profile
- PWA installability для iOS/desktop
- Telegram-бот як основний інтерфейс введення операцій через той самий ledger

## Обмеження MVP

- API бірж має provider interface і mock providers, але реальні read-only ключі не підключені.
- Import JSON у CLI наразі виконує сувору валідацію і не робить destructive restore автоматично.
- Редагування операцій у UI спрощене до архівування/відновлення; service layer має атомарні rollback/apply primitives.
- E2E-тести описані як ціль MVP, але в цьому першому проході додані unit-тести критичних розрахунків. Для повного E2E варто підключити Playwright після стабілізації тестової БД.
- Service worker кешує тільки статичні ресурси, приватні API-відповіді не кешуються.

## Deploy

1. Підготуй PostgreSQL і `DATABASE_URL`.
2. Встанови `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, Google OAuth env.
3. Виконай `npx prisma migrate deploy`.
4. Виконай `npm run build`.
5. Запусти `npm run start`.
