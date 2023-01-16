# <img alt="MoJ logo" src="https://www.gov.uk/assets/collections/govuk_publishing_components/crests/org_crest_18px-7026afebba9918a0830ebf68cf496cbb0b81f3514b884dc2c32904780baa3368.png" width="30">&nbsp; Intranet Archive

[![repo standards badge](https://img.shields.io/badge/dynamic/json?color=blue&style=for-the-badge&logo=github&label=MoJ%20Compliant&query=%24.result&url=https%3A%2F%2Foperations-engineering-reports.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fintranet-archive)](https://operations-engineering-reports.cloud-platform.service.justice.gov.uk/public-github-repositories.html#intranet-archive)

## Workflow

Archiving the Intranet, thankfully, is a task made simple using the following technologies:

1. Cloud Platform
2. AWS S3
3. AWS CloudFront
4. HTTrack Cli
5. NodeJS Server

## Viewing the latest snapshot

Access is granted to the snapshot if, you:

1) Have access to the Digital VPN (Nurved), or
2) Have your IP address validated and added to our allow-list, and
3) Are in possession of our basic-auth credentials

Access point: https://dni5o46b2208p.cloudfront.net/<intranet-address>/<agency>

Please get in touch with the [Intranet team on Slack](https://mojdt.slack.com/archives/C03QE40GVA6) for further 
information.


## Creating a snapshot

Access is granted if you are in possession of the basic-auth credentials.

Access point: [via Cloud Platform (dev)](https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk/)

![](https://docs.google.com/drawings/d/e/2PACX-1vTJqlB4knZZt1XA7t2No80oOjcvRRk5HuZ8BlRBnYmBD5So28xrr_pt3fZuV1vobUK_ndkKXR9zBST2/pub?w=1440&h=810)

## Local development

> It's important to note that creating a snapshot of the intranet from a local machine proved to present resource
> related issues, such as VPN timeouts and rate limiting. 

Requires

- Docker

### Installation

Clone to your machine:

```
git clone https://github.com/ministryofjustice/intranet-archive.git && cd intranet-archive
```

Start docker compose:

```
make run
```
There is a script designed to help you install the [Dory Proxy](https://github.com/FreedomBen/dory), if you'd like to.

If you chose to install Dory, you can access the application here:

[spider.intranet.docker](http://spider.intranet.docker/)

Otherwise, access the application here:

[localhost:8080](http://localhost:8080/)

## Understanding application logic

Let's begin with servers and their interactions within... 

The Archiver has an Nginx server. This is used to display responses from the underlying NodeJS 
server where Node processes form requests and decides how to treat them. Essentially, if happy with the request, Node 
will instruct HTTrack to perform a website copy operation, and it does this with predefined options, and a custom plugin.

## HTTrack

At the very heart of the Archiver sits [HTTrack](https://en.wikipedia.org/wiki/HTTrack). This application is configured 
by Node to take a snapshot of the MoJ Intranet. Potentially, you can point the Archiver at any website address and, 
using the settings for the Intranet, it will attempt to create an isolated copy of it.

### Debugging

The output of HTTrack can be noted in Docker Composes' `stdout` in the running terminal window however, a more 
detailed and linear output stream is available in the `hts-log.txt` file. You can find this in the root of the snapshot. 

### A custom command and a plugin

During the build of the Archiver, we came across many challenges, two of which almost prevented our proof of concept 
from succeeding. The first was an inability to display images. The second was an inability to download them.

**1) The HTTrack `srcset` problem**

In modern browsers, the `srcset` attribute is used to render a correctly sized image, for the device the image was loaded
in. This helps to manage bandwidth and save the user money. The trouble is HTTrack doesn't modify the URLs in `srcset` 
attributes so instead, we get no images where the attribute is used.

Using `srcset` in the Archive bears little value so to fix this we decided to remove `srcset` completely, we use
[HTTracks' `-V` option](https://manpages.debian.org/testing/httrack/httrack.1.en.html#V); this allows us to execute a command on every file that is downloaded. In particular, we run the 
following `sed` command, where `$0` is the file reference in HTTrack.

```bash
# find all occurrences of srcset in the file referenced by $0 
# select and remove, including contents.
 
sed -i 's/srcset="[^"]*"//g' $0
```

**2) The HTTrack _persisted_ Query String problem**

During normal operation of the Intranet, CDN resources are collected using a signed URL. We use AWS signatures to 
authorise access to S3 objects however, we only allow 30 minutes for each request. We discovered that HTTrack would 
_gather_ URLs, mark them as `.tmp` and then pop them in a queue, ready for collection at a later time.

As you can imagine, this method of operation will indeed cause problems should the length of time exceed 30 minutes. In 
fact, a variation of this issue caused more than 17,000 forbidden errors and prevented more than 6GB of data from being 
collected in our attempts to take a snapshot of HMCTS.

Indeed, when the issue was investigated further it was agreed that the Archiver was granted full access to the CDN. In 
fact, there really shouldn't have been an issue grabbing objects due to this, however, we discovered that if we leave 
the query string signature in the URL, even though we are authorised, the request validates as 401 unauthorized.

Because HTTrack has very limited options around query string manipulation, we were presented with 2 possibilities to fix
this problem:

1) Give CDN objects an extended life 
2) Use HTTracks' plugin system to add functionality

_Yes. You guessed it!_<br>
We used [HTTracks' plugin system](https://www.httrack.com/html/plug.html). Extending the expiry time would be nowhere 
near ideal for two reasons; 1) we would never really know the length of time that would be optimal. 2) we are modifying 
another system to make ours work... that should send alarm-bells ringing in any software developers' head!

As defined by HTTrack, our new plugin needed to be written in C (programming language), compiled using `gcc` and 
converted to a `.so`, ready for HTTrack to load and launch its operation on every URL. Simples.

The plugin can be viewed in `/conf/httrack/`. 

It can be noted that we identified one query string parameter that needed to be removed for the request to validate 
correctly. Once this was coded in all requests were successful and our 401 unauthorized was gone. 


### Testing and making modifications to the application

All processing for HTTrack is managed in the `process.js` file located in the NodeJS application. You will find all the 
options used to set HTTrack up.

To understand the build process further, please look at the Makefile.

