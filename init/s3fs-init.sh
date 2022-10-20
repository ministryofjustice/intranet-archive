#!/bin/sh

printf "Moving to create s3fs access to bucket...\n"
echo "${AWS_ACCESS_KEY}":"${AWS_SECRET_KEY}" > ~/.passwd-s3fs

printf "Done.\n"

chmod 600 ~/.passwd-s3fs

printf "Starting S3FS...\n"
s3fs "${AWS_S3_BUCKET}" ~/websites -o passwd_file=/root/.passwd-s3fs -o endpoint="eu-west-1" -o nonempty

printf "Done.\n"
