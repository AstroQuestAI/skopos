package com.example.callassistantsim

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class MainActivityUiTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    private fun ensureHomePage() {
        val settingsTitleVisible = composeRule.onAllNodesWithText("Settings").fetchSemanticsNodes().isNotEmpty()
        if (settingsTitleVisible) {
            composeRule.onNodeWithTag("hamburger_menu_button").performClick()
        }
    }

    @Test
    fun initialScreenElements_areVisible() {
        ensureHomePage()
        composeRule.onNodeWithText("Call Assistant").assertIsDisplayed()
        composeRule.onNodeWithTag("from_number_input").assertIsDisplayed()
        composeRule.onNodeWithTag("to_number_input").assertIsDisplayed()
        composeRule.onNodeWithTag("start_call_button").assertIsDisplayed()
        composeRule.onNodeWithTag("end_call_button").assertIsDisplayed()
        composeRule.onNodeWithTag("refresh_button").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun inputs_areEditable() {
        ensureHomePage()
        composeRule.onNodeWithTag("from_number_input").performTextClearance()
        composeRule.onNodeWithTag("from_number_input").performTextInput("+919111111111")
        composeRule.onNodeWithTag("to_number_input").performTextClearance()
        composeRule.onNodeWithTag("to_number_input").performTextInput("+912222222222")

        composeRule.onNodeWithText("+919111111111").assertIsDisplayed()
        composeRule.onNodeWithText("+912222222222").assertIsDisplayed()
    }

    @Test
    fun e2e_simulatedCallFlow_backendIntegration() {
        ensureHomePage()
        composeRule.onNodeWithTag("demo_mode_toggle_button").performScrollTo().performClick()
        composeRule.onNodeWithTag("run_demo_button").performScrollTo().performClick()

        composeRule.waitUntil(timeoutMillis = 20_000) {
            composeRule.onAllNodes(hasText("Demo script completed", substring = true))
                .fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithTag("status_text").assertTextContains("Demo script completed", substring = true)
    }

    @Test
    fun settingsMenu_themeAndVoicePreviewControls_areResponsive() {
        ensureHomePage()
        composeRule.onNodeWithTag("hamburger_menu_button").assertIsDisplayed().performClick()
        composeRule.onAllNodesWithText("Settings")[0].assertIsDisplayed()

        composeRule.onNodeWithText("Theme").assertIsDisplayed()
        composeRule.onNodeWithText("Minimal Calm").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Neon Command").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Trust Finance").assertIsDisplayed().performClick()

        composeRule.onNodeWithText("Assistant Voice").assertIsDisplayed()
        composeRule.onNodeWithText("Female Clear").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Male Deep").assertIsDisplayed().performClick()

        composeRule.onNodeWithTag("preview_voice_female_clear").performScrollTo().assertIsDisplayed().performClick()
        composeRule.onNodeWithTag("preview_voice_female_warm").performScrollTo().assertIsDisplayed().performClick()
        composeRule.onNodeWithTag("preview_voice_male_clear").performScrollTo().assertIsDisplayed().performClick()
        composeRule.onNodeWithTag("preview_voice_male_deep").performScrollTo().assertIsDisplayed().performClick()
    }
}
