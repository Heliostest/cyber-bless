package com.helio.blessingwidgets

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.state.GlanceStateDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class TodayRitualWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(
    DpSize(140.dp, 140.dp), DpSize(300.dp, 140.dp), DpSize(300.dp, 300.dp),
  ))
  override val stateDefinition: GlanceStateDefinition<*>? = null

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val initial = withContext(Dispatchers.IO) { readView(context) }
    provideContent {
      val revision by WidgetSnapshotStore.refreshes.collectAsState()
      val view by produceState(initialValue = initial, key1 = revision) {
        value = withContext(Dispatchers.IO) { readView(context) }
      }
      TodayCard(view.day, view.entry, view.locale, view.formatLocale, activityIntent(context, view.entry))
    }
  }

  override suspend fun providePreview(context: Context, widgetCategory: Int) {
    // The gallery always uses public generic content and never opens the snapshot cache.
    val locale = WidgetLocalization.resolve("system", context.languageTags())
    provideContent { TodayCard("", null, locale, WidgetLocalization.formatTag("system", context.languageTags()), activityIntent(context, null)) }
  }
}

private data class WidgetView(val day: String, val entry: WidgetDay?, val locale: String, val formatLocale: String)
private fun Context.languageTags(): List<String> = resources.configuration.locales.let { values ->
  (0 until values.size()).map { values[it].toLanguageTag() }
}

private fun readView(context: Context): WidgetView {
  val day = WidgetDates.localDay()
  val snapshot = WidgetSnapshotStore.read(context)
  val preference = snapshot?.localePreference ?: "system"
  val tags = context.languageTags()
  return WidgetView(day, snapshot?.select(day), WidgetLocalization.resolve(preference, tags), WidgetLocalization.formatTag(preference, tags))
}

private fun activityIntent(context: Context, entry: WidgetDay?) = Intent(Intent.ACTION_VIEW).apply {
  component = ComponentName(context.packageName, "${context.packageName}.MainActivity")
  data = Uri.parse(entry?.deepLink ?: WidgetSnapshot.GENERIC_LINK)
  addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
}

private val coverTitle = ColorProvider(Color(0xFFFFFEF7))

@Composable
private fun TodayCard(day: String, entry: WidgetDay?, locale: String, formatLocale: String, intent: Intent) {
  val size = widgetCoverSize(LocalSize.current.width.value, LocalSize.current.height.value)
  val large = size == WidgetCoverSize.LARGE
  val compact = size == WidgetCoverSize.SMALL
  val title = if (entry == null) WidgetLocalization.text(locale, "native.widget.invitation") else WidgetLocalization.title(locale, entry.sceneId)
  val date = WidgetDates.parseDay(day)?.let {
    java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM, java.util.Locale.forLanguageTag(formatLocale))
      .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(it)
  } ?: ""
  val launch = actionStartActivity(intent)
  Box(
    modifier = GlanceModifier.fillMaxSize()
      .background(ImageProvider(WidgetCatalog.cover(entry?.artKey, size)), contentScale = ContentScale.Crop)
      .cornerRadius(20.dp).clickable(launch)
      .semantics { contentDescription = if (day.isEmpty()) title else WidgetLocalization.accessibility(locale, date, title) },
  ) {
    // Native drawable preserves text contrast without tinting the scene's central artwork.
    Box(modifier = GlanceModifier.fillMaxSize()
      .background(ImageProvider(R.drawable.blessing_widget_cover_scrim))) {}
    Column(modifier = GlanceModifier.fillMaxSize().padding(if (large) 18.dp else if (compact) 10.dp else 14.dp)) {
      Spacer(GlanceModifier.defaultWeight())
      Text(title, modifier = GlanceModifier.fillMaxWidth(),
        style = TextStyle(color = coverTitle, fontSize = if (large) 22.sp else if (compact) 14.sp else 18.sp,
          fontWeight = FontWeight.Bold), maxLines = 2)
    }
  }
}

class TodayRitualWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = TodayRitualWidget()

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    WidgetRefreshScheduler.requestRefresh(context.applicationContext)
  }

  override fun onDisabled(context: Context) {
    WidgetRefreshScheduler.cancel(context.applicationContext)
    super.onDisabled(context)
  }
}
