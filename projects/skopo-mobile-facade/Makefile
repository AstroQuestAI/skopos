mobile-test:
	cd frontend && npm run test:mobile

mobile-test-fast:
	cd frontend && npm run test:mobile:no-install

emulator-test:
	cd frontend && npm run test:emulator

complete-ui-skin-tests:
	TEST_SUITE_NAME="Complete UI Skin Tests" VIDEO_ONLY=1 THEME_SWEEP=1 RECORD_SECONDS=60 $(MAKE) emulator-test

deploy-local-apk:
	~/Library/Android/sdk/platform-tools/adb install -r artifacts/deploy/skopo-green-gold-release.apk
	~/Library/Android/sdk/platform-tools/adb shell am start -n com.assistant.skopo/.MainActivity
