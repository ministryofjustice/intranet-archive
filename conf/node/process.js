#!/usr/bin/env node
/**
 * Intranet Archive - NodeJS Form Processing
 * -
 *************************************************/
const express = require('express');
const path = require('path');
const app = express();
const port = 2000;
const cors = require('cors');
const { exec } = require('child_process');

app.use(express.urlencoded({ extended: true }));

app.use(cors({
    methods: ['POST'],
    origin: [
        'http://spider.intranet.docker/',
        'https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk/'
    ]
}));

app.post('/spider', async function (request, response, next) {
    // handle the response
    let body = request.body;
    response.status(200).sendFile(path.join('/usr/share/nginx/html/working.html'));
    await spider(body);
});

/**
 * Spider the intranet and take a snapshot of the given agency, if no agency is supplied in
 * body, the spider focuses on HQ only.
 *
 * @param body form payload
 **/
async function spider (body) {
    await new Promise(resolve => setTimeout(resolve, 1));
    const { spawn } = require('child_process');
    const mirror = {
        url: new URL(body.url || 'https://intranet.justice.gov.uk/'),
        agency: body.agency || 'hq'
    }
    const directory = '/archiver/snapshots/' + mirror.url.host + '/' + mirror.agency;

    let options, rules, settings;

    mkdir(directory);

    options = [
        mirror.url.origin + '/?agency=' + mirror.agency
    ];

    rules = [
        '+*.png', '+*.gif', '+*.jpg', '+*.jpeg', '+*.css', '+*.js', '-ad.doubleclick.net/*',
        '-*intranet.justice.gov.uk/agency-switcher/',
        '-*intranet.justice.gov.uk/?*agency=*',
        '-*intranet.justice.gov.uk/?p=*',
        '-*intranet.justice.gov.uk/wp-json/*/embed*',
        '-*intranet.justice.gov.uk/wp/*',
        '+*intranet.justice.gov.uk/?*agency=' + mirror.agency
    ];

    settings = [
        '-s0', // never follow robots.txt and meta robots tags: https://www.mankier.com/1/httrack#-sN
        '-V', // execute system command after each file: https://www.mankier.com/1/httrack#-V
        '"sed -i \'s/srcset="[^"]*"//g\' \$0"',
        '-O', // path for snapshot/logfiles+cache: https://www.mankier.com/1/httrack#-O
        directory
    ];

    // combine: push rules into options
    options = options.concat(rules);
    // combine: push settings into options
    options = options.concat(settings);
    // verify options array
    console.log('Launching Intranet Spider with the following options: ', options);

    // launch HTTrack with options
    const listener = spawn('httrack', options);
    listener.stdout.on('data', data => console.log(`stdout: ${data}`));
    listener.stderr.on('data', data => console.log(`stderr: ${data}`));
    listener.on('error', (error) => console.log(`error: ${error.message}`));
    listener.on('close', code => console.log(`child process exited with code ${code}`));
}
/**
 * Creates system directory[s] from the given path.
 *
 * This function supports parent path creation using linux `mkdir -p`. Therefore, it is possible to pass any
 * string to this path that `mkdir` supports: https://linux.die.net/man/1/mkdir
 *
 * @param directory string
 */
function mkdir (directory) {
    exec('mkdir -p ' + directory, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}
app.listen(port);
