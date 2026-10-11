package com.helio.blessingwidgets

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class BlessingWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BlessingWidgets")

    AsyncFunction("publishSnapshot") Coroutine { snapshotJson: String ->
      withContext(Dispatchers.IO) {
        publishLock.withLock {
          val context = appContext.reactContext?.applicationContext
            ?: error("Application context unavailable")
          val snapshot = WidgetSnapshot.parse(snapshotJson)
            ?: throw IllegalArgumentException("Invalid widget snapshot projection")
          WidgetSnapshotStore.write(context, snapshot)
          WidgetRefreshScheduler.refreshWidgets(context)
          WidgetRefreshScheduler.ensureScheduled(context)
        }
      }
    }

    AsyncFunction("refresh") Coroutine { ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext?.applicationContext
          ?: error("Application context unavailable")
        WidgetRefreshScheduler.refreshWidgets(context)
        WidgetRefreshScheduler.ensureScheduled(context)
      }
    }
  }

  companion object {
    private val publishLock = Mutex()
  }
}
