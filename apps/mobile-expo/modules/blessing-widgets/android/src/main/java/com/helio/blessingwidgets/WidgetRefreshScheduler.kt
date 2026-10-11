package com.helio.blessingwidgets

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import java.util.concurrent.TimeUnit

internal object WidgetRefreshScheduler {
  private const val PERIODIC = "blessing-widgets:periodic-v1"
  private const val MIDNIGHT = "blessing-widgets:midnight-v1"
  private const val IMMEDIATE = "blessing-widgets:refresh-v1"

  fun hasInstances(context: Context): Boolean = AppWidgetManager.getInstance(context)
    .getAppWidgetIds(ComponentName(context, TodayRitualWidgetReceiver::class.java)).isNotEmpty()

  suspend fun refreshWidgets(context: Context) {
    // updateAll alone does not restart an existing Glance composition. Its observed signal rereads disk.
    WidgetSnapshotStore.signalRefresh()
    TodayRitualWidget().updateAll(context)
  }

  fun ensureScheduled(context: Context, midnightPolicy: ExistingWorkPolicy = ExistingWorkPolicy.REPLACE) {
    if (!hasInstances(context)) {
      cancel(context)
      return
    }
    val manager = WorkManager.getInstance(context)
    manager.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<WidgetRefreshWorker>(6, TimeUnit.HOURS).build())
    // Calendar-derived delay changes with DST, manual time and timezone changes. Not an exact alarm.
    manager.enqueueUniqueWork(MIDNIGHT, midnightPolicy,
      OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
        .setInputData(workDataOf("midnight" to true))
        .setInitialDelay(WidgetDates.untilNextMidnight(), TimeUnit.MILLISECONDS).build())
  }

  fun requestRefresh(context: Context) {
    if (!hasInstances(context)) {
      cancel(context)
      return
    }
    ensureScheduled(context)
    WorkManager.getInstance(context).enqueueUniqueWork(IMMEDIATE, ExistingWorkPolicy.REPLACE,
      OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build())
  }

  fun cancel(context: Context) {
    val manager = WorkManager.getInstance(context)
    listOf(PERIODIC, MIDNIGHT, IMMEDIATE).forEach(manager::cancelUniqueWork)
  }
}

/** Worker only reads the widget cache; it never starts RN, DOM, an Activity, or network work. */
class WidgetRefreshWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
  override suspend fun doWork(): Result {
    if (!WidgetRefreshScheduler.hasInstances(applicationContext)) {
      WidgetRefreshScheduler.cancel(applicationContext)
      return Result.success()
    }
    return try {
      WidgetRefreshScheduler.refreshWidgets(applicationContext)
      // Append the next boundary to the current midnight job instead of cancelling ourselves.
      WidgetRefreshScheduler.ensureScheduled(applicationContext,
        if (inputData.getBoolean("midnight", false)) ExistingWorkPolicy.APPEND_OR_REPLACE else ExistingWorkPolicy.KEEP)
      Result.success()
    } catch (error: CancellationException) {
      throw error
    } catch (_: Exception) {
      Result.retry()
    }
  }
}

/** These system broadcasts are protected and exempt from implicit broadcast restrictions. */
class WidgetClockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action in setOf(Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)) {
      WidgetRefreshScheduler.requestRefresh(context.applicationContext)
    }
  }
}
