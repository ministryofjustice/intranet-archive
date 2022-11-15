/*******************************
 * Intranet Archive
 */

//import { app } from "./base";

const express = require('express');
const app = express();

// load app js...

app.use(express.urlencoded());

app.get('/', function (request, response, next) {
    response.send(`
        <div class="govuk-width-container">
          <main class="govuk-main-wrapper">
            <div class="govuk-grid-row">
              <div class="govuk-grid-column-two-thirds">
                <form method="post" action="/">
                    <fieldset class="govuk-fieldset">
                      <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
                        <h1 class="govuk-fieldset__heading">
                          Configure archive settings
                        </h1>
                      </legend>
                    
                      <div class="govuk-form-group">
                        <label class="govuk-label" for="address-line-1">
                          Address line 1
                        </label>
                        <input class="govuk-input" id="address-line-1" name="address-line-1" type="text" autocomplete="address-line1">
                      </div>
                    
                      <div class="govuk-form-group">
                        <label class="govuk-label" for="address-line-2">
                          Address line 2 (optional)
                        </label>
                        <input class="govuk-input" id="address-line-2" name="address-line-2" type="text" autocomplete="address-line2">
                      </div>
                    
                      <div class="govuk-form-group">
                        <label class="govuk-label" for="address-town">
                          Town or city
                        </label>
                        <input class="govuk-input govuk-!-width-two-thirds" id="address-town" name="address-town" type="text" autocomplete="address-level2">
                      </div>
                    
                      <div class="govuk-form-group">
                        <label class="govuk-label" for="address-postcode">
                          Postcode
                        </label>
                        <input class="govuk-input govuk-input--width-10" id="address-postcode" name="address-postcode" type="text" autocomplete="postal-code">
                      </div>
                    
                    </fieldset>
                </form>
              </div>
            </div>
          </main>
        </div>
    `);
});

app.listen(2000);

