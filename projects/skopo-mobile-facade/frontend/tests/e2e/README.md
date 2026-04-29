# AstroQuest E2E Test Bots

Playwright-based browser automation that exercises critical user flows
on the Expo web preview (the same bundle that ships as a PWA).

## Run

```bash
# from repo root
./run_tests.sh                 # runs backend + e2e together

# or just the bots
/opt/plugins-venv/bin/python frontend/tests/e2e/run_bots.py
```

## Override the target URL

```bash
FRONTEND_URL=http://localhost:3000 /opt/plugins-venv/bin/python frontend/tests/e2e/run_bots.py
FRONTEND_URL=https://design-vault-91.preview.emergentagent.com /opt/plugins-venv/bin/python frontend/tests/e2e/run_bots.py
```

## Bots

1. **pwa_install_ready**  — manifest + theme-color + iOS meta tags present.
2. **home_quickprompts_visible** — Vidhaata quick-prompt chips render.
3. **question_input_works** — chat input accepts text.
4. **auth_route_not_404** — regression guard for the Unmatched Route bug.
5. **backend_reachable_from_frontend** — home screen hydrates with images.

Each bot gets its own page + fresh context and runs in sequence. A failing
bot logs detail but doesn't stop the rest.
