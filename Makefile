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


launch:
	@bin/launch.sh
	@echo "\n Intranet spider available here: http://spider.intranet.docker/\n"
	@docker compose logs -f spider

image: Dockerfile Makefile build
	docker build -t $(IMAGE) .

# Get inside the spider container
bash:
	docker compose exec spider /bin/ash

# Production environment for testing the production builds locally
build-prod: 
	docker compose -f docker-compose.prod.yml build

up-prod:
	docker compose -f docker-compose.prod.yml up

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
	@echo "Optionally run 'make key-gen-object' if you are making a test object for GitHub actions"
	@echo "Then run 'make key-gen-clean'"

key-gen-object:
	@echo "[{\"id\":\"GENERATED_BY_AWS\",\"comment\":\"$(shell cat /tmp/public_key.pem | openssl dgst -binary -sha256 | xxd -p -c 32 | cut -c 1-8)\"}]" | pbcopy
	@echo "Public keys object copied to clipboard - paste it into GitHub secrets"
	@echo "This is only used for testing. Use the name TEST_AWS_CLOUDFRONT_PUBLIC_KEYS_OBJECT"
	@echo "Finally run 'make key-gen-clean'"

key-gen-clean:
	@rm /tmp/private_key.pem /tmp/public_key.pem && echo "" | pbcopy
	@echo "Keys removed from /tmp"