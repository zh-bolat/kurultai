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

/** Daily, offline-tolerant cache of public data from quryltai.kz official APIs. */
final class QuryltaiDataSync {
    private static final String PREFS = "quryltai_official_cache";
    private static final String KEY_DATA = "data";
    private static final String KEY_UPDATED = "updated";
    private static final long DAY = 24L * 60L * 60L * 1000L;
    private static final String BILLS = "https://quryltai.kz/api/core/draft-laws/?limit=20&offset=0";
    private static final String PLANS = "https://quryltai.kz/api/main/work-plans/plans/";
    private static final String COMMITTEES = "https://quryltai.kz/api/core/committees/with-deputies/";
    private static final String DEPUTY_REQUESTS = "https://quryltai.kz/api/core/deputy-requests/?limit=100&offset=0";
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
        long age = System.currentTimeMillis() - prefs.getLong(KEY_UPDATED, 0L);
        if ((age < DAY && cacheHasCurrentSchema) || refreshing) return;
        refreshing = true;
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
            for (int i = 0; bills != null && i < Math.min(12, bills.length()); i++) {
                JSONObject bill = bills.optJSONObject(i);
                if (bill == null) continue;
                out.append("Законопроект ID ").append(bill.optInt("id")).append(": ")
                    .append(bill.optString("title")).append("; опубликован ")
                    .append(formatEpoch(bill.optLong("publish_date"))).append("; статус-код ")
                    .append(bill.optInt("status")).append(".\n");
            }
            JSONArray plans = data.optJSONArray("weekly_plans");
            for (int i = 0; plans != null && i < Math.min(3, plans.length()); i++) {
                JSONObject plan = plans.optJSONObject(i);
                if (plan != null) out.append("Недельный план: ").append(plan.optString("title").replace('\n', ' ')).append(".\n");
            }
            JSONArray mainPlans = data.optJSONArray("main_plans");
            for (int i = 0; mainPlans != null && i < Math.min(3, mainPlans.length()); i++) {
                JSONObject plan = mainPlans.optJSONObject(i);
                if (plan != null) out.append("Основной план мероприятий: ").append(plan.optString("title").replace('\n', ' ')).append(".\n");
            }
            JSONArray committees = data.optJSONArray("committees");
            if (committees != null && committees.length() > 0) {
                out.append("\nОфициальный состав комитетов:\n");
                for (int i = 0; i < committees.length(); i++) {
                    JSONObject committee = committees.optJSONObject(i);
                    if (committee == null) continue;
                    out.append(committee.optString("name")).append(": ");
                    JSONArray deputies = committee.optJSONArray("deputies");
                    for (int j = 0; deputies != null && j < deputies.length(); j++) {
                        JSONObject deputy = deputies.optJSONObject(j);
                        if (deputy == null) continue;
                        if (j > 0) out.append("; ");
                        out.append(deputy.optString("name"));
                        String position = deputy.optString("position");
                        if (!position.isEmpty()) out.append(" — ").append(position);
                    }
                    out.append(".\n");
                }
            }
            JSONArray requests = data.optJSONArray("deputy_requests");
            if (requests != null && requests.length() > 0) {
                out.append("\nОфициальные депутатские запросы (всего ")
                    .append(data.optInt("deputy_request_count", requests.length())).append("):\n");
                for (int i = 0; i < requests.length(); i++) {
                    JSONObject request = requests.optJSONObject(i);
                    if (request == null) continue;
                    out.append(request.optString("date")).append(" — ")
                        .append(request.optString("number")).append(": ")
                        .append(request.optString("title"));
                    String authors = request.optString("authors");
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
                    .put("position", deputy.optString("position")));
            }
            result.put(new JSONObject()
                .put("id", item.optInt("id"))
                .put("name", item.optString("name"))
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
                .put("number", item.optString("registration_number"))
                .put("title", item.optString("title").replace('\n', ' '))
                .put("date", formatEpoch(item.optLong("request_date")))
                .put("authors", authors.toString()));
        }
        return result;
    }

    private static String joinName(JSONObject person) {
        if (person == null) return "";
        return (person.optString("last_name") + " " + person.optString("first_name") + " " +
            person.optString("patronymic")).trim().replaceAll("\\s+", " ");
    }

    private static String formatTime(long millis) {
        if (millis <= 0) return "неизвестно";
        return new SimpleDateFormat("dd.MM.yyyy HH:mm", new Locale("ru", "RU")).format(new Date(millis));
    }

    private static String formatEpoch(long seconds) {
        if (seconds <= 0) return "дата не указана";
        return new SimpleDateFormat("dd.MM.yyyy", new Locale("ru", "RU")).format(new Date(seconds * 1000L));
    }
}
