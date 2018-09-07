/* CONSTANTS */
const _ = require("underscore");
module.exports = {
    WELCOME_MSG: "Welcome to Yog guru Alexa skill. You can ask me questions on different yoga asanas, ... Now, what can I help you with? ",
    HELP_MSG: "You can ask the questions around yoga asanas or ask me for any recommendation on any specific pain",
    GOODBYE_MSG: "Thank you for trying the Yog Guru Alexa Skill. Have a nice day!",
    REPROMPT_MSG: "What else can I help you with ?",
    FALLBACK_MSG: "I am really sorry. I am unable to access part of my memory. Please try again later",
    ERROR_MSG: "I am really sorry, an error was encountered while handling your request. Try again later",
    CONTINUE_MSG: "Which Asana do you want to learn ?",
    API_ENDPOINT: "https://dev-d8one-yoga-hub.pantheonsite.io",
    ASANA_MEANING_OUTPUT_TEXT: _.template(`<%= asanaInfo %>... <break time="3s"/>Do you want to know more details about this asana ?`),
    ASANA_DETAILS_OUTPUT_TEXT: _.template(`<%= asanaDetail %>... <break time="3s"/>Do you want to know about steps of this asana ?`),
    ASANA_STEPS_OUTPUT_TEXT: _.template(`These are the steps involved in <%= Asana %>... <%= asanaStepsInfo %> <break time="4s"/> Please say 'Next' to know the next step.`),
    ASANA_MEANING_REPROMPT_TEXT: `Do you want to know more details about this asana ?`,
    ASANA_DETAILS_REPROMPT_TEXT: `Do you want to know about steps of this asana ?`,
    ASANA_STEPS_REPROMPT_TEXT: `Please say 'Next' to know the next step.`,
}