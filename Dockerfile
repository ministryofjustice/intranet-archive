FROM ministryofjustice/intranet-archive-base

## Most of the setup heavy lifting and configuration is present in the image above.
## Fine tune the application below.

ADD init /root

RUN mv root/s3fs-init.sh /usr/sbin/s3fs-init.sh && \
    chmod +x /usr/sbin/s3fs-init.sh


