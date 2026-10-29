COMPOSE = docker compose

all: tunnel ## Default: same as make tunnel

help: ## Show this help
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

# Build and start the app only, without the tunnel: reachable on this machine only.
up: .env ## Build and start the app only (localhost, no tunnel)
	$(COMPOSE) up -d --build
	@echo "Open https://localhost:8443"

# First run only: create .env from the example with random secrets.
# No sed -i (GNU and BSD/macOS disagree on it); written to a temp file and moved, so a failure
# (no openssl, say) leaves no half-made .env behind that the next make would keep.
.env:
	@pw=$$(openssl rand -hex 16) && jwt=$$(openssl rand -hex 32) && \
	sed -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$pw/" -e "s/^JWT_SECRET=.*/JWT_SECRET=$$jwt/" .env.example > .env.tmp && \
	mv .env.tmp .env
	@echo "Created .env with random secrets"

# The default: the app plus the public Cloudflare tunnel, so other devices can join (and scan the room QR code).
# cloudflared prints the URL before it connects, and the URL answers 530 until then,
# so this waits up to 30 s for the connection before printing it.
tunnel: .env ## Start the app and the public Cloudflare tunnel, and print its URL
	$(COMPOSE) --profile tunnel up -d --build
	@echo "This machine: https://localhost:8443"
	@for i in $$(seq 30); do $(COMPOSE) logs tunnel | grep -q 'Registered tunnel connection' && break; sleep 1; done; \
	$(COMPOSE) logs tunnel | grep -q 'Registered tunnel connection' || \
	echo "warning: the tunnel is not connected yet, so its URL may answer 530 (see: docker compose logs tunnel)" >&2
	@$(MAKE) --no-print-directory url

# End-to-end checks (sockets, secrets, a whole game) against the running app.
e2e: up ## Run end-to-end checks against the running app
	$(COMPOSE) --profile e2e run --rm e2e

# A quick tunnel's host always has dashes, so a failed request to api.trycloudflare.com isn't shown as the URL.
url: ## Print the Cloudflare tunnel URL
	@url=$$($(COMPOSE) logs tunnel | grep -oE 'https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com' | tail -1); \
	if [ -n "$$url" ]; then echo "$$url"; else echo "tunnel URL not found (see: docker compose logs tunnel)" >&2; exit 1; fi

down: ## Stop all containers
	$(COMPOSE) --profile tunnel --profile e2e down

logs: ## Follow the app logs
	$(COMPOSE) logs -f app

ps: ## List containers
	$(COMPOSE) ps

re: down all ## Restart (down, then make)

# Deletes the database and uploaded avatars.
fclean: ## Remove containers, database and uploaded avatars
	$(COMPOSE) --profile tunnel --profile e2e down -v --rmi local

.PHONY: all help up tunnel e2e url down logs ps re fclean
