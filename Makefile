default: launch

IMAGE := ministryofjustice/intranet-archive

# Start the application
run: env dory
	docker compose up

up_daemon: env dory
	docker compose up -d

env:
	@if [[ ! -f ".env" ]]; then cp .env.example .env; fi

# Bring docker compose down
down:
	docker compose down

# Start the Dory Proxy
dory:
	@chmod +x ./bin/dory-start.sh && ./bin/dory-start.sh

s3sync:
	@docker compose exec spider ./usr/sbin/s3fs-init.sh

launch: up_daemon s3sync
	@echo "\n Intranet spider available here: http://spider.intranet.docker/\n"
	@docker compose logs -f spider

image: Dockerfile Makefile
	docker build -t $(IMAGE) .
# Get inside the spider container
shell:
	docker compose exec spider /bin/sh
