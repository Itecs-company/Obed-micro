# Обеды сотрудников

Полнофункциональное приложение для ведения учета сотрудников, участвующих в обеде. В состав решения входит backend на FastAPI, современный интерфейс на React + Material UI, а также база данных PostgreSQL. Развертывание производится через `docker-compose`.

## Возможности

- Авторизация с использованием JWT (логин/пароль по умолчанию `admin/admin`).
- Возможность смены учетных данных непосредственно из интерфейса.
- Современный UI с поддержкой темной и светлой темы, переключение в один клик.
- Редактируемая таблица сотрудников с функциями, аналогичными Excel:
  - добавление, удаление и редактирование записей;
  - загрузка данных вручную, через API, webhook или импорт из Excel;
  - выбор периода по календарю с расчетом итоговой стоимости.
- Настройка стоимости обеда с пересчетом итогов за выбранный период.
- Выгрузка отчетов в формате Excel и PDF (с ценой и без), а также за любой выбранный период.
- Отдельная панель логов, открывающаяся по клику, для контроля операций.
- REST API и webhook для удаленного добавления, обновления и удаления записей.

## Быстрый старт

```bash
docker compose up --build
```

После сборки сервисы будут доступны по адресам:

- Интерфейс: http://localhost:3080
- API: http://localhost:8000/docs (Swagger UI)
- PostgreSQL: localhost:5432 (логин `root25`, пароль `Admin2025`, база `obed`)

## Структура проекта

```
backend/   # FastAPI приложение
frontend/  # React + Vite интерфейс
```

### Backend

- FastAPI + SQLAlchemy.
- Авторизация по JWT, хранение пользователей в БД.
- CRUD-операции над таблицей сотрудников, изменение статуса участия в обеде.
- Импорт из Excel (`POST /employees/import`).
- Экспорт в Excel и PDF (`GET /employees/export/excel`, `GET /employees/export/pdf`).
- Настройка стоимости обеда (`GET/PUT /settings`).
- Webhook (`POST /webhook/employee`) с секретом `obed-webhook-secret`.

### Frontend

- Vite + React + Material UI.
- Современный адаптивный интерфейс с переключением тем.
- Таблица на базе MUI DataGrid с редактированием по месту.
- Диалог добавления сотрудника, импорт из Excel, выбор периода, экспорт отчетов.
- Панель логирования и блок с примерами API/cURL.

## Примеры запросов

### Авторизация

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Как добавить запись, чтобы она появилась в интерфейсе

1. Поднимите проект:

   ```bash
   docker compose up --build
   ```

   После старта откройте http://localhost:3080 и авторизуйтесь в интерфейсе под логином `admin` и паролем `admin`.

2. В отдельном терминале получите JWT‑токен (он нужен для всех защищенных API):

   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}' | jq -r '.access_token')
   ```

   Если `jq` не установлен, можно просто выполнить запрос и скопировать значение `access_token` из ответа.

3. Добавьте сотрудника через API, передавая токен в заголовке `Authorization`:

   ```bash
   curl -X POST http://localhost:8000/employees \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{
       "full_name":"Петров Петр",
       "status":true,
       "date":"2024-04-01",
       "note":"В офисе"
     }'
   ```

   Эндпоинт требует действующий токен: все операции с сотрудниками защищены зависимостью `get_current_user`.

4. Перезагрузите страницу интерфейса — добавленная запись появится в таблице. Для проверки через API можно выполнить:

   ```bash
   curl -X GET "http://localhost:8000/employees" \
     -H "Authorization: Bearer ${TOKEN}"
   ```

   Запрос вернёт список сотрудников, текущую стоимость обеда и суммарные расчёты.

5. Если хотите наполнять данные без авторизации, используйте webhook с секретом `obed-webhook-secret` — он не требует JWT, но проверяет поле `secret` в теле запроса.

### Добавление сотрудника по API

```bash
curl -X POST http://localhost:8000/employees \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Иванов Иван","status":true,"date":"2024-04-01"}'
```

### Webhook

```bash
curl -X POST http://localhost:8000/webhook/employee \
  -H "Content-Type: application/json" \
  -d '{
        "secret":"obed-webhook-secret",
        "action":"add",
        "employee":{
          "full_name":"Иванов Иван",
          "status":true,
          "date":"2024-04-01"
        }
      }'
```

## Переменные окружения

| Переменная         | Описание                                   | Значение по умолчанию |
| ------------------ | ------------------------------------------- | ---------------------- |
| `DATABASE_URL`     | Строка подключения к PostgreSQL             | `postgresql+psycopg2://root25:Admin2025@db:5432/obed` |
| `SECRET_KEY`       | Секрет для подписи JWT                      | `super-secret-key-change` |
| `WEBHOOK_SECRET`   | Секрет для webhook                          | `obed-webhook-secret` |
| `VITE_API_URL`     | URL API для фронтенда (docker)              | `http://localhost:8000` |

## Тестовые данные

После первого старта автоматически создается пользователь `admin/admin` и базовая стоимость обеда 150 рублей.

## Разработка локально (без Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Интерфейс будет доступен на http://localhost:5173 (при этом необходимо указать переменную `VITE_API_URL=http://localhost:8000`).

---

Приложение готово к использованию и дальнейшему расширению под любые задачи учета обедов.
