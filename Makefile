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

sync:
	@docker compose exec spider s3sync

launch:
	@bin/launch.sh
	@echo "\n Intranet spider available here: http://spider.intranet.docker/\n"
	@docker compose logs -f spider

image: Dockerfile Makefile build
	docker build -t $(IMAGE) .

# Get inside the spider container
shell:
	docker compose exec spider /bin/bash

# The following key-gen-* commands are for CloudFront RSA key generation/management.
key-gen-private:
	@openssl genrsa -out /tmp/private_key.pem 2048 && pbcopy < /tmp/private_key.pem
	@echo "Private key copied to clipboard - paste it into GitHub secrets"
	@echo "Use the name AWS_CLOUDFRONT_PRIVATE_KEY_A or AWS_CLOUDFRONT_PRIVATE_KEY_B"
	@echo "Then run 'make key-gen-public'"

key-gen-public:
	@openssl rsa -in /tmp/private_key.pem -pubout -out /tmp/public_key.pem && pbcopy < /tmp/public_key.pem
	@echo "Public key copied to clipboard - paste it into GitHub secrets"
	@echo "Use the name AWS_CLOUDFRONT_PUBLIC_KEY_A or AWS_CLOUDFRONT_PUBLIC_KEY_B"
	@echo "Then run 'make key-gen-clean'"

key-gen-clean:
	@rm /tmp/private_key.pem /tmp/public_key.pem && echo "" | pbcopy
	@echo "Keys removed from /tmp"