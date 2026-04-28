package com.example.callassistantsim

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager
import java.util.concurrent.Executors

class IncomingCallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        if (state != TelephonyManager.EXTRA_STATE_RINGING) return

        val now = System.currentTimeMillis()
        synchronized(lock) {
            if (now - lastHandledAtMs < 8_000) return
            lastHandledAtMs = now
        }

        val incomingNumber =
            intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)?.takeIf { it.isNotBlank() }
                ?: "+919900001111"

        val pending = goAsync()
        executor.execute {
            try {
                val demoCallerText =
                    "My name is Rahul Sharma from HDFC Bank. This is urgent regarding account verification. Call me at 9876543210."
                val result = runAutoScreening(context, incomingNumber, demoCallerText)
                postNotification(
                    context,
                    title = "Screened: $incomingNumber",
                    body = "Assistant: ${result.assistantReply}\nSummary: ${result.summary}",
                )
            } catch (e: Exception) {
                postNotification(
                    context,
                    title = "Call screening failed",
                    body = e.message ?: "Unknown error",
                )
            } finally {
                pending.finish()
            }
        }
    }

    private fun runAutoScreening(context: Context, fromNumber: String, callerText: String): ScreeningResult {
        val store = InAppStore(context.applicationContext)
        val mobileLlm = TinyRuleBasedMobileLlmEngine()
        val callSid = "LOCAL-${System.currentTimeMillis().toString(16)}"
        val greeting = "Hi, you've reached Alex's assistant. May I know who's calling and what this is regarding?"
        val initialSession = SimCallSession(
            call_sid = callSid,
            from_number = fromNumber,
            to_number = "+911234567890",
            status = "active",
            transcript = listOf(TranscriptTurn(speaker = "assistant", text = greeting)),
        )
        val inference = mobileLlm.inferTurn(callerText, initialSession.details, initialSession.transcript)
        val assistantReply = inference.suggestedReply ?: "Thank you. I am noting this and will pass it along."
        val updatedTranscript = initialSession.transcript + listOf(
            TranscriptTurn(speaker = "caller", text = callerText),
            TranscriptTurn(speaker = "assistant", text = assistantReply),
        )
        val summary = buildLocalSummary(inference.details)
        val finalSession = initialSession.copy(
            details = inference.details,
            transcript = updatedTranscript,
            summary = summary,
            status = if (inference.shouldEnd) "completed" else "active",
        )
        store.upsertCall(finalSession)
        return ScreeningResult(assistantReply = assistantReply, summary = summary)
    }

    private fun buildLocalSummary(details: ExtractedDetails): String {
        val name = details.caller_name ?: "unknown caller"
        val company = details.company ?: "unknown company"
        val subject = details.subject ?: "no subject yet"
        val urgency = details.urgency ?: "unknown urgency"
        val callback = details.callback_number ?: "no callback number"
        return "Local mobile summary: $name from $company regarding $subject (urgency: $urgency, callback: $callback)."
    }

    private fun postNotification(context: Context, title: String, body: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Incoming Call Screening",
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            manager.createNotificationChannel(channel)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, CHANNEL_ID)
        } else {
            android.app.Notification.Builder(context)
        }
        val notif = builder
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.stat_notify_call_mute)
            .setAutoCancel(true)
            .build()
        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notif)
    }

    data class ScreeningResult(
        val assistantReply: String,
        val summary: String,
    )

    companion object {
        private const val CHANNEL_ID = "incoming_call_screening"
        private val executor = Executors.newSingleThreadExecutor()
        private val lock = Any()
        private var lastHandledAtMs: Long = 0
    }
}
