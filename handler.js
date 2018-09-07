/* DEPENDENCY */
const Alexa = require("ask-sdk-core");
const _ = require("underscore");
const request = require("request");
const constant = require("./constants");
/* HELPER METHODS */
const httpGet = options => {
    return new Promise((resolve, reject) => {
        request(options, function (error, response, body) {
            if (error || body === null) {
                console.log(`Error Recieved from api ${options.url} Error:=`, error);
                reject(error);
            } else {
                console.log(`response recived by api ${options.url} Body:=`, body);
                resolve(body);
            }
        });
    });
};
const findStepsBiopicUrl = (url) => {
    return new Promise((resolve, reject) => {
        var options = {
            method: 'GET',
            url: `${url}`,
            headers: {
                'cache-control': 'no-cache'
            }
        };
        httpGet(options).then(response => {
            response = JSON.parse(response);
            resolve(`${constant.API_ENDPOINT}${_.property(["data","attributes","url"])(response)}`);
        }).catch(err => {
            reject(err);
        })
    });
}
const AsanaDetails = _.mixin({
    processedText: function (obj, OrderedChildArray) {
        return _.map(_.keys(obj), function (key) {
            let keyArray = _.union([key], OrderedChildArray);
            let a = _.property(keyArray)(obj);
            return a;
        });
    }
});
const AsanaGenericHandler = (handlerInput, source) => {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let Asana = handlerInput.requestEnvelope.request.intent.slots.Asana.resolutions.resolutionsPerAuthority[0].values[0].value.name;
    sessionAttributes.Asana = Asana;
    return new Promise((resolve, reject) => {
        var options = {
            method: 'GET',
            url: `${constant.API_ENDPOINT}/jsonapi/node/yoga_asana`,
            qs: {
                include: 'field_asana_steps,field_asana_biopic',
                'fields[paragraph--asana_steps]': 'field_asana_step_number,field_asana_step_instruction,field_asana_image',
                'fields[file--file]': 'meta,filename,url',
                'filter[titlefilter][condition][path]': 'title',
                'filter[titlefilter][condition][value]': Asana,
                'filter[titlefilter][condition][operator]': 'CONTAINS'
            },
            headers: {
                'cache-control': 'no-cache'
            }
        };
        httpGet(options)
            .then(response => {
                response = JSON.parse(response);
                let data = response.data;
                let asanaInfo = _.map(_.pluck(data, 'attributes'), function (el) {
                    return _.values(_.pick(el.field_asana_meaning, 'processed'))[0].replace(/<\/?[^>]+(>|$)/g, "").replace('&nbsp;', '');
                }).toString();
                let biopic = `${constant.API_ENDPOINT}${_.map(_.pluck(data, 'relationships'), function (el) {
          return  _.values(_.pluck(_.pick(el.field_asana_biopic, 'data'),'attributes')[0])[1]
        }).toString()}`;
                let asanaStepsArray = _.where(response.included, {
                    type: "paragraph--asana_steps"
                });
                let asanaStepsInfo = _.map(_.pluck(asanaStepsArray, 'attributes'), function (el) {
                    return `Step ${el.field_asana_step_number} ... ${el.field_asana_step_instruction.value.replace(/<\/?[^>]+(>|$)/g, "").replace('&nbsp;','')} `
                });
                let asanaDetail = AsanaDetails.processedText(_.pluck(data, 'attributes')[0], ['processed']);
                asanaDetail = _.compact(asanaDetail);
                asanaDetail.pop();
                asanaDetail = asanaDetail.join().replace(/<\/?[^>]+(>|$)/g, "").replace('&nbsp;', '');
                let filteredArray = _.pluck(_.pluck(_.pluck(asanaStepsArray, "relationships"), "field_asana_image"), "links");
                filteredArray = _.map(filteredArray, function (el) {
                    return el.related
                });
                let PromiseALL = _.map(filteredArray, function (el) {
                    return findStepsBiopicUrl(el);
                })
                Promise.all(PromiseALL).then(function (asanaStepsBioPic) {
                    let outputText;
                    let reprompt;
                    switch (source) {
                        case 'AsanaMeaning':
                            {
                                outputText = constant.ASANA_MEANING_OUTPUT_TEXT({
                                    asanaInfo: asanaInfo
                                });
                                reprompt = constant.ASANA_MEANING_REPROMPT_TEXT;
                                break;
                            }
                        case 'AsanaDetail':
                            {
                                outputText = constant.ASANA_DETAILS_OUTPUT_TEXT({
                                    asanaDetail: asanaDetail
                                });
                                reprompt = constant.ASANA_DETAILS_REPROMPT_TEXT
                                break;
                            }
                        default:
                            {
                                outputText = constant.ASANA_STEPS_OUTPUT_TEXT({
                                    asanaStepsInfo: asanaStepsInfo[0],
                                    Asana: Asana
                                });
                                sessionAttributes.AsanaStepIndex = 0;
                                reprompt = constant.ASANA_STEPS_REPROMPT_TEXT;
                                biopic = asanaStepsBioPic[0];
                                break;
                            }
                    }
                    sessionAttributes.PrevQues = source;
                    sessionAttributes.speechText = outputText;
                    sessionAttributes.biopic = biopic;
                    sessionAttributes.asanaInfo = asanaInfo;
                    sessionAttributes.asanaDetails = asanaDetail;
                    sessionAttributes.asanaStepsInfo = asanaStepsInfo;
                    sessionAttributes.asanaStepsBioPic = asanaStepsBioPic;
                    console.log(sessionAttributes);
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    resolve(
                        handlerInput.responseBuilder
                        .speak(outputText)
                        .withShouldEndSession(false)
                        .reprompt(reprompt)
                        .withStandardCard(`Yog Guru-${Asana}-${source==='AsanaMeaning'?"Meaning":source==='AsanaDetail'?"Details":"Steps"}`, `${source==='AsanaMeaning'?asanaInfo:source==='AsanaDetail'?asanaDetail:asanaStepsInfo[0]}`, biopic, biopic)
                        .getResponse()
                    );
                });

            })
            .catch(error => {
                console.log(error);
                sessionAttributes.speechText = constant.FALLBACK_MSG;
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                resolve(
                    handlerInput.responseBuilder
                    .speak(constant.FALLBACK_MSG)
                    .reprompt(constant.FALLBACK_MSG)
                    .getResponse()
                );
            });
    });
}
/* INTENT HANDLERS */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "LaunchRequest";
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder
            .speak(constant.WELCOME_MSG)
            .reprompt(constant.WELCOME_MSG)
            .withSimpleCard("Welcome!", constant.WELCOME_MSG)
            .getResponse();
    }
};
const listAsanaHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "ListAsana"
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return new Promise((resolve, reject) => {
            var options = {
                method: "GET",
                url: `${constant.API_ENDPOINT}/jsonapi/node/yoga_asana/`,
                qs: {
                    'fields[node--yoga_asana]': "title,field_asana_name,field_asana_sanskrit_name,field_asana_meaning"
                },
                headers: {
                    "cache-control": "no-cache"
                }
            };
            httpGet(options)
                .then(response => {
                    response = JSON.parse(response);
                    let data = response.data;
                    let asanaList = _.pluck(_.pluck(data, 'attributes'), 'title').toString();
                    console.log(asanaList);
                    let outputText = `There are total ${
              data.length
            } asanas that I know...You can ask me information on...`;
                    outputText = outputText.concat(
                        `${asanaList}... I have sent these details to the Alexa App on your phone. Now which asana would you like to know about ?`
                    );
                    console.log(outputText);

                    if (asanaList.length != 0) {
                        const speechText = outputText;
                        resolve(
                            handlerInput.responseBuilder
                            .speak(speechText)
                            .withShouldEndSession(false)
                            .reprompt('Now which asana would you like to know about ?')
                            .withSimpleCard("Yog Guru Asana List", asanaList)
                            .getResponse()
                        );
                    } else {
                        const speechText = `I am sorry!I didn't found any asana details.Please try again in sometime.`;
                        resolve(
                            handlerInput.responseBuilder
                            .speak(speechText)
                            .reprompt(constant.REPROMPT_MSG)
                            .withShouldEndSession(false)
                            .withSimpleCard("Yog Guru Asana List", asanaList)
                            .getResponse()
                        );
                    }
                })
                .catch(error => {
                    resolve(
                        handlerInput.responseBuilder
                        .speak(constant.FALLBACK_MSG)
                        .reprompt(constant.FALLBACK_MSG)
                        .getResponse()
                    );
                });
        });
    }
};
const AsanaMeaningHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AsanaMeaning"
        );
    },
    handle(handlerInput) {
        return AsanaGenericHandler(handlerInput, "AsanaMeaning");
    }
};
const AsanaDetailHandler = {
    canHandle(handlerInput) {
        let isRequestFromYesIntent = false;
        let YesContext = handlerInput.attributesManager.getRequestAttributes().YesContext;
        if (YesContext !== undefined && YesContext == "AsanaDetail") {
            isRequestFromYesIntent = true;
        }
        return (
            (handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                handlerInput.requestEnvelope.request.intent.name === "AsanaDetail") ||
            isRequestFromYesIntent
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let YesContext = handlerInput.attributesManager.getRequestAttributes().YesContext;
        if (YesContext !== undefined) {
            isRequestFromYesIntent = true;
            let Asana = sessionAttributes.Asana;
            let biopic = sessionAttributes.biopic;
            let asanaDetail = sessionAttributes.asanaDetails;
            sessionAttributes.PrevQues = "AsanaDetail";
            let outputText = constant.ASANA_DETAILS_OUTPUT_TEXT({
                asanaDetail: asanaDetail
            });
            sessionAttributes.speechText = outputText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(outputText)
                .withShouldEndSession(false)
                .reprompt(constant.ASANA_DETAILS_REPROMPT_TEXT)
                .withStandardCard(`Yog Guru-${Asana}-Details`, asanaDetail, biopic, biopic)
                .getResponse();
        } else {
            return AsanaGenericHandler(handlerInput, "AsanaDetail");
        }
    }
};
const AsanaStepHandler = {
    canHandle(handlerInput) {
        let isRequestFromYesIntent = false;
        let YesContext = handlerInput.attributesManager.getRequestAttributes().YesContext;
        if (YesContext !== undefined && YesContext == "AsanaSteps") {
            isRequestFromYesIntent = true;
        }
        return (
            (handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                handlerInput.requestEnvelope.request.intent.name === "AsanaSteps") ||
            isRequestFromYesIntent
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let YesContext = handlerInput.attributesManager.getRequestAttributes().YesContext;
        if (YesContext !== undefined) {
            isRequestFromYesIntent = true;
            let Asana = sessionAttributes.Asana;
            let asanaStepsBioPic = sessionAttributes.asanaStepsBioPic;
            let asanaStepsInfo = sessionAttributes.asanaStepsInfo;
            let outputText = constant.ASANA_STEPS_OUTPUT_TEXT({
                Asana: Asana,
                asanaStepsInfo: asanaStepsInfo[0]
            })
            sessionAttributes.AsanaStepIndex = 0;
            sessionAttributes.PrevQues = "AsanaSteps";
            sessionAttributes.speechText = outputText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            const speechText = outputText;
            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(false)
                .reprompt(constant.ASANA_STEPS_REPROMPT_TEXT)
                .withStandardCard(`Yogguru- ${Asana}- Steps`, asanaStepsInfo[0], asanaStepsBioPic[0], asanaStepsBioPic[0])
                .getResponse()
        } else {
            return AsanaGenericHandler(handlerInput, "AsanaSteps");
        }
    }
};
const YesIntentHandler = {
    canHandle(handlerInput) {
        if (handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AMAZON.YesIntent" &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues !== undefined &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues !== 'COMPLETE') {
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            switch (sessionAttributes.PrevQues) {
                case 'AsanaMeaning':
                    {
                        requestAttributes.YesContext = 'AsanaDetail';
                        sessionAttributes.PrevQues = 'COMPLETE';
                        break;
                    }
                case 'AsanaDetail':
                    {
                        requestAttributes.YesContext = 'AsanaSteps';
                        sessionAttributes.PrevQues = 'COMPLETE';
                        break;
                    }
            }
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            handlerInput.attributesManager.setRequestAttributes(requestAttributes);
            return false;
        } else {
            return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
                handlerInput.requestEnvelope.request.intent.name === "AMAZON.YesIntent"
        }

    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const speechText = constant.CONTINUE_MSG;
        sessionAttributes.speechText = speechText;
        sessionAttributes.PrevQues = "AsanaSteps";
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withShouldEndSession(false)
            .withSimpleCard("Continue ", speechText)
            .getResponse();
    }
};
const NextStepHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AMAZON.NextIntent" &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues !== undefined &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues === 'AsanaSteps'
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.AsanaStepIndex += 1;
        let asanaStepsBioPic = sessionAttributes.asanaStepsBioPic;
        let asanaStepsInfo = sessionAttributes.asanaStepsInfo;
        let Asana = sessionAttributes.Asana;
        if (sessionAttributes.AsanaStepIndex < sessionAttributes.asanaStepsInfo.length) {
            const speechText = `<prosody volume="x-loud"> ${sessionAttributes.asanaStepsInfo[sessionAttributes.AsanaStepIndex]}</prosody>... <break time="4s"/> Please say 'Next' to know the next step.`;
            sessionAttributes.speechText = speechText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(`Please say 'Next' to know the next step.`)
                .withShouldEndSession(false)
                .withStandardCard(`Yogguru- ${Asana}- Steps`, asanaStepsInfo[sessionAttributes.AsanaStepIndex], asanaStepsBioPic[sessionAttributes.AsanaStepIndex], asanaStepsBioPic[sessionAttributes.AsanaStepIndex])
                .getResponse();
        } else {
            const speechText = `There are only ${sessionAttributes.asanaStepsInfo.length} steps in ${sessionAttributes.Asana}... Please say 'Previous' to know the previous step.`;
            sessionAttributes.speechText = speechText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(`Please say 'Previous' to know the previous step.`)
                .withSimpleCard('Yog Guru-Steps', `Please say 'Previous' to know the previous step.`)
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};
const PreviousStepHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AMAZON.PreviousIntent" &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues !== undefined &&
            handlerInput.attributesManager.getSessionAttributes().PrevQues === 'AsanaSteps'
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.AsanaStepIndex -= 1;
        let asanaStepsBioPic = sessionAttributes.asanaStepsBioPic;
        let asanaStepsInfo = sessionAttributes.asanaStepsInfo;
        let Asana = sessionAttributes.Asana;
        if (sessionAttributes.AsanaStepIndex > 0) {
            const speechText = `<prosody volume="x-loud"> ${sessionAttributes.asanaStepsInfo[sessionAttributes.AsanaStepIndex]}</prosody>... <break time="4s"/> Please say 'Next' to know the next step.`;
            sessionAttributes.speechText = speechText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(`Please say 'Next' to know the next step.`)
                .withShouldEndSession(false)
                .withStandardCard(`Yogguru- ${Asana}- Steps`, asanaStepsInfo[sessionAttributes.AsanaStepIndex], asanaStepsBioPic[sessionAttributes.AsanaStepIndex], asanaStepsBioPic[sessionAttributes.AsanaStepIndex])
                .getResponse();
        } else {
            const speechText = `There are no more previous steps in this ${sessionAttributes.Asana} ... Please say 'Next' to know the next step.`;
            sessionAttributes.speechText = speechText;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(`Please say 'Next' to know the next step.`)
                .withSimpleCard('Yog Guru-Steps', `Please say 'Next' to know the next step.`)
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AMAZON.FallbackIntent"
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const speechText = constant.FALLBACK_MSG;
        sessionAttributes.speechText = speechText;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withShouldEndSession(false)
            .withSimpleCard("Fallback", speechText)
            .getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            handlerInput.requestEnvelope.request.intent.name === "AMAZON.HelpIntent"
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const speechText = constant.HELP_MSG;
        sessionAttributes.speechText = speechText;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withShouldEndSession(false)
            .withSimpleCard("Help by Yog Guru", speechText)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === "IntentRequest" &&
            (handlerInput.requestEnvelope.request.intent.name ===
                "AMAZON.CancelIntent" ||
                handlerInput.requestEnvelope.request.intent.name ===
                "AMAZON.StopIntent" ||
                handlerInput.requestEnvelope.request.intent.name ===
                "ThanksIntent" ||
                handlerInput.requestEnvelope.request.intent.name === "AMAZON.NoIntent")
        );
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const speechText = constant.GOODBYE_MSG;
        sessionAttributes.speechText = speechText;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard("Goodbye msg Yog Guru", speechText)
            .withShouldEndSession(true)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        //any cleanup logic goes here
        return handlerInput.responseBuilder.getResponse();
    }
};
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        const speechText = constant.ERROR_MSG;
        return handlerInput.responseBuilder
            .speak(error.message)
            .reprompt(speechText)
            .getResponse();
    }
};
const RepeatHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return handlerInput.responseBuilder
            .speak(sessionAttributes.speechText)
            .reprompt(constant.REPROMPT_MSG)
            .getResponse();
    },
};

module.exports = () => {
    return Alexa.SkillBuilders.custom()
        .addRequestHandlers(
            LaunchRequestHandler,
            listAsanaHandler,
            AsanaMeaningHandler,
            YesIntentHandler,
            AsanaDetailHandler,
            AsanaStepHandler,
            NextStepHandler,
            PreviousStepHandler,
            RepeatHandler,
            HelpIntentHandler,
            CancelAndStopIntentHandler,
            FallbackIntentHandler,
            SessionEndedRequestHandler
        )
        .addErrorHandlers(ErrorHandler)
        .lambda();
}