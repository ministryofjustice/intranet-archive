.PNONEY: run

# Start the application
run: env dory
	docker compose up

env:
	if [[ ! -f ".env" ]]; then cp .env.example .env; fi

# Bring docker compose down
down:
	docker compose down

# Start the Dory Proxy
dory:
	@chmod +x ./bin/dory-check.sh && ./bin/dory-check.sh

# Get inside the spider container
shell:
	docker compose exec spider /bin/sh
