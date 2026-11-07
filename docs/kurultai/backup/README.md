# Бэкапы базы робота Курултая

База `kurultai` (контейнер `kurultai-db` стека `kurultai-robot`): материалы админки `/app/admin` (планёрки, повестки,
справки с файлами), журнал вопросов, память разговоров, метрики. Astana Hub — отдельно, этими скриптами не трогается.

| Где | Что | Сколько хранится |
|---|---|---|
| Сервер `~/kurultai-backups/` | `kurultai-<время>.dump` (`pg_dump -Fc`), cron `bolat` в 03:30 по Астане | 14 дней |
| Ноутбук владельца `~/kurultai-backups/` | та же копия, systemd user timer `kurultai-pull-backups.timer` (09:00, догоняет после выключения) | 60 дней |

- Скрипт на сервере: `~/kurultai-backup/kurultai-backup.sh` (= `kurultai-backup.sh` отсюда), журнал —
  `~/kurultai-backup/backup.log`. Каждая копия перед сохранением проверяется `pg_restore --list`.
- Ноутбук: `pull-backups.sh`, юниты в `systemd/` (ставятся в `~/.config/systemd/user/`).
  Состояние: `systemctl --user list-timers kurultai-pull-backups.timer`, журнал —
  `journalctl --user -u kurultai-pull-backups.service`. Скрипт падает с ошибкой, если свежей копии больше 48 ч.
- Обновить скрипт на сервере: `scp -i ~/.ssh/lab_key docs/kurultai/backup/kurultai-backup.sh bolat@89.144.34.185:kurultai-backup/`.

## Проверка восстановления (без риска для рабочей базы)
Копия разворачивается во временную базу, счётчики сравниваются с рабочей, временная удаляется. Проверено
2026-11-07: 16 таблиц, миграция `0005_kurultai_materials`, счётчики совпали.

```
C=kurultai-robot-kurultai-db-1; D=$(ls -1t ~/kurultai-backups/kurultai-*.dump | head -1)
docker exec $C psql -U kurultai -d postgres -c "CREATE DATABASE kurultai_restore_test"
docker exec -i $C pg_restore -U kurultai -d kurultai_restore_test --no-owner < "$D"
docker exec $C psql -U kurultai -d kurultai_restore_test -c "select count(*) from kurultai_materials"
docker exec $C psql -U kurultai -d postgres -c "DROP DATABASE kurultai_restore_test"
```

## Восстановление рабочей базы (только по решению владельца)
1. Остановить API, чтобы никто не писал: `cd ~/kurultai-robot/infra && docker compose -f docker-compose.kurultai.yml stop kurultai-api`.
2. Свежий дамп текущего состояния на всякий случай: `~/kurultai-backup/kurultai-backup.sh`.
3. Пересоздать базу и восстановить:
   ```
   C=kurultai-robot-kurultai-db-1
   docker exec $C psql -U kurultai -d postgres -c "DROP DATABASE kurultai" -c "CREATE DATABASE kurultai"
   docker exec -i $C pg_restore -U kurultai -d kurultai --no-owner < ~/kurultai-backups/kurultai-<время>.dump
   ```
   С ноутбука — сначала `scp` копии на сервер.
4. Запустить API: `docker compose -f docker-compose.kurultai.yml up -d kurultai-api`, проверить `/v1/health` и админку.
