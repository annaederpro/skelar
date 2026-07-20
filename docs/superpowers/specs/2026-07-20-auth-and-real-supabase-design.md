# Auth + реальний Supabase (sub-project 1 of Todoist UI upgrade)

## Контекст

Це перший з чотирьох послідовних під-проєктів запланованого переходу UI/UX на
Todoist-подібний інтерфейс (боттом-нав, FAB, Projects, Priority, редизайн
картки задачі, голосове введення). Обсяг повного запиту виявився занадто
великим для одного спека, тож його розбито так:

1. **Auth + реальний Supabase замість seed-даних** (цей документ)
2. Схема Projects/Priority + боттом-нав і FAB з роутингом на 4 вкладки
3. Редизайн картки задачі (priority-крапка, тег проєкту, due date)
4. Голосове введення UI

Мета цього під-проєкту — прибрати локальний `useState`-seed
(`SEED_TASKS` у `src/app/page.tsx`) і замінити його реальною авторизацією та
читанням/записом у вже існуючу Supabase-схему (`supabase/migrations/0001_init.sql`).
Жодних змін схеми БД не потрібно — таблиці `users`/`tasks` та тригер
автостворення профілю вже існують.

Це не переробка UI: боттом-нав, FAB, Projects, Priority — поза межами цього
документа (під-проєкти 2–4).

## Метод авторизації

Email + пароль через Supabase Auth. OAuth, magic link, відновлення пароля —
не входять в обсяг.

Дефолтна настройка Supabase-проєкту вимагає підтвердження email перед логіном.
Для зручності розробки рекомендовано вимкнути email confirmation у
Supabase Dashboard → Authentication → Providers (тимчасово, на час MVP).
Якщо лишити увімкненим — форма реєстрації показує повідомлення «Перевір
пошту для підтвердження» замість негайного редіректу.

## Архітектура

### Сторінки та роути

- `/login` — клієнтський компонент з формою email+пароль і перемикачем
  «Увійти / Зареєструватися» (один UI, два server actions).
- `/` — головний екран, стає `async` Server Component.

### Middleware (`src/middleware.ts`)

Стандартний патерн `@supabase/ssr`:
- Оновлює сесію (refresh token) на кожен запит.
- Неавторизованого користувача на будь-якому захищеному роуті редіректить
  на `/login`.
- Авторизованого користувача, який відкрив `/login`, редіректить на `/`.
- Виключення з захисту: `/login`, статичні асети Next.js, `/api/*`
  (зарезервовано під майбутній Telegram-вебхук, у цьому під-проєкті не
  використовується).

### Вихід із системи

Кнопка-іконка «Вийти» в хедері головного екрана викликає server action
`signOut`, який робить `redirect('/login')`.

### Шар даних

**`src/app/page.tsx`** (Server Component):
1. `createClient()` (`src/lib/supabase/server.ts`) → `supabase.auth.getUser()`.
   Middleware вже гарантує наявність сесії, тому додаткової перевірки на
   `null` не потрібно.
2. Паралельно (`Promise.all`) завантажує:
   - `select * from tasks where user_id = :id order by created_at desc`
   - `select current_resource_status from users where id = :id`
3. Рендерить `<TaskDashboard initialTasks={...} initialResourceStatus={...} />`.

**`src/app/actions.ts`** — нові Server Actions (`"use server"`):

| Action | Параметри | Що робить |
|---|---|---|
| `addTask` | `{ title, energyLevel, durationMinutes }` | Інсертить рядок у `tasks` з `user_id = auth.uid()`, повертає створений рядок |
| `toggleTaskComplete` | `taskId, nextStatus` | Апдейтить `status` для рядка з `id = taskId and user_id = auth.uid()` |
| `updateResourceStatus` | `status` | Апдейтить `users.current_resource_status` для поточного юзера |
| `signIn` | `email, password` | `supabase.auth.signInWithPassword`, редірект на `/` |
| `signUp` | `email, password` | `supabase.auth.signUp`, редірект на `/` або показ «перевір пошту» |
| `signOut` | — | `supabase.auth.signOut()`, редірект на `/login` |

Кожен action створює власний `createClient()` (server). Додаткових перевірок
прав доступу в коді не потрібно — RLS-політики з `0001_init.sql` вже
гарантують, що юзер може читати/писати лише свої рядки.

`revalidatePath` не використовується: клієнтський компонент оновлює
локальний `useState` одразу після успішної відповіді server action
(оптимістичний UI, як і зараз у прототипі), без повного рефетчу сторінки.

### Клієнтський компонент

**`src/components/gentle/task-dashboard.tsx`** (новий, `"use client"`) —
переносить сюди всю логіку, що зараз у `page.tsx`:

- Приймає `initialTasks`, `initialResourceStatus` як props → `useState`.
- `handleAddTask`: викликає `addTask`, при успіху додає повернутий рядок у
  state; при помилці показує inline-повідомлення під формою і не чіпає state.
- `handleToggleComplete` / зміна `ResourceStatusToggle`: оптимістично міняють
  state, паралельно шлють відповідний server action; при помилці — відкат
  state + inline-повідомлення.
- `page.tsx` після цього — тонкий: тільки fetch + рендер `<TaskDashboard />`.

## Обробка помилок

- Форма логіну/реєстрації: відомі коди помилок Supabase Auth (невірний
  пароль, email вже зареєстровано) мапляться на людські українські фрази;
  решта — дефолтне «Щось пішло не так, спробуй ще раз».
- Server Actions: при DB-помилці повертають `{ error: string }`; компонент
  показує inline-текст користувачу, деталі — у консоль сервера (без
  додаткового логування/моніторингу — MVP).

## Поза межами обсягу

- Відновлення пароля, OAuth, кастомні email-шаблони.
- Боттом-нав, FAB, Projects, Priority, редизайн картки задачі, голосове
  введення — під-проєкти 2–4.
- Зміни схеми БД — не потрібні для цього під-проєкту.

## План перевірки

1. Реєстрація нового юзера → редірект на `/`, порожній список задач (рядок
   у `public.users` створився тригером `on_auth_user_created`).
2. Логін існуючим юзером → бачить свої задачі.
3. Додавання задачі → з'являється в списку; після `F5` — залишається
   (реально записана в БД).
4. Перемикання на «Виснажена» → задача з `energy_level = 3` ховається;
   після `F5` статус ресурсу зберігається (читається з
   `users.current_resource_status`).
5. Вихід → редірект на `/login`; спроба відкрити `/` напряму без сесії →
   редірект на `/login` (перевірка middleware).
