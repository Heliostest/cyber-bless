package com.helio.blessingwidgets

import org.junit.Assert.*
import org.junit.Test

class WidgetCoverSizeTest {
  @Test fun resizingSelectsSquareDetailCoverOnlyWhenBothDimensionsFit() {
    assertEquals(WidgetCoverSize.SMALL, widgetCoverSize(140f, 140f))
    assertEquals(WidgetCoverSize.MEDIUM, widgetCoverSize(300f, 140f))
    assertEquals(WidgetCoverSize.LARGE, widgetCoverSize(300f, 300f))
    assertEquals(WidgetCoverSize.LARGE, widgetCoverSize(420f, 360f))
    assertEquals(WidgetCoverSize.MEDIUM, widgetCoverSize(420f, 299f))
    assertEquals(WidgetCoverSize.SMALL, widgetCoverSize(299f, 420f))
    assertEquals(R.drawable.blessing_preview_woodfish_small,
      WidgetCatalog.cover("woodfish", widgetCoverSize(140f, 140f)))
    assertEquals(R.drawable.blessing_preview_woodfish_medium,
      WidgetCatalog.cover("woodfish", widgetCoverSize(300f, 140f)))
    assertEquals(R.drawable.blessing_preview_woodfish_large,
      WidgetCatalog.cover("woodfish", widgetCoverSize(300f, 300f)))
  }

  @Test fun everyApprovedSceneUsesDistinctCoversAndUnknownScenesUseTheGenericCover() {
    for (size in WidgetCoverSize.entries) {
      val covers = WidgetCatalog.scenes.keys.map { WidgetCatalog.cover(it, size) }
      assertEquals(covers.size, covers.toSet().size)
      assertFalse(covers.contains(WidgetCatalog.cover(null, size)))
      assertEquals(WidgetCatalog.cover(null, size), WidgetCatalog.cover("unknown-scene", size))
    }
    for (id in WidgetCatalog.scenes.keys) {
      assertEquals(3, WidgetCoverSize.entries.map { WidgetCatalog.cover(id, it) }.toSet().size)
    }
  }
}
