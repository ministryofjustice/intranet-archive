#!/usr/bin/env node
/*********************************
 * Intranet Archive - processing
 */

const express = require('express');
const path = require('path');
const app = express();
const port = 2000;
const cors = require('cors');
const { exec } = require('child_process');

app.use(express.urlencoded({ extended: true }));

app.use(cors({
    methods: ['POST'],
    origin: ['http://spider.intranet.docker/', 'https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk/']
}));

app.post('/spider', async function (request, response, next) {
    // handle the response
    let body = request.body;
    response.status(200).sendFile(path.join('/usr/share/nginx/html/working.html'));
    console.log('sent response');

    await launchScrape(body);
});

async function launchScrape (body) {
    await new Promise(resolve => setTimeout(resolve, 1));

    const { spawn } = require('child_process');

    let url = body.url || 'https://intranet.justice.gov.uk/';
    let agency = body.agency || '';
    let directory = '/archiver/snapshots/';

    url = new URL(url);

    let options = [
        url.origin,
        '+*.png', '+*.gif', '+*.jpg', '+*.jpeg', '+*.css', '+*.js', '-ad.doubleclick.net/*',
        '-*intranet.justice.gov.uk/agency-switcher/',
        '-*intranet.justice.gov.uk/?*agency=*',
        '-*intranet.justice.gov.uk/?p=*'
    ];

    directory = directory + url.host;
    mkDir(directory);

    if (agency) {
        options.push('+*intranet.justice.gov.uk/?*agency=' + agency);
        directory = directory + '/' + agency + '/';
        mkDir(directory);
    }

    console.log(directory);

    let settings = [
        '-s0',
        '-O',
        directory,
        '--verbose'
    ];

    console.log(options.concat(settings));
    console.log('--------------');

    const listener = spawn('httrack', options.concat(settings));

    listener.stdout.on('data', data => {
        console.log(`stdout: ${data}`);
    });

    listener.stderr.on('data', data => {
        console.log(`stderr: ${data}`);
    });

    listener.on('error', (error) => {
        console.log(`error: ${error.message}`);
    });

    listener.on('close', code => {
        console.log(`child process exited with code ${code}`);
    });
}

function mkDir (directory) {
    exec('mkdir -p ' + directory, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}

app.listen(port);
