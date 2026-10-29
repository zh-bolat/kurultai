package kz.kurultai.assistant;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Кэш публичных данных quryltai.kz (законопроекты, планы, комитеты, депутатские запросы).
 * Обновляется раз в час, пока приложение открыто (и при каждом запуске); без сети работает на последнем снимке.
 * После неудачной попытки следующая — не раньше чем через 5 минут.
 */
final class QuryltaiDataSync {
    private static final String PREFS = "quryltai_official_cache";
    private static final String KEY_DATA = "data";
    private static final String KEY_UPDATED = "updated";
    private static final String KEY_LAST_ATTEMPT = "last_attempt";
    private static final long REFRESH_INTERVAL = 60L * 60L * 1000L;
    private static final long RETRY_AFTER_FAILURE = 5L * 60L * 1000L;
    private static final int PROMPT_MAX_BILLS = 100;
    private static final int PROMPT_MAX_REQUESTS = 120;
    private static final String BILLS = "https://quryltai.kz/api/core/draft-laws/?limit=100&offset=0";
    private static final String PLANS = "https://quryltai.kz/api/main/work-plans/plans/";
    private static final String COMMITTEES = "https://quryltai.kz/api/core/committees/with-deputies/";
    private static final String DEPUTY_REQUESTS = "https://quryltai.kz/api/core/deputy-requests/?limit=200&offset=0";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static volatile boolean refreshing;

    interface Listener {
        void onData(JSONObject data, boolean fresh);
        void onError(String message);
    }

    static void refreshIfNeeded(Context context, Listener listener) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String cached = prefs.getString(KEY_DATA, "");
        boolean cacheHasCurrentSchema = false;
        if (!cached.isEmpty()) {
            try {
                JSONObject existing = new JSONObject(cached);
                cacheHasCurrentSchema = existing.has("committees") && existing.has("deputy_requests");
                listener.onData(existing, false);
            } catch (Exception ignored) { }
        }
        long now = System.currentTimeMillis();
        long age = now - prefs.getLong(KEY_UPDATED, 0L);
        long sinceAttempt = now - prefs.getLong(KEY_LAST_ATTEMPT, 0L);
        if ((age < REFRESH_INTERVAL && cacheHasCurrentSchema) || refreshing) return;
        if (cacheHasCurrentSchema && sinceAttempt >= 0 && sinceAttempt < RETRY_AFTER_FAILURE) return;
        refreshing = true;
        prefs.edit().putLong(KEY_LAST_ATTEMPT, now).apply();
        EXECUTOR.execute(() -> {
            try {
                JSONObject bills = getJson(BILLS);
                JSONObject plans = getJson(PLANS);
                JSONArray committees = compactCommittees(getJsonArray(COMMITTEES));
                JSONObject deputyRequests = getJson(DEPUTY_REQUESTS);
                JSONObject data = new JSONObject()
                    .put("source", "quryltai.kz")
                    .put("updated_at", System.currentTimeMillis())
                    .put("bill_count", bills.optInt("count", 0))
                    .put("bills", bills.optJSONArray("result") == null ? new JSONArray() : bills.optJSONArray("result"))
                    .put("main_plans", plans.optJSONArray("main_plans") == null ? new JSONArray() : plans.optJSONArray("main_plans"))
                    .put("weekly_plans", plans.optJSONArray("weekly_plans") == null ? new JSONArray() : plans.optJSONArray("weekly_plans"))
                    .put("committees", committees)
                    .put("deputy_request_count", deputyRequests.optInt("count", 0))
                    .put("deputy_requests", compactDeputyRequests(deputyRequests.optJSONArray("result")));
                prefs.edit().putString(KEY_DATA, data.toString())
                    .putLong(KEY_UPDATED, System.currentTimeMillis()).apply();
                listener.onData(data, true);
            } catch (Exception error) {
                listener.onError(error.getMessage() == null ? "Ошибка обновления" : error.getMessage());
            } finally {
                refreshing = false;
            }
        });
    }

    static String promptContext(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "");
        if (raw.isEmpty()) return "";
        try {
            JSONObject data = new JSONObject(raw);
            StringBuilder out = new StringBuilder("\n\nОфициальный локальный снимок quryltai.kz. ");
            out.append("Обновлён: ").append(formatTime(data.optLong("updated_at"))).append(". ");
            out.append("Всего законопроектов: ").append(data.optInt("bill_count")).append(".\n");
            JSONArray bills = data.optJSONArray("bills");
            // Готовые итоги: модель ошибается, когда сама пересчитывает длинные списки.
            if (bills != null && bills.length() > 0) {
                java.util.Map<String, Integer> byStatus = new java.util.LinkedHashMap<>();
                for (int i = 0; i < bills.length(); i++) {
                    JSONObject bill = bills.optJSONObject(i);
                    if (bill == null) continue;
                    String name = statusName(bill.optInt("status"));
                    Integer n = byStatus.get(name);
                    byStatus.put(name, n == null ? 1 : n + 1);
                }
                out.append("Итоги по статусам (посчитано по ").append(bills.length()).append(" законопроектам, используй эти числа, не пересчитывай): ");
                boolean firstStatus = true;
                for (java.util.Map.Entry<String, Integer> e : byStatus.entrySet()) {
                    if (!firstStatus) out.append("; ");
                    out.append(e.getKey()).append(" — ").append(e.getValue());
                    firstStatus = false;
                }
                out.append(".\n");
            }
            for (int i = 0; bills != null && i < Math.min(PROMPT_MAX_BILLS, bills.length()); i++) {
                JSONObject bill = bills.optJSONObject(i);
                if (bill == null) continue;
                out.append("Законопроект ID ").append(bill.optInt("id")).append(": ")
                    .append(text(bill, "title").replace('\n', ' ')).append("; опубликован ")
                    .append(formatEpoch(bill.optLong("publish_date"))).append("; статус: ").append(statusName(bill.optInt("status"))).append(".\n");
            }
            JSONArray plans = data.optJSONArray("weekly_plans");
            for (int i = 0; plans != null && i < Math.min(3, plans.length()); i++) {
                JSONObject plan = plans.optJSONObject(i);
                if (plan != null) out.append("Недельный план: ").append(text(plan, "title").replace('\n', ' ')).append(".\n");
            }
            JSONArray mainPlans = data.optJSONArray("main_plans");
            for (int i = 0; mainPlans != null && i < Math.min(3, mainPlans.length()); i++) {
                JSONObject plan = mainPlans.optJSONObject(i);
                if (plan != null) out.append("Основной план мероприятий: ").append(text(plan, "title").replace('\n', ' ')).append(".\n");
            }
            JSONArray committees = data.optJSONArray("committees");
            if (committees != null && committees.length() > 0) {
                out.append("\nОфициальный состав комитетов (всего комитетов: ").append(committees.length()).append("):\n");
                for (int i = 0; i < committees.length(); i++) {
                    JSONObject committee = committees.optJSONObject(i);
                    if (committee == null) continue;
                    JSONArray deputies = committee.optJSONArray("deputies");
                    out.append(text(committee, "name")).append(" (членов: ").append(deputies == null ? 0 : deputies.length()).append("): ");
                    for (int j = 0; deputies != null && j < deputies.length(); j++) {
                        JSONObject deputy = deputies.optJSONObject(j);
                        if (deputy == null) continue;
                        if (j > 0) out.append("; ");
                        out.append(text(deputy, "name"));
                        String position = text(deputy, "position");
                        if (!position.isEmpty()) out.append(" — ").append(position);
                    }
                    out.append(".\n");
                }
            }
            JSONArray requests = data.optJSONArray("deputy_requests");
            if (requests != null && requests.length() > 0) {
                out.append("\nОфициальные депутатские запросы (всего ")
                    .append(data.optInt("deputy_request_count", requests.length())).append("):\n");
                for (int i = 0; i < Math.min(PROMPT_MAX_REQUESTS, requests.length()); i++) {
                    JSONObject request = requests.optJSONObject(i);
                    if (request == null) continue;
                    out.append(text(request, "date")).append(" — ")
                        .append(text(request, "number")).append(": ")
                        .append(text(request, "title"));
                    String authors = text(request, "authors");
                    if (!authors.isEmpty()) out.append("; авторы: ").append(authors);
                    out.append(".\n");
                }
            }
            out.append("Этот снимок является официальным, но для иных изменяемых фактов используй веб-поиск.");
            return out.toString();
        } catch (Exception ignored) { return ""; }
    }

    static String currentWeeklyPlanUrl(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "");
        if (raw.isEmpty()) return "";
        try {
            JSONArray plans = new JSONObject(raw).optJSONArray("weekly_plans");
            if (plans == null || plans.length() == 0) return "";
            JSONObject latest = plans.optJSONObject(0);
            return latest == null ? "" : latest.optString("document_url", "");
        } catch (Exception ignored) { return ""; }
    }

    private static JSONObject getJson(String address) throws Exception {
        return new JSONObject(getBody(address));
    }

    private static JSONArray getJsonArray(String address) throws Exception {
        return new JSONArray(getBody(address));
    }

    private static String getBody(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(20_000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Accept-Language", "ru");
        connection.setRequestProperty("User-Agent", "KurultaiDeputyAssistant/5.46");
        try {
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new Exception("quryltai.kz: HTTP " + code);
            InputStream input = connection.getInputStream();
            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }
            return body.toString();
        } finally {
            connection.disconnect();
        }
    }

    private static JSONArray compactCommittees(JSONArray source) throws Exception {
        JSONArray result = new JSONArray();
        if (source == null) return result;
        for (int i = 0; i < source.length(); i++) {
            JSONObject item = source.optJSONObject(i);
            if (item == null) continue;
            JSONArray members = new JSONArray();
            JSONArray deputies = item.optJSONArray("deputies");
            for (int j = 0; deputies != null && j < deputies.length(); j++) {
                JSONObject deputy = deputies.optJSONObject(j);
                if (deputy == null || !deputy.optBoolean("is_active", true)) continue;
                String name = joinName(deputy);
                if (!name.isEmpty()) members.put(new JSONObject()
                    .put("name", name)
                    .put("position", text(deputy, "position")));
            }
            result.put(new JSONObject()
                .put("id", item.optInt("id"))
                .put("name", text(item, "name"))
                .put("deputies", members));
        }
        return result;
    }

    private static JSONArray compactDeputyRequests(JSONArray source) throws Exception {
        JSONArray result = new JSONArray();
        if (source == null) return result;
        for (int i = 0; i < source.length(); i++) {
            JSONObject item = source.optJSONObject(i);
            if (item == null) continue;
            StringBuilder authors = new StringBuilder();
            JSONArray people = item.optJSONArray("authors");
            for (int j = 0; people != null && j < people.length(); j++) {
                String name = joinName(people.optJSONObject(j));
                if (name.isEmpty()) continue;
                if (authors.length() > 0) authors.append(", ");
                authors.append(name);
            }
            result.put(new JSONObject()
                .put("id", item.optInt("id"))
                .put("number", text(item, "registration_number"))
                .put("title", text(item, "title").replace('\n', ' '))
                .put("date", formatEpoch(item.optLong("request_date")))
                .put("authors", authors.toString()));
        }
        return result;
    }

    private static String joinName(JSONObject person) {
        if (person == null) return "";
        return (text(person, "last_name") + " " + text(person, "first_name") + " " +
            text(person, "patronymic")).trim().replaceAll("\\s+", " ");
    }

    /** Поле без "null": на Android optString возвращает строку "null" для JSON null (например, нет отчества). */
    private static String text(JSONObject object, String key) {
        if (object == null || object.isNull(key)) return "";
        String value = object.optString(key, "");
        return "null".equals(value) ? "" : value;
    }

    // Bill status numbers as quryltai.kz uses them.
    private static String statusName(int code) {
        switch (code) {
            case 5: return "на рассмотрении";
            case 6: return "одобрен в первом чтении";
            case 12: return "одобрен во втором чтении";
            case 7: return "принят";
            case 8: return "принят на совместном заседании";
            case 9: return "подписан Президентом";
            case 10: return "отозван";
            case 13: return "отклонён";
            case 11: return "возвращён Сенатом";
            default: return "уточняется";
        }
    }

    private static String formatTime(long millis) {
        if (millis <= 0) return "неизвестно";
        SimpleDateFormat f = new SimpleDateFormat("dd.MM.yyyy HH:mm", new Locale("ru", "RU"));
        f.setTimeZone(java.util.TimeZone.getTimeZone("GMT+05:00"));
        return f.format(new Date(millis));
    }

    private static String formatEpoch(long seconds) {
        if (seconds <= 0) return "дата не указана";
        SimpleDateFormat f = new SimpleDateFormat("dd.MM.yyyy", new Locale("ru", "RU"));
        f.setTimeZone(java.util.TimeZone.getTimeZone("GMT+05:00"));
        return f.format(new Date(seconds * 1000L));
    }
}
