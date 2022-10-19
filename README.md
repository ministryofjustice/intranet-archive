# MoJ Intranet Archive

```diff
- WIP; a simple application for generating snapshots of the MoJ Intranet 
```

The initial idea for this project is this is a scraping process, and the process fires up when needed, takes a snapshot of intranet, stores the result in an S3 bucket and then closes down, until next time.

## Requires

- Docker
- Dory (nice to have, really :)
- [Intranet Archive Base](https://hub.docker.com/repository/docker/ministryofjustice/intranet-archive-base) 

## Installation

Clone to your machine:

```
git clone https://github.com/ministryofjustice/intranet-archive.git && cd intranet-archive
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

Otherwise, you can access the application here:

```
http://localhost:8080/
```

### Create a mirror of a website
A possible solution is to preconfigure website spider software to mirror the Intranet. Currently, we are using HTTrack (GUI) to achieve this. It would be advantageous to use the HTTrack CLI with preset values, in the interim, you can use the GUI to familiarise yourself with the functionality of HTTrack, this is how you do it.

#### HTTrack
Once you have accessed the local server running HTTrack (http://spider.intranet.docker) you can begin to configure your mirror operation.

**Docs**<br>
Please find more about configurations here: https://www.httrack.com/html/shelldoc.html

**Where has the website been copied to?**<br>
Once your mirror operation has completed, the site files will be available in a directory called ***spider***, off the root of this application. For example;

```
./intranet-archive/spider/
``` 
