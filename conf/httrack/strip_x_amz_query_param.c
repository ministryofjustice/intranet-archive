// Remove AWS X-Amz-Algorithm= from query string plugin for HTTrack
// X-Amz parameters are used to authorise a request to an AWS resource
//
// Our service is already authorised to access the resource so this makes HTTrack automatically remove the
// X-Amz-Algorithm parameter from URLs it visits, as there is no way this can be done with commandline
// parameters (see https://forum.httrack.com/readmsg/27508/index.html)

// see https://www.httrack.com/html/plug.html

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <httrack-library.h>
#include <htsopt.h>
#include <htsdefines.h>

static int aws_amz_query_detect(t_hts_callbackarg * carg, httrackp * opt, char * link, const const char * tag_start) {
    for (char * query = strchr(link, '?'); query != NULL; query = strchr(query, '&')) {
        ++query; // skip the separator
        if ( * query == '\0' )
            break;

        if (strncmp(query, "X-Amz-Algorithm=", 16) == 0 || strncmp(query, "amp;X-Amz-Algorithm=", 20) == 0 || strncmp(query, "#038;X-Amz-Algorithm=", 21) == 0) {
            char * tgt = query;
            char * src = strchr(query, '&');

            if (src != NULL) {
                ++src; // skip the separator
                while ( * src != '\0') {
                    * tgt++ = * src++;
                }
            }
            * tgt = '\0';
        }
    }

    char *end = strchr(link, '\0');
    --end; // go to last valid character

    while ( * end == '&' || * end == '?' )
        *end-- = '\0'; // clean up trailing & or ?

    return 1; /* Yes, process this. Returning 0 skips link processing */
}

EXTERNAL_FUNCTION int hts_plug(httrackp *opt, const char* argv) {
    fprintf(stderr, "Module plugged: AWS AMZ Query Detect\n");
    CHAIN_FUNCTION(opt, linkdetected2, aws_amz_query_detect, NULL);

    return 1; /* success */
}

EXTERNAL_FUNCTION int hts_unplug(httrackp *opt) {
    fprintf(stderr, "Module unplugged: AWS AMZ Query Detect\n");

    return 1; /* success */
}
