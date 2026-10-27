package com.helio.blessingwidgets

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.SimpleTimeZone
import java.util.TimeZone

internal data class WidgetDay(
  val day: String, val sceneId: String, val title: String, val category: String,
  val artKey: String, val collected: String,
) {
  // Native constructs every destination. No URI from disk is ever used to launch an Activity.
  val deepLink: String get() = "cyber-bless://widget/today?v=1&day=$day&scene=$sceneId"
}

internal data class WidgetScene(val title: String, val category: String)

internal data class WidgetSnapshot(
  val sourceHash: String, val generatedAt: String, val timeZone: String,
  val validThroughDay: String, val days: List<WidgetDay>,
  val schemaVersion: Int = 1, val localePreference: String = "system",
  val opening: JSONObject? = null,
) {
  fun select(localDay: String): WidgetDay? =
    if (localDay > validThroughDay) null else days.firstOrNull { it.day == localDay }

  /** Serialize only the validated projection, never the original JS JSON or extra fields. */
  fun toJson(): String = JSONObject().put("schemaVersion", schemaVersion).put("sourceVersion", 1)
    .put("sourceHash", sourceHash).put("catalogRevision", CATALOG_REVISION)
    .put("generatedAt", generatedAt).put("timeZone", timeZone)
    .put("validThroughDay", validThroughDay).apply {
      if (schemaVersion == 2) {
        put("localePreference", localePreference)
        put("copyRevision", WidgetLocalization.COPY_REVISION)
      }
      if (opening != null && schemaVersion == 2) put("opening", opening)
    }.put("days", JSONArray().also { result ->
      days.forEach { value -> result.put(JSONObject()
        .put("day", value.day).put("sceneId", value.sceneId).apply { if (schemaVersion == 1) put("title", value.title) }
        .put("category", value.category).put("artKey", value.artKey)
        .put("collected", value.collected).put("deepLink", value.deepLink)) }
    }).toString()

  companion object {
    const val MAX_BYTES = 32 * 1024
    const val CATALOG_REVISION = "bundled-daily-v1"
    const val GENERIC_LINK = "cyber-bless://widget/today?v=1"
    val scenes = WidgetCatalog.scenes
    private val rootKeys = setOf("schemaVersion", "sourceVersion", "sourceHash", "catalogRevision",
      "generatedAt", "timeZone", "validThroughDay", "days")
    private val dayKeys = setOf("day", "sceneId", "title", "category", "artKey", "collected", "deepLink")

    fun parse(raw: String): WidgetSnapshot? = try {
      require(raw.toByteArray(Charsets.UTF_8).size <= MAX_BYTES)
      val tokener = JSONTokener(raw)
      val root = tokener.nextValue() as? JSONObject ?: error("Invalid projection root")
      require(tokener.nextClean() == '\u0000')
      val keys = root.keys().asSequence().toSet()
      val version = root.get("schemaVersion")
      require(version == 1 || version == 2)
      val expectedKeys = rootKeys + if (version == 2) setOf("localePreference", "copyRevision") else emptySet()
      require(keys == expectedKeys || keys == expectedKeys + "opening")
      val preference = if (version == 2) root.getString("localePreference") else "system"
      require(preference == "system" || preference in WidgetLocalization.supported)
      if (version == 2) require(root.getString("copyRevision") == WidgetLocalization.COPY_REVISION)
      var openingDay = ""
      var openingIds = emptyList<String>()
      if (root.has("opening")) {
        val opening = root.getJSONObject("opening")
        require(opening.keys().asSequence().toSet() == setOf("day", "sceneIds"))
        require(WidgetDates.parseDay(opening.getString("day")) != null)
        val entries = opening.getJSONArray("sceneIds")
        require(entries.length() == 3)
        val ids = (0 until entries.length()).map { entries.getString(it) }
        require(ids.toSet().size == 3)
        require(ids.take(2).all { scenes[it]?.category == "blessing" })
        require(scenes[ids[2]]?.category == "wish")
        openingDay = opening.getString("day")
        openingIds = ids
        // Android selects from the validated daily rows below. The optional
        // JS selection context is validated here, then omitted by toJson().
      }
      require(root.get("sourceVersion") == 1)
      require(root.getString("catalogRevision") == CATALOG_REVISION)
      val hash = root.getString("sourceHash")
      require(hash.matches(Regex("[0-9a-f]{64}")))
      val generatedAt = root.getString("generatedAt")
      val generated = WidgetDates.parseInstant(generatedAt) ?: error("Invalid generation time")
      val timeZone = root.getString("timeZone")
      val zone = WidgetDates.parseTimeZone(timeZone) ?: error("Invalid timezone")
      val generatedDay = WidgetDates.localDay(generated, zone)
      val validThrough = root.getString("validThroughDay")
      require(WidgetDates.parseDay(validThrough) != null)
      val entries = root.getJSONArray("days")
      require(entries.length() == 0 || entries.length() == 7)
      val days = (0 until entries.length()).map { index ->
        val json = entries.getJSONObject(index)
        require(json.keys().asSequence().toSet() == if (version == 2) dayKeys - "title" else dayKeys)
        val day = json.getString("day")
        require(day == WidgetDates.addDays(generatedDay, index))
        val id = json.getString("sceneId")
        // Retain source metadata for history, but never show retired App scenes from a stale snapshot.
        require(id !in WidgetCatalog.hiddenSceneIds)
        val scene = scenes[id] ?: error("Unknown scene")
        require(json.getString("artKey") == id)
        require((version == 2 || json.getString("title") == scene.title) && json.getString("category") == scene.category)
        if (version == 2) require(id == WidgetLocalization.dailyScene(day, if (day == openingDay) openingIds else emptyList()))
        val collected = json.getString("collected")
        require(collected == "unknown" || (index == 0 && collected == "confirmed"))
        val result = WidgetDay(day, id, scene.title, scene.category, id, collected)
        require(json.getString("deepLink") == result.deepLink)
        result
      }
      require(validThrough == (days.lastOrNull()?.day ?: generatedDay))
      WidgetSnapshot(hash, generatedAt, timeZone, validThrough, days, version as Int, preference,
        if (root.has("opening")) root.getJSONObject("opening") else null)
    } catch (_: Exception) {
      null
    }
  }
}

/** Calendar APIs keep API 24 compatibility and calculate local day boundaries across DST. */
internal object WidgetDates {
  private fun dayFormat(zone: TimeZone) = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
    timeZone = zone
    isLenient = false
  }

  fun localDay(nowMillis: Long = System.currentTimeMillis(), zone: TimeZone = TimeZone.getDefault()): String =
    dayFormat(zone).format(Date(nowMillis))

  fun parseDay(day: String): Date? {
    if (!day.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}"))) return null
    val position = ParsePosition(0)
    return dayFormat(TimeZone.getTimeZone("UTC")).parse(day, position)
      ?.takeIf { position.index == day.length && localDay(it.time, TimeZone.getTimeZone("UTC")) == day }
  }

  fun addDays(day: String, offset: Int): String {
    val zone = TimeZone.getTimeZone("UTC")
    val calendar = Calendar.getInstance(zone).apply {
      time = parseDay(day) ?: error("Invalid local day")
      add(Calendar.DATE, offset)
    }
    return localDay(calendar.timeInMillis, zone)
  }

  fun parseInstant(value: String): Long? {
    if (!value.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}(Z|[+-][0-9]{2}:[0-9]{2})"))) return null
    val position = ParsePosition(0)
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply { isLenient = false }
      .parse(value, position)?.takeIf { position.index == value.length }?.time
  }

  fun parseTimeZone(value: String): TimeZone? {
    if (value in TimeZone.getAvailableIDs().toSet()) return TimeZone.getTimeZone(value)
    if (value.matches(Regex("UTC[+-]?[0-9]{1,4}"))) {
      val minutes = value.removePrefix("UTC").toIntOrNull() ?: return null
      if (minutes in -840..840) return SimpleTimeZone(minutes * 60_000, value)
    }
    return null
  }

  fun untilNextMidnight(nowMillis: Long = System.currentTimeMillis(), zone: TimeZone = TimeZone.getDefault()): Long {
    val next = Calendar.getInstance(zone).apply {
      timeInMillis = nowMillis
      add(Calendar.DATE, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return (next.timeInMillis - nowMillis).coerceAtLeast(1_000L)
  }
}
