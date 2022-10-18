# MoJ Intranet Archive

```diff
- WIP; a simple application for generating snapshots of the MoJ Intranet 
```

The initial idea for this project is this is a scraping process, and the process fires up when needed, takes a snapshot of intranet, stores the result in an S3 bucket and then closes down, until next time.

## Requires

- Docker
- Dory (nice to have, really :)

## Installation

Clone to your machine:

```
git clone https://github.com/ministryofjustice/intranet-archive.git
```

Start docker compose:

```
make run
```
There is a helper script will guide you through an installation of the Dory Proxy, if you'd like to. 

If you have installed Dory, access the application here:

```
http://spider.intranet.docker
```

Otherwise, you can access the applicaiton here:

```
http://localhost:8080/
```
