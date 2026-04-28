DOCKER_COMPOSE ?= docker-compose
COMPOSE_FILES ?= -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_STAGING_FILES ?= -f docker-compose.staging.yml

.PHONY: up down restart logs ps test test-voice-sidecar up-staging down-staging logs-staging ps-staging test-staging test-voice-sidecar-staging omnivoice-prepare-data

up:
	$(DOCKER_COMPOSE) $(COMPOSE_FILES) up -d --build

down:
	$(DOCKER_COMPOSE) $(COMPOSE_FILES) down

restart: down up

logs:
	$(DOCKER_COMPOSE) $(COMPOSE_FILES) logs -f --tail=200

ps:
	$(DOCKER_COMPOSE) $(COMPOSE_FILES) ps

test:
	./scripts/docker-smoke-test.sh

test-voice-sidecar:
	./scripts/voice-sidecar-smoke-test.sh

up-staging:
	$(DOCKER_COMPOSE) $(COMPOSE_STAGING_FILES) up -d --build

down-staging:
	$(DOCKER_COMPOSE) $(COMPOSE_STAGING_FILES) down

logs-staging:
	$(DOCKER_COMPOSE) $(COMPOSE_STAGING_FILES) logs -f --tail=200

ps-staging:
	$(DOCKER_COMPOSE) $(COMPOSE_STAGING_FILES) ps

test-staging:
	API_URL=http://127.0.0.1:8020 ./scripts/docker-smoke-test.sh

test-voice-sidecar-staging:
	SIDECAR_URL=http://127.0.0.1:8091 ./scripts/voice-sidecar-smoke-test.sh

omnivoice-prepare-data:
	./scripts/prepare_omnivoice_finetune_data.sh
