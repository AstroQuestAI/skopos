package com.example.callassistantsim

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaPlayer
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.regex.Pattern

object NetworkConfig {
    const val MAC_LAN_HOST = "192.168.5.248"
    const val API_BASE_URL = "http://$MAC_LAN_HOST:8010/"
    const val API_BASE_URL_NO_SLASH = "http://$MAC_LAN_HOST:8010"
}

data class TranscriptTurn(
    val speaker: String,
    val text: String,
    val created_at: String? = null,
)

data class ExtractedDetails(
    val caller_name: String? = null,
    val company: String? = null,
    val subject: String? = null,
    val urgency: String? = null,
    val callback_number: String? = null,
)

data class SimCallSession(
    val call_sid: String,
    val from_number: String? = null,
    val to_number: String? = null,
    val status: String = "active",
    val summary: String? = null,
    val user_action: String? = null,
    val details: ExtractedDetails = ExtractedDetails(),
    val transcript: List<TranscriptTurn> = emptyList(),
)

class InAppStore(context: Context) {
    private val prefs = context.getSharedPreferences("call_assistant_local_store", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val callListType = object : TypeToken<List<SimCallSession>>() {}.type

    fun loadCalls(): List<SimCallSession> {
        val raw = prefs.getString(KEY_CALLS, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<SimCallSession>>(raw, callListType) }.getOrDefault(emptyList())
    }

    fun saveCalls(calls: List<SimCallSession>) {
        prefs.edit().putString(KEY_CALLS, gson.toJson(calls)).apply()
    }

    fun upsertCall(session: SimCallSession): List<SimCallSession> {
        val updated = loadCalls().filterNot { it.call_sid == session.call_sid }.toMutableList()
        updated.add(0, session)
        saveCalls(updated)
        return updated
    }

    fun saveConfig(
        fromNumber: String,
        toNumber: String,
        mobileLlmMode: MobileLlmMode,
        backendMode: BackendMode,
        voiceEngineMode: VoiceEngineMode,
        appThemeStyle: AppThemeStyle,
        assistantVoiceProfile: AssistantVoiceProfile,
    ) {
        prefs.edit()
            .putString(KEY_FROM, fromNumber)
            .putString(KEY_TO, toNumber)
            .putString(KEY_LLM_MODE, mobileLlmMode.name)
            .putString(KEY_BACKEND_MODE, backendMode.name)
            .putString(KEY_VOICE_MODE, voiceEngineMode.name)
            .putString(KEY_THEME_STYLE, appThemeStyle.name)
            .putString(KEY_ASSISTANT_VOICE_PROFILE, assistantVoiceProfile.name)
            .apply()
    }

    fun loadConfig(): LocalConfig {
        return LocalConfig(
            fromNumber = prefs.getString(KEY_FROM, null),
            toNumber = prefs.getString(KEY_TO, null),
            mobileLlmMode = prefs.getString(KEY_LLM_MODE, null)?.let { runCatching { MobileLlmMode.valueOf(it) }.getOrNull() },
            backendMode = prefs.getString(KEY_BACKEND_MODE, null)?.let { runCatching { BackendMode.valueOf(it) }.getOrNull() },
            voiceEngineMode = prefs.getString(KEY_VOICE_MODE, null)?.let { runCatching { VoiceEngineMode.valueOf(it) }.getOrNull() },
            appThemeStyle = prefs.getString(KEY_THEME_STYLE, null)?.let { runCatching { AppThemeStyle.valueOf(it) }.getOrNull() },
            assistantVoiceProfile = prefs.getString(KEY_ASSISTANT_VOICE_PROFILE, null)?.let { runCatching { AssistantVoiceProfile.valueOf(it) }.getOrNull() },
        )
    }

    data class LocalConfig(
        val fromNumber: String?,
        val toNumber: String?,
        val mobileLlmMode: MobileLlmMode?,
        val backendMode: BackendMode?,
        val voiceEngineMode: VoiceEngineMode?,
        val appThemeStyle: AppThemeStyle?,
        val assistantVoiceProfile: AssistantVoiceProfile?,
    )

    companion object {
        private const val KEY_CALLS = "calls_json"
        private const val KEY_FROM = "from_number"
        private const val KEY_TO = "to_number"
        private const val KEY_LLM_MODE = "mobile_llm_mode"
        private const val KEY_BACKEND_MODE = "backend_mode"
        private const val KEY_VOICE_MODE = "voice_engine_mode"
        private const val KEY_THEME_STYLE = "app_theme_style"
        private const val KEY_ASSISTANT_VOICE_PROFILE = "assistant_voice_profile"
    }
}

data class SimStartRequest(
    val from_number: String?,
    val to_number: String?,
)

data class SimTurnRequest(
    val call_sid: String,
    val caller_text: String,
)

data class SimEndRequest(val call_sid: String)
data class SimActionRequest(val action: String)

data class SimStartResponse(val call_sid: String, val assistant_reply: String, val session: SimCallSession)
data class SimTurnResponse(val assistant_reply: String, val should_end: Boolean, val session: SimCallSession)
data class SimEndResponse(val ok: Boolean, val session: SimCallSession)
data class SimListResponse(val items: List<SimCallSession>)
data class SimActionResponse(val ok: Boolean, val item: SimCallSession?, val error: String? = null)

enum class MobileLlmMode {
    SERVER_ONLY,
    HYBRID,
    LOCAL_ONLY,
}

enum class BackendMode {
    SERVER_ONLY,
    OFFLINE_FIRST,
    OFFLINE_ONLY,
}

enum class VoiceEngineMode {
    AUTO,
    OS_TTS,
    OMNIVOICE,
}

enum class AppThemeStyle {
    MINIMAL_CALM,
    NEON_COMMAND,
    TRUST_FINANCE,
}

enum class AssistantVoiceProfile {
    FEMALE_CLEAR,
    FEMALE_WARM,
    MALE_CLEAR,
    MALE_DEEP,
}

data class MobileTurnInference(
    val details: ExtractedDetails = ExtractedDetails(),
    val suggestedReply: String? = null,
    val shouldEnd: Boolean = false,
    val shouldSkipServer: Boolean = false,
    val responseLanguage: String = "en",
)

data class SpeechOutput(
    val text: String,
    val engineUsed: String,
    val wavBytes: ByteArray? = null,
    val wavChunks: List<ByteArray>? = null,
)

interface MobileLlmEngine {
    fun inferTurn(
        callerText: String,
        currentDetails: ExtractedDetails,
        transcript: List<TranscriptTurn>,
    ): MobileTurnInference
}

interface EmbeddedVoiceEngine {
    val name: String
    suspend fun synthesizeForTts(text: String, language: String): SpeechOutput?
    fun health(): String = "unknown"
}

class EmbeddedOmniVoiceEngine : EmbeddedVoiceEngine {
    override val name: String = "embedded_omnivoice"
    override suspend fun synthesizeForTts(text: String, language: String): SpeechOutput? = null
    override fun health(): String = "model_not_packaged"
}

class OnDeviceVoiceRouter(
    private val omniVoice: EmbeddedVoiceEngine = EmbeddedOmniVoiceEngine(),
) {
    suspend fun render(text: String, language: String, mode: VoiceEngineMode): SpeechOutput {
        val chosen = when (mode) {
            VoiceEngineMode.AUTO -> SpeechOutput(text, "os_tts_local_auto")
            VoiceEngineMode.OS_TTS -> SpeechOutput(text, "os_tts")
            VoiceEngineMode.OMNIVOICE -> omniVoice.synthesizeForTts(text, language)
        }
        return chosen ?: SpeechOutput(text, "os_tts_fallback")
    }

    fun diagnosticStatus(): String {
        return "os_tts=available, omnivoice=${omniVoice.health()}"
    }
}

class WavPlayer(private val context: android.content.Context) {
    private var mediaPlayer: MediaPlayer? = null

    fun play(wavBytes: ByteArray) {
        stop()
        val temp = File.createTempFile("assistant-voice-", ".wav", context.cacheDir)
        temp.writeBytes(wavBytes)
        mediaPlayer = MediaPlayer().apply {
            setDataSource(temp.absolutePath)
            setOnCompletionListener {
                stop()
                temp.delete()
            }
            prepare()
            start()
        }
    }

    fun stop() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
    }
}

class InterruptibleAudioPlayer {
    private val interrupted = AtomicBoolean(false)
    private val scope = kotlinx.coroutines.CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var playJob: Job? = null
    private var activeTrack: AudioTrack? = null

    fun play(speech: SpeechOutput) {
        stop()
        val chunks = speech.wavChunks ?: speech.wavBytes?.let { listOf(it) } ?: return
        interrupted.set(false)
        playJob = scope.launch {
            for (chunk in chunks) {
                if (!isActive || interrupted.get()) break
                playChunk(chunk)
            }
        }
    }

    fun stop() {
        interrupted.set(true)
        playJob?.cancel()
        playJob = null
        activeTrack?.pause()
        activeTrack?.flush()
        activeTrack?.release()
        activeTrack = null
    }

    fun shutdown() {
        stop()
        scope.coroutineContext.cancelChildren()
    }

    private fun playChunk(wavBytes: ByteArray) {
        val decoded = decodeWavPcm16(wavBytes) ?: return
        val channelMask = if (decoded.channels > 1) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
        val minBuffer = AudioTrack.getMinBufferSize(decoded.sampleRateHz, channelMask, AudioFormat.ENCODING_PCM_16BIT)
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(decoded.sampleRateHz)
                    .setChannelMask(channelMask)
                    .build(),
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(maxOf(minBuffer, 4096))
            .build()
        activeTrack = track
        track.play()
        var offset = 0
        while (offset < decoded.pcm16le.size && !interrupted.get()) {
            val toWrite = minOf(4096, decoded.pcm16le.size - offset)
            val written = track.write(decoded.pcm16le, offset, toWrite)
            if (written <= 0) break
            offset += written
        }
        track.stop()
        track.release()
        if (activeTrack === track) activeTrack = null
    }
}

private data class DecodedWav(
    val sampleRateHz: Int,
    val channels: Int,
    val pcm16le: ByteArray,
)

private fun decodeWavPcm16(wavBytes: ByteArray): DecodedWav? {
    if (wavBytes.size < 44) return null
    if (String(wavBytes, 0, 4) != "RIFF" || String(wavBytes, 8, 4) != "WAVE") return null
    val bb = ByteBuffer.wrap(wavBytes).order(ByteOrder.LITTLE_ENDIAN)
    var offset = 12
    var sampleRate = 22050
    var channels = 1
    var dataStart = -1
    var dataLen = 0
    while (offset + 8 <= wavBytes.size) {
        val id = String(wavBytes, offset, 4)
        val size = bb.getInt(offset + 4)
        val start = offset + 8
        if (id == "fmt " && start + 16 <= wavBytes.size) {
            channels = bb.getShort(start + 2).toInt()
            sampleRate = bb.getInt(start + 4)
        } else if (id == "data") {
            dataStart = start
            dataLen = size
            break
        }
        offset = start + size + (size % 2)
    }
    if (dataStart < 0 || dataStart + dataLen > wavBytes.size) return null
    return DecodedWav(sampleRate, channels, wavBytes.copyOfRange(dataStart, dataStart + dataLen))
}

class TinyRuleBasedMobileLlmEngine : MobileLlmEngine {
    private val callbackPattern = Pattern.compile("(\\+91\\d{10}|\\b\\d{10}\\b)")

    override fun inferTurn(
        callerText: String,
        currentDetails: ExtractedDetails,
        transcript: List<TranscriptTurn>,
    ): MobileTurnInference {
        val normalized = callerText.trim()
        if (normalized.isEmpty()) return MobileTurnInference()
        val lowered = normalized.lowercase(Locale.ROOT)
        val responseLanguage = detectReplyLanguage(normalized, transcript)

        var details = currentDetails
        if (details.caller_name.isNullOrBlank()) {
            val name = extractName(normalized)
            if (!name.isNullOrBlank()) {
                details = details.copy(caller_name = name)
            }
        }
        if (details.company.isNullOrBlank()) {
            val company = extractCompany(normalized)
            if (!company.isNullOrBlank()) {
                details = details.copy(company = company)
            }
        }
        if (details.subject.isNullOrBlank()) {
            val subject = extractSubject(normalized)
            if (!subject.isNullOrBlank()) {
                details = details.copy(subject = subject)
            }
        }
        if (details.urgency.isNullOrBlank()) {
            val urgency = extractUrgency(lowered)
            if (!urgency.isNullOrBlank()) {
                details = details.copy(urgency = urgency)
            }
        }
        if (details.callback_number.isNullOrBlank()) {
            val callback = extractCallback(normalized)
            if (!callback.isNullOrBlank()) {
                details = details.copy(callback_number = callback)
            }
        }

        val obviousSpam = lowered.contains("loan") || lowered.contains("free offer") || lowered.contains("credit card")
        if (obviousSpam) {
            return MobileTurnInference(
                details = details,
                suggestedReply = spamCloseLine(responseLanguage),
                shouldEnd = true,
                shouldSkipServer = true,
                responseLanguage = responseLanguage,
            )
        }

        val hasAll =
            !details.caller_name.isNullOrBlank() &&
                !details.company.isNullOrBlank() &&
                !details.subject.isNullOrBlank() &&
                !details.urgency.isNullOrBlank() &&
                !details.callback_number.isNullOrBlank()

        if (hasAll) {
            return MobileTurnInference(
                details = details,
                suggestedReply = closeLine(responseLanguage),
                shouldEnd = true,
                shouldSkipServer = true,
                responseLanguage = responseLanguage,
            )
        }

        val followUp = when {
            details.caller_name.isNullOrBlank() -> questionFor("caller_name", responseLanguage)
            details.company.isNullOrBlank() -> questionFor("company", responseLanguage)
            details.subject.isNullOrBlank() -> questionFor("subject", responseLanguage)
            details.urgency.isNullOrBlank() -> questionFor("urgency", responseLanguage)
            details.callback_number.isNullOrBlank() -> questionFor("callback_number", responseLanguage)
            else -> null
        }

        return MobileTurnInference(
            details = details,
            suggestedReply = followUp,
            shouldEnd = false,
            shouldSkipServer = false,
            responseLanguage = responseLanguage,
        )
    }

    private fun extractName(text: String): String? {
        val prefixes = listOf("i am ", "i'm ", "my name is ", "this is ")
        val lowered = text.lowercase(Locale.ROOT)
        for (prefix in prefixes) {
            val idx = lowered.indexOf(prefix)
            if (idx >= 0) {
                val raw = text.substring(idx + prefix.length).trim().split(" ").take(3).joinToString(" ")
                return raw.trim(',', '.', ';').takeIf { it.isNotBlank() }
            }
        }
        return null
    }

    private fun extractCompany(text: String): String? {
        val markers = listOf("from ", "company ")
        val lowered = text.lowercase(Locale.ROOT)
        for (marker in markers) {
            val idx = lowered.indexOf(marker)
            if (idx >= 0) {
                val raw = text.substring(idx + marker.length).trim().split(" ").take(4).joinToString(" ")
                return raw.trim(',', '.', ';').takeIf { it.isNotBlank() }
            }
        }
        return null
    }

    private fun extractSubject(text: String): String? {
        val markers = listOf("regarding ", "about ", "for ")
        val lowered = text.lowercase(Locale.ROOT)
        for (marker in markers) {
            val idx = lowered.indexOf(marker)
            if (idx >= 0) {
                return text.substring(idx + marker.length).trim().take(80).trim(',', '.', ';')
            }
        }
        return null
    }

    private fun extractUrgency(loweredText: String): String? {
        return when {
            loweredText.contains("urgent") || loweredText.contains("asap") || loweredText.contains("today") -> "high"
            loweredText.contains("tomorrow") || loweredText.contains("this week") -> "medium"
            loweredText.contains("whenever") || loweredText.contains("not urgent") -> "low"
            else -> null
        }
    }

    private fun extractCallback(text: String): String? {
        val matcher = callbackPattern.matcher(text)
        if (!matcher.find()) return null
        var number = matcher.group(1) ?: return null
        if (!number.startsWith("+91") && number.length == 10) {
            number = "+91$number"
        }
        return number
    }

    private fun detectReplyLanguage(callerText: String, transcript: List<TranscriptTurn>): String {
        val latestCaller = transcript.asReversed().firstOrNull { it.speaker == "caller" }?.text
        val sample = callerText.ifBlank { latestCaller ?: "" }
        if (sample.any { it.code in 0x0C00..0x0C7F }) return "te"
        if (sample.any { it.code in 0x0900..0x097F }) return "hi"
        val lowered = sample.lowercase(Locale.ROOT)
        val teluguRomanMarkers = listOf("andi", "nenu", "meeru", "garu", "cheppandi", "undi")
        val hindiRomanMarkers = listOf("mera", "naam", "aap", "kripya", "bataye", "bol raha", "dhanyavaad")
        return when {
            teluguRomanMarkers.any { lowered.contains(it) } -> "te"
            hindiRomanMarkers.any { lowered.contains(it) } -> "hi"
            else -> "en"
        }
    }

    private fun questionFor(field: String, language: String): String {
        if (language == "hi") {
            return when (field) {
                "caller_name" -> "Kripya apna naam batayen."
                "company" -> "Aap kis company ya sanstha se bol rahe hain?"
                "subject" -> "Yeh call kis baare mein hai?"
                "urgency" -> "Kya yeh aaj ke liye urgent hai?"
                "callback_number" -> "Kripya apna callback number batayen."
                else -> "Kripya thoda aur vivaran dein."
            }
        }
        if (language == "te") {
            return when (field) {
                "caller_name" -> "Mee peru cheppagalarā?"
                "company" -> "Meeru ē company lēda samstha nunchi matlāḍutunnāru?"
                "subject" -> "Idi ē vishayam gurinchi call?"
                "urgency" -> "Idi īrōju urgent ā?"
                "callback_number" -> "Mee callback number cheppandi."
                else -> "Dayachesi konchem marinta vivaram cheppandi."
            }
        }
        return when (field) {
            "caller_name" -> "May I know your name?"
            "company" -> "Which company are you calling from?"
            "subject" -> "Please tell me what this is regarding."
            "urgency" -> "Is this urgent for today?"
            "callback_number" -> "Please share your callback number."
            else -> "Could you share more details?"
        }
    }

    private fun closeLine(language: String): String {
        return when (language) {
            "hi" -> "Dhanyavaad, maine details note kar li hain. Main Alex ko bata dunga."
            "te" -> "Dhanyavaadalu, mee vivaralu note chesanu. Alex ki cheptaanu."
            else -> "Thanks, I have your details. I will pass this to Alex."
        }
    }

    private fun spamCloseLine(language: String): String {
        return when (language) {
            "hi" -> "Dhanyavaad. Yeh number promotional calls accept nahi karta. Namaste."
            "te" -> "Dhanyavaadalu. Ee number promotional calls accept cheyyadu. Namaskaram."
            else -> "Thanks. This number is not accepting promotional calls. Goodbye."
        }
    }
}

interface SimApi {
    @POST("/api/sim/start")
    suspend fun startCall(@Body req: SimStartRequest): SimStartResponse

    @POST("/api/sim/turn")
    suspend fun sendTurn(@Body req: SimTurnRequest): SimTurnResponse

    @POST("/api/sim/end")
    suspend fun endCall(@Body req: SimEndRequest): SimEndResponse

    @GET("/api/sim/calls")
    suspend fun listCalls(): SimListResponse

    @POST("/api/sim/calls/{callSid}/action")
    suspend fun setAction(@Path("callSid") callSid: String, @Body req: SimActionRequest): SimActionResponse
}

class SimViewModel : ViewModel() {
    private val mobileLlm: MobileLlmEngine = TinyRuleBasedMobileLlmEngine()
    private val voiceRouter = OnDeviceVoiceRouter()
    private var store: InAppStore? = null
    private val api: SimApi by lazy {
        val logger = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder().addInterceptor(logger).build()
        Retrofit.Builder()
            .baseUrl(NetworkConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SimApi::class.java)
    }

    var currentSession by mutableStateOf<SimCallSession?>(null)
    var fromNumber by mutableStateOf("+919876543210")
    var toNumber by mutableStateOf("+911234567890")
    var callerText by mutableStateOf("")
    var statusText by mutableStateOf("Ready")
    var mobileLlmMode by mutableStateOf(MobileLlmMode.LOCAL_ONLY)
    var backendMode by mutableStateOf(BackendMode.OFFLINE_ONLY)
    var voiceEngineMode by mutableStateOf(VoiceEngineMode.OS_TTS)
    var appThemeStyle by mutableStateOf(AppThemeStyle.MINIMAL_CALM)
    var assistantVoiceProfile by mutableStateOf(AssistantVoiceProfile.FEMALE_CLEAR)
    var demoModeEnabled by mutableStateOf(false)
    var lastAssistantLanguage by mutableStateOf("en")
    val calls = mutableStateListOf<SimCallSession>()

    fun attachStore(context: Context) {
        if (store != null) return
        store = InAppStore(context.applicationContext)
        val config = store?.loadConfig()
        config?.fromNumber?.let { fromNumber = it }
        config?.toNumber?.let { toNumber = it }
        config?.mobileLlmMode?.let { mobileLlmMode = it }
        config?.backendMode?.let { backendMode = it }
        config?.voiceEngineMode?.let { voiceEngineMode = it }
        config?.appThemeStyle?.let { appThemeStyle = it }
        config?.assistantVoiceProfile?.let { assistantVoiceProfile = it }
        loadLocalCalls("Loaded local data")
    }

    fun updateFromNumber(value: String) {
        fromNumber = value
        persistConfig()
    }

    fun updateToNumber(value: String) {
        toNumber = value
        persistConfig()
    }

    private fun persistConfig() {
        store?.saveConfig(fromNumber, toNumber, mobileLlmMode, backendMode, voiceEngineMode, appThemeStyle, assistantVoiceProfile)
    }

    private fun loadLocalCalls(message: String = "Loaded local calls") {
        val localCalls = store?.loadCalls().orEmpty()
        calls.clear()
        calls.addAll(localCalls)
        if (currentSession == null) {
            currentSession = localCalls.firstOrNull { it.status == "active" }
        }
        statusText = "$message (${localCalls.size})"
    }

    private fun saveLocalSession(session: SimCallSession) {
        val localCalls = store?.upsertCall(session).orEmpty()
        calls.clear()
        calls.addAll(localCalls)
    }

    fun cycleMobileLlmMode() {
        mobileLlmMode =
            when (mobileLlmMode) {
                MobileLlmMode.SERVER_ONLY -> MobileLlmMode.HYBRID
                MobileLlmMode.HYBRID -> MobileLlmMode.LOCAL_ONLY
                MobileLlmMode.LOCAL_ONLY -> MobileLlmMode.SERVER_ONLY
            }
        statusText = "Mode: ${mobileLlmMode.name.replace("_", " ")}"
        persistConfig()
    }

    fun cycleBackendMode() {
        backendMode =
            when (backendMode) {
                BackendMode.SERVER_ONLY -> BackendMode.OFFLINE_FIRST
                BackendMode.OFFLINE_FIRST -> BackendMode.OFFLINE_ONLY
                BackendMode.OFFLINE_ONLY -> BackendMode.SERVER_ONLY
            }
        statusText = "Backend: ${backendMode.name.replace("_", " ")}"
        persistConfig()
    }

    fun cycleVoiceEngineMode() {
        voiceEngineMode =
            when (voiceEngineMode) {
                VoiceEngineMode.AUTO -> VoiceEngineMode.OS_TTS
                VoiceEngineMode.OS_TTS -> VoiceEngineMode.OMNIVOICE
                VoiceEngineMode.OMNIVOICE -> VoiceEngineMode.AUTO
            }
        statusText = "Voice: ${voiceEngineMode.name.replace("_", " ")}"
        persistConfig()
    }

    fun cycleThemeStyle() {
        appThemeStyle =
            when (appThemeStyle) {
                AppThemeStyle.MINIMAL_CALM -> AppThemeStyle.NEON_COMMAND
                AppThemeStyle.NEON_COMMAND -> AppThemeStyle.TRUST_FINANCE
                AppThemeStyle.TRUST_FINANCE -> AppThemeStyle.MINIMAL_CALM
            }
        statusText = "Theme: ${appThemeStyle.name.replace("_", " ")}"
        persistConfig()
    }

    fun setThemeStyle(style: AppThemeStyle) {
        appThemeStyle = style
        statusText = "Theme: ${appThemeStyle.name.replace("_", " ")}"
        persistConfig()
    }

    fun selectAssistantVoiceProfile(profile: AssistantVoiceProfile) {
        assistantVoiceProfile = profile
        statusText = "Assistant voice: ${profile.name.replace("_", " ")}"
        persistConfig()
    }

    fun toggleDemoMode() {
        demoModeEnabled = !demoModeEnabled
        statusText = if (demoModeEnabled) "Demo mode ON" else "Demo mode OFF"
    }

    fun refreshCalls() {
        if (backendMode == BackendMode.OFFLINE_ONLY) {
            loadLocalCalls()
            return
        }
        runApi("Refreshing calls...") {
            val response = api.listCalls()
            calls.clear()
            calls.addAll(response.items)
            statusText = "Loaded ${response.items.size} calls"
        }
    }

    fun startCall() {
        runApi("Starting simulated call...") {
            startCallVoiceLab()
        }
    }

    fun runDemoScript() {
        runApi("Running demo call...") {
            startCallVoiceLab()
            val scriptedTurns = listOf(
                "Hello, this is Priya from ICICI Bank regarding your KYC update. Please call me at 9876543210.",
                "This is medium urgency because verification is pending today.",
                "Thanks, I am from the Chennai branch and this is about account confirmation.",
            )
            for (turn in scriptedTurns) {
                sendTurnVoiceLab(turn)
                delay(350)
            }
            statusText = "Demo script completed"
        }
    }

    fun sendTurn() {
        val session = currentSession ?: return
        val text = callerText.trim()
        if (text.isEmpty()) return
        runApi("Sending caller turn...") {
            sendTurnVoiceLab(text)
            callerText = ""
        }
    }

    fun endCall() {
        val session = currentSession ?: return
        if (backendMode == BackendMode.OFFLINE_ONLY) {
            val ended = session.copy(status = "completed")
            currentSession = ended
            saveLocalSession(ended)
            statusText = "Call finalized locally"
            return
        }
        runApi("Ending call...") {
            val response = api.endCall(SimEndRequest(call_sid = session.call_sid))
            currentSession = response.session
            val refreshed = api.listCalls()
            calls.clear()
            calls.addAll(refreshed.items)
            statusText = "Call finalized"
        }
    }

    fun setAction(callSid: String, action: String) {
        if (backendMode == BackendMode.OFFLINE_ONLY) {
            val existing = calls.firstOrNull { it.call_sid == callSid } ?: currentSession?.takeIf { it.call_sid == callSid }
            if (existing == null) {
                statusText = "Local call not found"
                return
            }
            val updated = existing.copy(user_action = action)
            if (currentSession?.call_sid == callSid) currentSession = updated
            saveLocalSession(updated)
            statusText = "Local action set: $action"
            return
        }
        runApi("Setting $action...") {
            val response = api.setAction(callSid, SimActionRequest(action))
            val refreshed = api.listCalls()
            calls.clear()
            calls.addAll(refreshed.items)
            if (!response.ok) {
                statusText = response.error ?: "Action failed"
            } else {
                statusText = "Action set: $action"
            }
        }
    }

    suspend fun startCallVoiceLab(): SimStartResponse {
        if (backendMode == BackendMode.OFFLINE_ONLY) {
            return startLocalSession()
        }
        if (backendMode == BackendMode.OFFLINE_FIRST) {
            return try {
                val response = api.startCall(SimStartRequest(from_number = fromNumber, to_number = toNumber))
                currentSession = response.session
                val refreshed = api.listCalls()
                calls.clear()
                calls.addAll(refreshed.items)
                statusText = "Started ${response.call_sid} (server)"
                response
            } catch (_: Exception) {
                startLocalSession()
            }
        }
        val response = api.startCall(SimStartRequest(from_number = fromNumber, to_number = toNumber))
        currentSession = response.session
        val refreshed = api.listCalls()
        calls.clear()
        calls.addAll(refreshed.items)
        statusText = "Started ${response.call_sid} (server)"
        return response
    }

    suspend fun sendTurnVoiceLab(callerVoiceText: String): SimTurnResponse {
        val session = currentSession ?: error("No active session")
        val text = callerVoiceText.trim()
        val inference = mobileLlm.inferTurn(text, session.details, session.transcript)
        lastAssistantLanguage = inference.responseLanguage

        if (backendMode == BackendMode.OFFLINE_ONLY) {
            val local = applyLocalTurn(session, text, inference)
            currentSession = local.session
            statusText = if (local.should_end) "Offline local call ended" else "Offline local reply"
            return local
        }

        if (mobileLlmMode == MobileLlmMode.LOCAL_ONLY || (mobileLlmMode == MobileLlmMode.HYBRID && inference.shouldSkipServer)) {
            val local = applyLocalTurn(session, text, inference)
            currentSession = local.session
            statusText = if (local.should_end) "Local mobile LLM ended call" else "Local mobile LLM replied"
            return local
        }

        val payload =
            if (mobileLlmMode == MobileLlmMode.HYBRID) {
                buildHybridPayload(text, inference)
            } else {
                text
            }

        if (backendMode == BackendMode.OFFLINE_FIRST) {
            return try {
                val response = api.sendTurn(SimTurnRequest(call_sid = session.call_sid, caller_text = payload))
                currentSession = response.session
                val refreshed = api.listCalls()
                calls.clear()
                calls.addAll(refreshed.items)
                statusText = if (response.should_end) "Call ended by assistant (server)" else "Assistant replied (server)"
                response
            } catch (_: Exception) {
                val local = applyLocalTurn(session, text, inference)
                currentSession = local.session
                statusText = if (local.should_end) "Server unavailable, local ended call" else "Server unavailable, local replied"
                local
            }
        }

        val response = api.sendTurn(SimTurnRequest(call_sid = session.call_sid, caller_text = payload))
        currentSession = response.session
        val refreshed = api.listCalls()
        calls.clear()
        calls.addAll(refreshed.items)
        statusText = if (response.should_end) "Call ended by assistant (server)" else "Assistant replied (server)"
        return response
    }

    private fun runApi(progress: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            statusText = progress
            try {
                block()
            } catch (e: Exception) {
                statusText = "Error: ${e.message}"
            }
        }
    }

    private fun buildHybridPayload(originalText: String, inference: MobileTurnInference): String {
        val details = inference.details
        val hints = mutableListOf<String>()
        hints += "lang=${inference.responseLanguage}"
        if (!details.caller_name.isNullOrBlank()) hints += "name=${details.caller_name}"
        if (!details.company.isNullOrBlank()) hints += "company=${details.company}"
        if (!details.subject.isNullOrBlank()) hints += "subject=${details.subject}"
        if (!details.urgency.isNullOrBlank()) hints += "urgency=${details.urgency}"
        if (!details.callback_number.isNullOrBlank()) hints += "callback=${details.callback_number}"
        if (hints.isEmpty()) return originalText
        return "MOBILE_HINT{${hints.joinToString(";")}} $originalText"
    }

    private fun applyLocalTurn(
        session: SimCallSession,
        callerText: String,
        inference: MobileTurnInference,
    ): SimTurnResponse {
        val assistantReply = inference.suggestedReply ?: "Thank you. I am noting this and will pass it along."
        val updatedTranscript = session.transcript + listOf(
            TranscriptTurn(speaker = "caller", text = callerText),
            TranscriptTurn(speaker = "assistant", text = assistantReply),
        )
        val summary = buildLocalSummary(inference.details)
        val updatedSession = session.copy(
            details = inference.details,
            transcript = updatedTranscript,
            summary = summary,
            status = if (inference.shouldEnd) "completed" else session.status,
        )
        saveLocalSession(updatedSession)
        return SimTurnResponse(
            assistant_reply = assistantReply,
            should_end = inference.shouldEnd,
            session = updatedSession,
        )
    }

    private fun buildLocalSummary(details: ExtractedDetails): String {
        val name = details.caller_name ?: "unknown caller"
        val company = details.company ?: "unknown company"
        val subject = details.subject ?: "no subject yet"
        val urgency = details.urgency ?: "unknown urgency"
        val callback = details.callback_number ?: "no callback number"
        return "Local mobile summary: $name from $company regarding $subject (urgency: $urgency, callback: $callback)."
    }

    suspend fun prepareSpeech(text: String): SpeechOutput {
        val output = voiceRouter.render(text = text, language = lastAssistantLanguage, mode = voiceEngineMode)
        if (output.engineUsed.contains("fallback") || output.engineUsed.contains("unconfigured") || output.engineUsed.contains("pending")) {
            statusText = "Local voice fallback (${output.engineUsed}) • ${voiceRouter.diagnosticStatus()}"
        } else {
            statusText = "Local voice: ${output.engineUsed} • ${voiceRouter.diagnosticStatus()}"
        }
        return output
    }

    private suspend fun startLocalSession(): SimStartResponse {
        val localSid = "LOCAL-${System.currentTimeMillis().toString(16)}"
        val greeting = "Hi, you've reached Alex's assistant. May I know who's calling and what this is regarding?"
        val session = SimCallSession(
            call_sid = localSid,
            from_number = fromNumber,
            to_number = toNumber,
            status = "active",
            transcript = listOf(TranscriptTurn(speaker = "assistant", text = greeting)),
        )
        currentSession = session
        calls.removeAll { it.call_sid == session.call_sid }
        calls.add(0, session)
        saveLocalSession(session)
        statusText = "Started ${session.call_sid} (offline)"
        lastAssistantLanguage = "en"
        return SimStartResponse(call_sid = session.call_sid, assistant_reply = greeting, session = session)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val vm: SimViewModel = viewModel()
            MaterialTheme(colorScheme = appColorScheme(vm.appThemeStyle)) {
                SimScreen(vm)
            }
        }
    }
}

private fun appColorScheme(style: AppThemeStyle) =
    when (style) {
        AppThemeStyle.MINIMAL_CALM -> lightColorScheme(
            primary = Color(0xFF2D6CDF),
            secondary = Color(0xFF5F84CC),
            background = Color(0xFFF5F7FB),
            surface = Color(0xFFFFFFFF),
        )
        AppThemeStyle.NEON_COMMAND -> darkColorScheme(
            primary = Color(0xFF9EFF2E),
            secondary = Color(0xFF6EE7B7),
            background = Color(0xFF101312),
            surface = Color(0xFF1B201E),
        )
        AppThemeStyle.TRUST_FINANCE -> lightColorScheme(
            primary = Color(0xFF0F4C81),
            secondary = Color(0xFF1A7A8C),
            background = Color(0xFFF2F6FB),
            surface = Color(0xFFFFFFFF),
        )
    }

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun SimScreen(vm: SimViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val wavPlayer = remember { WavPlayer(context) }
    val interruptibleAudioPlayer = remember { InterruptibleAudioPlayer() }
    var ttsReady by remember { mutableStateOf(false) }
    var lastHeardText by remember { mutableStateOf("") }
    var showSettingsPage by remember { mutableStateOf(false) }
    val textToSpeech = remember {
        TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
        }
    }
    fun applyAssistantVoiceProfile() {
        textToSpeech.language = Locale("en", "IN")
        when (vm.assistantVoiceProfile) {
            AssistantVoiceProfile.FEMALE_CLEAR -> {
                textToSpeech.setPitch(1.12f)
                textToSpeech.setSpeechRate(1.00f)
            }
            AssistantVoiceProfile.FEMALE_WARM -> {
                textToSpeech.setPitch(1.06f)
                textToSpeech.setSpeechRate(0.94f)
            }
            AssistantVoiceProfile.MALE_CLEAR -> {
                textToSpeech.setPitch(0.92f)
                textToSpeech.setSpeechRate(1.00f)
            }
            AssistantVoiceProfile.MALE_DEEP -> {
                textToSpeech.setPitch(0.84f)
                textToSpeech.setSpeechRate(0.90f)
            }
        }
    }
    fun previewVoice(profile: AssistantVoiceProfile) {
        if (!ttsReady) return
        vm.selectAssistantVoiceProfile(profile)
        applyAssistantVoiceProfile()
        textToSpeech.speak(
            "Hello, I am your call assistant. I will screen unknown calls and share a summary.",
            TextToSpeech.QUEUE_FLUSH,
            null,
            "voice-preview-${profile.name}",
        )
    }
    DisposableEffect(Unit) {
        onDispose {
            interruptibleAudioPlayer.shutdown()
            wavPlayer.stop()
            textToSpeech.stop()
            textToSpeech.shutdown()
        }
    }

    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val data = result.data
        val heard = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
        if (heard.isBlank()) return@rememberLauncherForActivityResult
        lastHeardText = heard
        scope.launch {
            try {
                val turn = vm.sendTurnVoiceLab(heard)
                val speech = vm.prepareSpeech(turn.assistant_reply)
                if (speech.wavChunks != null || speech.wavBytes != null) {
                    interruptibleAudioPlayer.play(speech)
                } else if (ttsReady) {
                    applyAssistantVoiceProfile()
                    textToSpeech.speak(speech.text, TextToSpeech.QUEUE_FLUSH, null, "assistant-reply")
                }
            } catch (e: Exception) {
                vm.statusText = "Voice turn failed: ${e.message}"
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedButton(onClick = { showSettingsPage = !showSettingsPage }, modifier = Modifier.testTag("hamburger_menu_button")) {
                    Text("≡ Menu")
                }
                Text(if (showSettingsPage) "Settings" else "Call Assistant", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
        }

        if (showSettingsPage) {
            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionTitle("Settings", "Preferences")
                        Text("Theme", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = vm.appThemeStyle == AppThemeStyle.MINIMAL_CALM, onClick = { vm.setThemeStyle(AppThemeStyle.MINIMAL_CALM) }, label = { Text("Minimal Calm") })
                            FilterChip(selected = vm.appThemeStyle == AppThemeStyle.NEON_COMMAND, onClick = { vm.setThemeStyle(AppThemeStyle.NEON_COMMAND) }, label = { Text("Neon Command") })
                            FilterChip(selected = vm.appThemeStyle == AppThemeStyle.TRUST_FINANCE, onClick = { vm.setThemeStyle(AppThemeStyle.TRUST_FINANCE) }, label = { Text("Trust Finance") })
                        }
                        Text("Assistant Voice", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = vm.assistantVoiceProfile == AssistantVoiceProfile.FEMALE_CLEAR, onClick = { vm.selectAssistantVoiceProfile(AssistantVoiceProfile.FEMALE_CLEAR) }, label = { Text("Female Clear") })
                            FilterChip(selected = vm.assistantVoiceProfile == AssistantVoiceProfile.FEMALE_WARM, onClick = { vm.selectAssistantVoiceProfile(AssistantVoiceProfile.FEMALE_WARM) }, label = { Text("Female Warm") })
                            FilterChip(selected = vm.assistantVoiceProfile == AssistantVoiceProfile.MALE_CLEAR, onClick = { vm.selectAssistantVoiceProfile(AssistantVoiceProfile.MALE_CLEAR) }, label = { Text("Male Clear") })
                            FilterChip(selected = vm.assistantVoiceProfile == AssistantVoiceProfile.MALE_DEEP, onClick = { vm.selectAssistantVoiceProfile(AssistantVoiceProfile.MALE_DEEP) }, label = { Text("Male Deep") })
                        }
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { previewVoice(AssistantVoiceProfile.FEMALE_CLEAR) }, modifier = Modifier.testTag("preview_voice_female_clear")) { Text("Preview Female Clear") }
                            OutlinedButton(onClick = { previewVoice(AssistantVoiceProfile.FEMALE_WARM) }, modifier = Modifier.testTag("preview_voice_female_warm")) { Text("Preview Female Warm") }
                            OutlinedButton(onClick = { previewVoice(AssistantVoiceProfile.MALE_CLEAR) }, modifier = Modifier.testTag("preview_voice_male_clear")) { Text("Preview Male Clear") }
                            OutlinedButton(onClick = { previewVoice(AssistantVoiceProfile.MALE_DEEP) }, modifier = Modifier.testTag("preview_voice_male_deep")) { Text("Preview Male Deep") }
                        }
                    }
                }
            }
            return@LazyColumn
        }

        val session = vm.currentSession
        item {
            AssistantOnCompactCard(
                enabled = true,
                onToggle = { },
            )
        }
        item {
            ActiveCallCompactCard(
                session = session,
                onAllow = { session?.let { vm.setAction(it.call_sid, "allow") } },
                onBlock = { session?.let { vm.setAction(it.call_sid, "block") } },
                onCallback = { session?.let { vm.setAction(it.call_sid, "callback") } },
                onStart = { vm.startCall() },
            )
        }
        item {
            ConversationsCompactCard(calls = vm.calls, onOpen = { vm.currentSession = it })
        }

        if (session != null) {
            item { CurrentCallCard(session = session, callerText = vm.callerText, onCallerTextChange = { vm.callerText = it }, onSend = { vm.sendTurn() }, onAction = { action -> vm.setAction(session.call_sid, action) }) }
        } else {
            item { EmptyCallCard() }
        }

        item {
            VoiceLabCard(
                lastHeardText = lastHeardText,
                onStart = {
                    scope.launch {
                        try {
                            val start = vm.startCallVoiceLab()
                            val speech = vm.prepareSpeech(start.assistant_reply)
                            if (speech.wavChunks != null || speech.wavBytes != null) {
                                interruptibleAudioPlayer.play(speech)
                            } else if (ttsReady) {
                                applyAssistantVoiceProfile()
                                textToSpeech.speak(speech.text, TextToSpeech.QUEUE_FLUSH, null, "assistant-greeting")
                            }
                        } catch (e: Exception) {
                            vm.statusText = "Voice Lab start failed: ${e.message}"
                        }
                    }
                },
                onListen = {
                    interruptibleAudioPlayer.stop()
                    textToSpeech.stop()
                    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak as the caller")
                        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    }
                    speechLauncher.launch(intent)
                },
            )
        }

        if (session != null) {
            item {
                CallIntelligenceCard(session)
            }
            item {
                CapturedDetailsCard(session)
            }
            item {
                Text("Transcript", fontWeight = FontWeight.SemiBold)
            }
            items(session.transcript) { turn ->
                TranscriptBubble(turn)
            }
        }
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text("Conversations", fontWeight = FontWeight.SemiBold)
        }
        items(vm.calls) { call ->
            RecentCallCard(
                call = call,
                onOpen = { vm.currentSession = call },
                onAction = { action -> vm.setAction(call.call_sid, action) },
            )
        }
        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
        item {
            BottomNavPlaceholder()
        }
    }
    LaunchedEffect(Unit) {
        vm.attachStore(context.applicationContext)
        vm.refreshCalls()
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun CallIntelligenceCard(session: SimCallSession) {
    val risk = session.riskLabel()
    val action = session.user_action ?: session.suggestedAction()
    val missing = session.missingFields()
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFF7FAFC)),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle("Call intelligence", "Local")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill("Action", action.uppercase(), Color(0xFFE8F3FF))
                InfoPill("Risk", risk.label, risk.color)
                InfoPill("Turns", session.transcript.size.toString(), Color(0xFFF0EDFF))
                InfoPill("Storage", "ON DEVICE", Color(0xFFEAF7F0))
            }
            Text(
                session.summary ?: "Assistant is waiting for caller identity, reason, urgency, and callback number.",
                style = MaterialTheme.typography.bodySmall,
            )
            if (missing.isNotEmpty()) {
                Text(
                    "Still needed: ${missing.joinToString(", ")}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun InfoPill(label: String, value: String, color: Color) {
    Surface(shape = MaterialTheme.shapes.medium, color = color) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun HeaderCard(statusText: String, totalCalls: Int, activeCall: SimCallSession?) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = Color(0xFF0D3B2E),
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF6EE7B7)),
                )
                Text("Call Assistant", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White)
                Surface(shape = CircleShape, color = Color(0xFF9EFF2E)) {
                    Text(
                        "ON",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF052116),
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Text("Private, on-device call screening for India-first workflows", style = MaterialTheme.typography.bodyMedium, color = Color(0xFFD7F7E7))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DashboardMetric("Calls", totalCalls.toString())
                DashboardMetric("Active", if (activeCall?.status == "active") "1" else "0")
                DashboardMetric("Mode", "Local")
            }
            Text(statusText, style = MaterialTheme.typography.bodySmall, color = Color(0xFFD7F7E7), modifier = Modifier.testTag("status_text"))
        }
    }
}

@Composable
private fun AssistantOnCompactCard(enabled: Boolean, onToggle: () -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                )
                Column {
                    Text("Assistant On", fontWeight = FontWeight.SemiBold)
                    Text("Smart screening active", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            FilterChip(selected = enabled, onClick = onToggle, label = { Text(if (enabled) "On" else "Off") }, border = null)
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun ActiveCallCompactCard(
    session: SimCallSession?,
    onAllow: () -> Unit,
    onBlock: () -> Unit,
    onCallback: () -> Unit,
    onStart: () -> Unit,
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Active Call", fontWeight = FontWeight.SemiBold)
                Text(if (session == null) "00:00" else "00:38", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
            Text(session?.from_number ?: "Unknown number", fontWeight = FontWeight.SemiBold)
            Text(if (session == null) "No active call. Tap Start screening." else "Listening to caller...", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("···▁▂▃▅▃▂▁···", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onAllow) { Text("Allow") }
                OutlinedButton(onClick = onBlock) { Text("Block") }
                OutlinedButton(onClick = onCallback) { Text("Callback") }
                Button(onClick = onStart, modifier = Modifier.testTag("start_call_button")) { Text("Start") }
            }
        }
    }
}

@Composable
private fun ConversationsCompactCard(calls: List<SimCallSession>, onOpen: (SimCallSession) -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Conversations", fontWeight = FontWeight.SemiBold)
                Text("View all", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            calls.take(4).forEach { call ->
                OutlinedButton(onClick = { onOpen(call) }, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(call.details.caller_name ?: call.from_number ?: "Unknown", fontWeight = FontWeight.SemiBold)
                            Text("Yesterday", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(call.summary ?: "Call note", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun BottomNavPlaceholder() {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Home", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            Text("Chats", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Assistant", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Settings", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DashboardMetric(label: String, value: String) {
    Surface(shape = MaterialTheme.shapes.medium, color = Color(0xFF155843)) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFFBDEFD7))
            Text(value, style = MaterialTheme.typography.titleMedium, color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun LocalFirstBanner() {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFAEB)),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionTitle("Local-first MVP", "No cloud required")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill("Storage", "APP DB", Color(0xFFEAF7F0))
                InfoPill("AI", "ON DEVICE", Color(0xFFE8F3FF))
                InfoPill("Voice", "OMNIVOICE TARGET", Color(0xFFF0EDFF))
            }
            Text(
                "Calls, transcript, summary, action, and configuration stay inside this app for the MVP.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SectionTitle(title: String, label: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun VoiceLabCard(lastHeardText: String, onStart: () -> Unit, onListen: () -> Unit) {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionTitle("Voice lab", "Live test")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onStart, modifier = Modifier.testTag("voice_lab_start_button")) { Text("Start Voice") }
                OutlinedButton(onClick = onListen, modifier = Modifier.testTag("voice_lab_listen_button")) { Text("Listen") }
            }
            if (lastHeardText.isNotBlank()) {
                Text(
                    "Heard: $lastHeardText",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.testTag("voice_heard_text"),
                )
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun CurrentCallCard(
    session: SimCallSession,
    callerText: String,
    onCallerTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onAction: (String) -> Unit,
) {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionTitle("Active screening", session.status.uppercase())
            Text(
                "Current Call: ${session.call_sid}",
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.testTag("current_call_text"),
            )
            Text("${session.from_number ?: "Unknown"} -> ${session.to_number ?: "Assistant"}", style = MaterialTheme.typography.bodySmall)
            Text(
                session.summary ?: "Waiting for caller details.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("summary_text"),
            )
            OutlinedTextField(
                value = callerText,
                onValueChange = onCallerTextChange,
                label = { Text("Caller says...") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth().testTag("caller_text_input"),
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onSend, modifier = Modifier.testTag("send_turn_button")) { Text("Send") }
                OutlinedButton(onClick = { onAction("allow") }) { Text("Allow") }
                OutlinedButton(onClick = { onAction("block") }) { Text("Block") }
                OutlinedButton(onClick = { onAction("callback") }) { Text("Callback") }
            }
        }
    }
}

@Composable
private fun CapturedDetailsCard(session: SimCallSession) {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionTitle("Captured details", session.user_action ?: "No action")
            DetailRow("Name", session.details.caller_name)
            DetailRow("Company", session.details.company)
            DetailRow("Subject", session.details.subject)
            DetailRow("Urgency", session.details.urgency)
            DetailRow("Callback", session.details.callback_number)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String?) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value ?: "-", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun TranscriptBubble(turn: TranscriptTurn) {
    val isAssistant = turn.speaker.equals("assistant", ignoreCase = true)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isAssistant) Arrangement.End else Arrangement.Start,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(0.86f).padding(vertical = 3.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isAssistant) Color(0xFFE6F0FF) else Color(0xFFF4F1EA),
            ),
        ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(turn.speaker.uppercase(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                Text(turn.text, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun EmptyCallCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("No active call yet.", fontWeight = FontWeight.SemiBold)
            Text("Start a simulated call or use Voice Lab to test on a real phone.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun RecentCallCard(call: SimCallSession, onOpen: () -> Unit, onAction: (String) -> Unit) {
    val risk = call.riskLabel()
    val action = call.user_action ?: call.suggestedAction()
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(call.from_number ?: call.call_sid, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text(call.status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill("Risk", risk.label, risk.color)
                InfoPill("Action", action.uppercase(), Color(0xFFE8F3FF))
                InfoPill("Caller", call.details.caller_name ?: "UNKNOWN", Color(0xFFF2F4F7))
            }
            Text(call.summary ?: "No summary yet", style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpen) { Text("Open") }
                OutlinedButton(onClick = { onAction("allow") }) { Text("Allow") }
                OutlinedButton(onClick = { onAction("block") }) { Text("Block") }
                OutlinedButton(onClick = { onAction("callback") }) { Text("Callback") }
            }
        }
    }
}

private fun String.prettyMode(): String = replace("_", " ").lowercase().replaceFirstChar { it.titlecase() }

private data class RiskLabel(val label: String, val color: Color) {
    override fun toString(): String = label
}

private fun SimCallSession.riskLabel(): RiskLabel {
    val joined = transcript.joinToString(" ") { it.text }.lowercase()
    return when {
        user_action == "block" || "loan" in joined || "offer" in joined || "verification" in joined ->
            RiskLabel("WATCH", Color(0xFFFFF3D8))
        details.urgency?.contains("urgent", ignoreCase = true) == true ->
            RiskLabel("URGENT", Color(0xFFFFE6E6))
        details.caller_name != null && details.callback_number != null ->
            RiskLabel("CLEAR", Color(0xFFEAF7F0))
        else -> RiskLabel("UNKNOWN", Color(0xFFF2F4F7))
    }
}

private fun SimCallSession.suggestedAction(): String {
    val risk = riskLabel().label
    return when {
        user_action != null -> user_action
        risk == "WATCH" -> "block"
        details.callback_number != null -> "callback"
        else -> "review"
    }
}

private fun SimCallSession.missingFields(): List<String> {
    return buildList {
        if (details.caller_name.isNullOrBlank()) add("name")
        if (details.company.isNullOrBlank()) add("company")
        if (details.subject.isNullOrBlank()) add("subject")
        if (details.urgency.isNullOrBlank()) add("urgency")
        if (details.callback_number.isNullOrBlank()) add("callback")
    }
}
