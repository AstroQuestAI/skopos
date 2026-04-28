#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
OUT_DIR="${OUT_DIR:-${ROOT}/artifacts/voice_eval}"
mkdir -p "${OUT_DIR}"

PROMPTS="${OUT_DIR}/ab_prompts.txt"
SCORECARD="${OUT_DIR}/ab_scorecard.csv"
NOTES="${OUT_DIR}/ab_notes.md"

cat > "${PROMPTS}" <<'EOF'
1. Hello, this is Alex assistant. May I know who is calling?
2. నమస్తే, దయచేసి మీ పేరు చెప్పండి.
3. नमस्ते, कृपया अपना नाम बताइए।
4. Please share your callback number slowly.
5. మీ కాల్ అత్యవసరమా లేక సాధారణమా?
6. क्या यह कॉल बहुत जरूरी है या सामान्य?
7. Thanks, I will pass this along.
8. ధన్యవాదాలు, నేను వివరాలు పంపిస్తాను.
9. धन्यवाद, मैं ये जानकारी आगे भेज दूँगा।
10. Please repeat the company name once again.
EOF

cat > "${SCORECARD}" <<'EOF'
prompt_id,prompt_text,engine_a_name,engine_b_name,naturalness_a_1_5,naturalness_b_1_5,pronunciation_a_1_5,pronunciation_b_1_5,similarity_to_target_a_1_5,similarity_to_target_b_1_5,winner_a_or_b,notes
EOF

cat > "${NOTES}" <<EOF
# Voice A/B Evaluation Notes

Use with:
- Engine A: current production voice
- Engine B: adapted voice

Prompt set: ${PROMPTS}
Scorecard: ${SCORECARD}

Scoring guide:
- Naturalness: 1 (robotic) -> 5 (human-like)
- Pronunciation: 1 (frequent errors) -> 5 (clean)
- Similarity: 1 (not your voice) -> 5 (very close)

Recommendation:
Run at least 10 prompts x 3 repetitions before choosing winner.
EOF

echo "[voice-eval] Prompt file: ${PROMPTS}"
echo "[voice-eval] Scorecard: ${SCORECARD}"
echo "[voice-eval] Notes: ${NOTES}"
