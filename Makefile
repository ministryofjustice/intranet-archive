default: launch

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

launch:
	@bin/launch.sh
	@echo "\n Intranet archive available here: http://app.archive.intranet.docker/status\n"
	@docker compose logs -f spider

# Get inside the spider container
bash:
	docker compose exec spider /bin/ash

# Production environment for testing the production builds locally
build-prod: 
	docker compose -f docker-compose.prod.yml build

up-prod:
	docker compose -f docker-compose.prod.yml up

# Generate the shared secret used by the intranet for signing `/access` requests.
key-gen-shared-secret:
	@openssl rand -base64 64 | tr -d '\n' | pbcopy
	@echo "Shared secret copied to clipboard - either:"
	@echo "A - Paste it into .env"
	@echo "    Once for the intranet project and once for the intranet-archive project"
	@echo "B - Paste it into GitHub secrets"
	@echo "    Once for the intranet project and once for the intranet-archive project"
	@echo "    and repeat this command for each environment"
	@echo "Use the name INTRANET_ARCHIVE_SHARED_SECRET"

# The following key-gen-* commands are for CloudFront RSA key generation/management.
key-gen-private:
	@openssl genrsa -out /tmp/private_key.pem 2048 && pbcopy < /tmp/private_key.pem
	@echo "Private key copied to clipboard - either:"
	@echo "A - Paste it into .env"
	@echo "    Use the name AWS_CLOUDFRONT_PRIVATE_KEY"
	@echo "B - Paste it into GitHub secrets"
	@echo "    Use the name AWS_CLOUDFRONT_PRIVATE_KEY_A or AWS_CLOUDFRONT_PRIVATE_KEY_B"
	@echo "C - Paste it into GitHub secrets"
	@echo "    Use the name TEST_AWS_CLOUDFRONT_PRIVATE_KEY"
	@echo "Then run 'make key-gen-public'"

key-gen-public:
	@openssl rsa -in /tmp/private_key.pem -pubout -out /tmp/public_key.pem && pbcopy < /tmp/public_key.pem
	@echo "Public key copied to clipboard - either:"
	@echo "A - Paste it into .env"
	@echo "    Use the name AWS_CLOUDFRONT_PUBLIC_KEY"
	@echo "    Next run 'make key-gen-object'"
	@echo "B - Paste it into GitHub secrets"
	@echo "    Use the name AWS_CLOUDFRONT_PUBLIC_KEY_A or AWS_CLOUDFRONT_PUBLIC_KEY_B"
	@echo "C - Paste it into GitHub secrets"
	@echo "    Use the name TEST_AWS_CLOUDFRONT_PUBLIC_KEY"
	@echo "Optionally run 'make key-gen-object' if you are populating .env or TEST_ secrets in GitHub actions"
	@echo "Then run 'make key-gen-clean'"

key-gen-object:
	@echo "[{\"id\":\"GENERATED_BY_AWS\",\"comment\":\"$(shell cat /tmp/public_key.pem | openssl dgst -binary -sha256 | xxd -p -c 32 | cut -c 1-8)\"}]" | pbcopy
	@echo "Public keys object copied to clipboard - either: paste it into GitHub secrets"
	@echo "A - Paste it into .env"
	@echo "    Use the name AWS_CLOUDFRONT_PUBLIC_KEYS_OBJECT"
	@echo "C - Paste it into GitHub secrets"
	@echo "    Use the name TEST_AWS_CLOUDFRONT_PUBLIC_KEYS_OBJECT - This is only used for testing"
	@echo "Finally run 'make key-gen-clean'"

key-gen-clean:
	@rm /tmp/private_key.pem /tmp/public_key.pem && echo "" | pbcopy
	@echo "Keys removed from /tmp"
