/*********************************
 * Intranet Archive - processing
 */

const express = require('express');
const app = express();
const port = process.env.PORT || 2000;
const cors = require('cors');

app.use(express.urlencoded({ extended: true }));

app.use(cors({
    methods: ['POST'],
    origin: ['http://http://spider.intranet.docker', 'https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk']
}));

app.post('/spider', function (request, response, next) {

    let url = request.body.url || 'https://intranet.justice.gov.uk/';
    let agency = request.body.agency || "hmcts";

    let settings = [
        '-s0', // do not follow robots.txt
        '-O /archiver/snapshots/',
        '--verbose'
    ];

    let options = [
        url,
        '+*.png','+*.gif', '+*.jpg', '+*.jpeg', '+*.css', '+*.js', '-ad.doubleclick.net/*',
        '-*intranet.justice.gov.uk/agency-switcher/',
        '-*intranet.justice.gov.uk/?*agency=*',
        '-*intranet.justice.gov.uk/?p=*'
    ];

    if (agency) {
        options.push('+*intranet.justice.gov.uk/?*agency=' + agency)
    }

    const { spawn } = require('child_process');

    const listener = spawn('httrack', [options.concat(settings)]);

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
});

app.listen(port);
