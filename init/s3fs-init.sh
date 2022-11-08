#!/bin/sh

echo_c() {
  case "$2" in
  "grey") COLOUR='\033[3;90m' ;;
  "green") COLOUR='\033[0;32m' ;;
  "yellow") COLOUR='\033[0;93m' ;;
  esac
  printf "$COLOUR$1\033[0m"
}

repeat(){
	for i in $(seq "$2"); do printf "%s" "$1"; done
}

DIV="\n$(repeat '-' 31)\n"

echo_c "$DIV" grey
echo_c " AWS S3 Synchronisation Config" green
echo_c "$DIV\n" grey

echo_c " Granting S3FS access to S3 bucket '${S3_BUCKET_NAME}'...\n" yellow
echo "${S3_ACCESS_KEY_ID}":"${S3_SECRET_ACCESS_KEY}" >~/.passwd-s3fs
echo_c " Done.\n\n" green

chmod 600 ~/.passwd-s3fs

echo_c " Starting S3FS...\n" yellow
s3fs "${S3_BUCKET_NAME}" ~/websites -o passwd_file=/root/.passwd-s3fs -o nonempty
echo_c " Done.\n" green

echo_c "$DIV" grey
