.PNONEY: run

# Start the application
run: dory
	docker compose up

# Bring docker compose down
down:
	docker compose down

# Start the Dory Proxy
dory:
	@chmod +x ./bin/dory-check.sh && ./bin/dory-check.sh

# Get inside the spider container
shell:
	docker compose exec spider /bin/sh
