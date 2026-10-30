package com.helio.blessingwidgets

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class WidgetSnapshotTest {
  @Test fun acceptsPublicOpeningMetadataAndKeepsTheValidatedDailyRows() {
    val opening = JSONObject().put("day", "2026-10-11")
      .put("sceneIds", JSONArray(listOf("furin-wind-chime", "shinto-torii", "crane")))
    val parsed = WidgetSnapshot.parse(snapshot().put("opening", opening).toString())
    assertNotNull("The completed opening must not prevent widget publication", parsed)
    assertEquals("woodfish", parsed!!.select("2026-10-11")!!.sceneId)
    assertEquals("woodfish", parsed.select("2026-10-12")!!.sceneId)
    assertFalse(JSONObject(parsed.toJson()).has("opening"))
    assertNotNull(WidgetSnapshot.parse(parsed.toJson()))
  }

  @Test fun rejectsPrivateOrMalformedOpeningMetadata() {
    fun opening(ids: List<String>) = JSONObject().put("day", "2026-10-11").put("sceneIds", JSONArray(ids))
    val valid = listOf("furin-wind-chime", "shinto-torii", "crane")
    assertNull(WidgetSnapshot.parse(snapshot().put("opening", opening(valid).put("wish", "private")).toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("opening", opening(valid).put("day", "2026-02-30")).toString()))
    for (ids in listOf(listOf("unknown", "shinto-torii", "crane"),
      listOf("woodfish", "woodfish", "crane"), listOf("woodfish", "shinto-torii", "furin-wind-chime"))) {
      assertNull(WidgetSnapshot.parse(snapshot().put("opening", opening(ids)).toString()))
    }
  }

  private fun snapshot(): JSONObject {
    val days = JSONArray()
    for (offset in 11..17) {
      val day = "2026-10-$offset"
      days.put(JSONObject().put("day", day).put("sceneId", "woodfish")
        .put("title", "敲一敲木鱼").put("category", "blessing").put("artKey", "woodfish")
        .put("collected", if (offset == 11) "confirmed" else "unknown")
        .put("deepLink", "cyber-bless://widget/today?v=1&day=$day&scene=woodfish"))
    }
    return JSONObject().put("schemaVersion", 1).put("sourceVersion", 1)
      .put("sourceHash", "a".repeat(64)).put("catalogRevision", "bundled-daily-v1")
      .put("generatedAt", "2026-10-11T02:00:00.000Z").put("timeZone", "Asia/Shanghai")
      .put("validThroughDay", "2026-10-17").put("days", days)
  }

  private fun epoch(text: String): Long = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssX", Locale.US)
    .parse(text)!!.time

  @Test fun selectsExactLocalDayAndNeverCarriesYesterdayConfirmation() {
    val parsed = WidgetSnapshot.parse(snapshot().toString())!!
    assertEquals("confirmed", parsed.select("2026-10-11")!!.collected)
    assertEquals("unknown", parsed.select("2026-10-12")!!.collected)
    assertNull(parsed.select("2026-10-18"))
    assertNull(parsed.select("2026-10-10"))
  }

  @Test fun deviceTimezoneControlsSelectionAcrossMidnight() {
    val now = epoch("2026-10-11T16:30:00Z")
    assertEquals("2026-10-12", WidgetDates.localDay(now, TimeZone.getTimeZone("Asia/Shanghai")))
    assertEquals("2026-10-11", WidgetDates.localDay(now, TimeZone.getTimeZone("America/Los_Angeles")))
  }

  @Test fun malformedVersionsPrivateFieldsAndLinksFailClosed() {
    assertNull(WidgetSnapshot.parse("broken"))
    assertNull(WidgetSnapshot.parse(snapshot().toString() + "trailing corruption"))
    assertNull(WidgetSnapshot.parse(snapshot().put("schemaVersion", 2).toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("sourceVersion", 2).toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("wishes", JSONArray().put("secret")).toString()))
    val wrongLink = snapshot()
    wrongLink.getJSONArray("days").getJSONObject(0).put("deepLink", "https://example.com/private")
    assertNull(WidgetSnapshot.parse(wrongLink.toString()))
    val privateTitle = snapshot()
    privateTitle.getJSONArray("days").getJSONObject(0).put("title", "a private wish")
    assertNull(WidgetSnapshot.parse(privateTitle.toString()))
    val privateNote = snapshot()
    privateNote.getJSONArray("days").getJSONObject(0).put("notes", "private note")
    assertNull(WidgetSnapshot.parse(privateNote.toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("sourceHash", "not-a-confirmed-hash").toString()))
  }

  @Test fun everyBundledSceneIsAcceptedWithItsPublicTitleAndArtKey() {
    val approved = listOf(
      Triple("woodfish", "敲一敲木鱼", "blessing"),
      Triple("furin-wind-chime", "风铃一响", "blessing"),
      Triple("shinto-torii", "庭前一礼", "blessing"),
      Triple("tibetan-wheel", "廊前轻转", "blessing"),
      Triple("celtic-folk-spring", "泉边一念", "blessing"),
      Triple("theravada-water", "花水位一倾", "blessing"),
      Triple("tanzaku-tanabata", "短册系竹", "wish"),
      Triple("yeondeunghoe", "燃灯上浮", "wish"),
      Triple("crane", "折一只纸鹤", "wish"),
      Triple("lantern", "月下一灯", "wish"),
      Triple("slavic-wreath", "火边花环", "blessing"),
      Triple("japanese-koinobori", "鲤旗迎风", "blessing"),
      Triple("peruvian-engraved-gourd", "葫芦刻光", "wish"),
    )
    for ((id, title, category) in approved) {
      val json = snapshot()
      val entries = json.getJSONArray("days")
      for (index in 0 until entries.length()) {
        val entry = entries.getJSONObject(index)
        entry.put("sceneId", id).put("artKey", id).put("title", title).put("category", category)
          .put("deepLink", "cyber-bless://widget/today?v=1&day=${entry.getString("day")}&scene=$id")
      }
      val selected = WidgetSnapshot.parse(json.toString())?.select("2026-10-11")
      if (id in WidgetCatalog.hiddenSceneIds) {
        assertNull(selected)
        continue
      }
      assertNotNull("Missing native whitelist metadata for $id", selected)
      assertEquals(id, selected!!.sceneId)
    }
  }

  @Test fun nativeValidationAcceptsTheCompleteSharedPublicCatalog() {
    val raw = javaClass.getResourceAsStream("/widget-catalog.json")!!.bufferedReader().use { it.readText() }
    val catalog = JSONArray(raw)
    assertEquals(catalog.length(), WidgetSnapshot.scenes.size)
    for (index in 0 until catalog.length()) {
      val scene = catalog.getJSONObject(index)
      val id = scene.getString("id")
      val json = snapshot()
      val days = json.getJSONArray("days")
      for (dayIndex in 0 until days.length()) {
        val day = days.getJSONObject(dayIndex)
        day.put("sceneId", id).put("artKey", id).put("title", scene.getString("title"))
          .put("category", scene.getString("category"))
          .put("deepLink", "cyber-bless://widget/today?v=1&day=${day.getString("day")}&scene=$id")
      }
      if (id in WidgetCatalog.hiddenSceneIds) assertNull(WidgetSnapshot.parse(json.toString()))
      else assertEquals(id, WidgetSnapshot.parse(json.toString())?.select("2026-10-11")?.sceneId)
    }
  }

  @Test fun invalidDatesGapsArtAndFutureConfirmationAreRejected() {
    for ((field, value) in listOf("day" to "2026-02-30", "artKey" to "https://example.com/a.png",
      "sceneId" to "unknown-scene", "category" to "wish")) {
      val valueJson = snapshot()
      valueJson.getJSONArray("days").getJSONObject(0).put(field, value)
      assertNull("Expected invalid $field", WidgetSnapshot.parse(valueJson.toString()))
    }
    val future = snapshot()
    future.getJSONArray("days").getJSONObject(1).put("collected", "confirmed")
    assertNull(WidgetSnapshot.parse(future.toString()))
    val gap = snapshot()
    gap.getJSONArray("days").getJSONObject(1).put("day", "2026-10-14")
    assertNull(WidgetSnapshot.parse(gap.toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("validThroughDay", "2026-11-17").toString()))
  }

  @Test fun emptyPublicProjectionInvalidatesOldPersonalStatus() {
    val empty = snapshot().put("days", JSONArray()).put("validThroughDay", "2026-10-11")
    val parsed = WidgetSnapshot.parse(empty.toString())!!
    assertNull(parsed.select("2026-10-11"))
    assertEquals("cyber-bless://widget/today?v=1", WidgetSnapshot.GENERIC_LINK)
  }

  @Test fun supportsOffsetFallbackAndRejectsInvalidTimezone() {
    assertNotNull(WidgetSnapshot.parse(snapshot().put("timeZone", "UTC480").toString()))
    assertNull(WidgetSnapshot.parse(snapshot().put("timeZone", "not-a-timezone").toString()))
  }

  @Test fun midnightDelayUsesCalendarAcrossDstRatherThanTwentyFourHours() {
    val zone = TimeZone.getTimeZone("America/New_York")
    val beforeSpringForward = epoch("2026-03-08T05:00:00Z")
    assertEquals(23 * 60 * 60 * 1000L, WidgetDates.untilNextMidnight(beforeSpringForward, zone))
    val beforeFallBack = epoch("2026-11-01T04:00:00Z")
    assertEquals(25 * 60 * 60 * 1000L, WidgetDates.untilNextMidnight(beforeFallBack, zone))
  }

  private fun snapshotV2(): JSONObject {
    val json = snapshot().put("schemaVersion", 2).put("localePreference", "ja")
      .put("copyRevision", WidgetLocalization.COPY_REVISION)
    val days = json.getJSONArray("days")
    for (index in 0 until days.length()) {
      val day = days.getJSONObject(index)
      val id = WidgetLocalization.dailyScene(day.getString("day"))!!
      day.remove("title")
      day.put("sceneId", id).put("artKey", id).put("category", WidgetCatalog.scenes.getValue(id).category)
        .put("deepLink", "cyber-bless://widget/today?v=1&day=${day.getString("day")}&scene=$id")
    }
    return json
  }

  @Test fun v2UsesOnlyPublicIdsAndRetainsManualLanguage() {
    val parsed = WidgetSnapshot.parse(snapshotV2().toString())!!
    assertEquals("ja", parsed.localePreference)
    assertEquals(2, parsed.schemaVersion)
    assertFalse(JSONObject(parsed.toJson()).getJSONArray("days").getJSONObject(0).has("title"))
    assertNotNull(WidgetSnapshot.parse(parsed.toJson()))
    assertNull(WidgetSnapshot.parse(snapshotV2().put("localePreference", "private").toString()))
    assertNull(WidgetSnapshot.parse(snapshotV2().put("copyRevision", "stale").toString()))
    val privateTitle = snapshotV2()
    privateTitle.getJSONArray("days").getJSONObject(0).put("title", "private title")
    assertNull(WidgetSnapshot.parse(privateTitle.toString()))
    val wrongChoice = snapshotV2()
    wrongChoice.getJSONArray("days").getJSONObject(0).put("sceneId", "woodfish").put("artKey", "woodfish")
      .put("category", "blessing").put("deepLink", "cyber-bless://widget/today?v=1&day=2026-10-11&scene=woodfish")
    if (WidgetLocalization.dailyScene("2026-10-11") != "woodfish") assertNull(WidgetSnapshot.parse(wrongChoice.toString()))
  }

  @Test fun resolvesAllNativeLanguagesWithOrderedScriptAwareFallback() {
    for (locale in WidgetLocalization.supported) assertEquals(locale, WidgetLocalization.resolve(locale, listOf("fr")))
    assertEquals("ja", WidgetLocalization.resolve("system", listOf("de-DE", "ja-JP")))
    assertEquals("zh-Hans", WidgetLocalization.resolve("system", listOf("zh-Hans-TW")))
    assertEquals("zh-Hant", WidgetLocalization.resolve("system", listOf("zh-Hant-CN")))
    assertEquals("zh-Hant", WidgetLocalization.resolve("system", listOf("zh-HK")))
    assertEquals("pt", WidgetLocalization.resolve("system", listOf("pt-BR")))
    assertEquals("en", WidgetLocalization.resolve("system", listOf("invalid_!", "de-DE")))
    assertEquals("en-GB", WidgetLocalization.formatTag("system", listOf("de-DE", "en-GB")))
    assertEquals("pt-BR", WidgetLocalization.formatTag("system", listOf("pt-BR")))
    assertEquals("ja", WidgetLocalization.formatTag("ja", listOf("pt-BR")))
  }
}
