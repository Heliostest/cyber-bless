package com.helio.blessingwidgets

internal enum class WidgetCoverSize { SMALL, MEDIUM, LARGE }

/** A tall 4x4 card must use its square cover instead of cropping the wide 4x2 image. */
internal fun widgetCoverSize(widthDp: Float, heightDp: Float): WidgetCoverSize = when {
  widthDp >= 300 && heightDp >= 300 -> WidgetCoverSize.LARGE
  widthDp >= 300 -> WidgetCoverSize.MEDIUM
  else -> WidgetCoverSize.SMALL
}
