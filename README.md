# <img alt="MoJ logo" src="https://www.gov.uk/assets/collections/govuk_publishing_components/crests/org_crest_18px-7026afebba9918a0830ebf68cf496cbb0b81f3514b884dc2c32904780baa3368.png" width="30">&nbsp; Intranet Archive

[![repo standards badge](https://img.shields.io/badge/dynamic/json?color=blue&style=for-the-badge&logo=github&label=MoJ%20Compliant&query=%24.result&url=https%3A%2F%2Foperations-engineering-reports.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fintranet-archive)](https://operations-engineering-reports.cloud-platform.service.justice.gov.uk/public-github-repositories.html#intranet-archive)


```diff
- WIP; a simple application for generating snapshots of the MoJ Intranet 
```

The initial idea for this project is; this application is a scraping process, and the process fires up when needed, takes a snapshot of intranet, stores the result in an S3 bucket and then closes down, until next time.

### Current state

A GUI is presented to configure scrape rules.

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

## HTTrack Options & Configuration

It will be necessary to set some options before copying a website. There are some configurations below to help with specific settings:

#### Scan Rules

```
-*justice.gov.uk/agency-switcher* -*agency=* -*wp-json/oembed* -*justice.gov.uk/?p=* +*.png +*.gif +*.jpg +*.jpeg +*.css +*.js -ad.doubleclick.net/*
```
#### Spider

The Intranet will jot allow access to crawlers via the robots.txt file. Because of this we need to let HTTrack know that we wish to ignore this particular file. Do this via the Spider option, set it to:
```
no robots.txt rules
```

#### Cookies

We can set cookies in HTTrack to help lock out specific agencies when archiving the site. An example of a cookies.txt file that is used to lock out HMCTS is below.

```
# HTTrack Website Copier Cookie File
# This file format is compatible with Netscape cookies
intranet.justice.gov.uk	TRUE	/	FALSE	1999999999	dw_agency	hmcts
```

