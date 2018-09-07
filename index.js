/*
DEVELOPER:
Arihant Chhajed(arcsoftech)

DRUPAL PUBLIC ENDPOINT:
https://dev-d8one-yoga-hub.pantheonsite.io

PURPOSE:
Alexa voice bot proof of concept

DESCRIPTION:
  * This project is built to serve alexa calls for "Yog Guru " Alexa skill.
  * This project is part of Decoupled Drupal iniative and hence it uses Drupal as its content management system.
  * This is the entry point for the Alexa call.
  * Handler.js module handles all the request from Alexa.

INSTALLATION:
1. Use "npm install" command to downlaod all the dependency.
2. Archive all the files inlcuding "node_modules" folder and upload the zip into AWS lambda function.
3. MAP the AWS lambda arn with ALexa skill in the developer console.

*/

exports.handler = require('./handler')();