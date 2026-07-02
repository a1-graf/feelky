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
```

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
