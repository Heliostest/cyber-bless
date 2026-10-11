package com.helio.blessingwidgets

import android.content.Context
import android.util.AtomicFile
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Independent disposable cache; never opens AsyncStorage or the personal save. */
internal object WidgetSnapshotStore {
  private val lock = Any()
  private val refreshRevision = MutableStateFlow(0L)
  val refreshes = refreshRevision.asStateFlow()

  fun signalRefresh() = synchronized(lock) {
    refreshRevision.value += 1
  }

  private fun file(context: Context): AtomicFile {
    val directory = File(context.noBackupFilesDir, "blessing-widgets")
    check(directory.isDirectory || directory.mkdirs()) { "Widget cache directory unavailable" }
    return AtomicFile(File(directory, "today-v1.json"))
  }

  fun write(context: Context, snapshot: WidgetSnapshot) = synchronized(lock) {
    val target = file(context)
    var stream: FileOutputStream? = null
    try {
      stream = target.startWrite()
      stream.write(snapshot.toJson().toByteArray(Charsets.UTF_8))
      target.finishWrite(stream)
    } catch (error: Exception) {
      target.failWrite(stream)
      throw error
    }
  }

  fun read(context: Context): WidgetSnapshot? = synchronized(lock) {
    try {
      file(context).openRead().use { stream ->
        // Bound reads even for damaged or unexpectedly oversized files.
        val bytes = ByteArray(WidgetSnapshot.MAX_BYTES + 1)
        var total = 0
        while (total < bytes.size) {
          val count = stream.read(bytes, total, bytes.size - total)
          if (count < 0) break
          total += count
        }
        if (total > WidgetSnapshot.MAX_BYTES) null
        else WidgetSnapshot.parse(String(bytes, 0, total, Charsets.UTF_8))
      }
    } catch (_: Exception) {
      null
    }
  }
}
