/*
 * MIT License

 Copyright (c) 2018 Peter Reid <peter@reidweb.com>

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
*/
/* eslint-disable max-len,no-console */
const program = require('commander');
const chalk = require('chalk');
const deploy = require('../lib/index');

program
  .version('1.0.0')
  .option('-p, --path <required>', 'path')
  .option('-b, --bucket <required>', 'bucket name')
  .option('-d, --distribution [id]', 'cloudfront distribution id')
  .option('-p, --profile [profile name]', 'profile to use')
  .option('-i, --keyId [keyId]', 'AWS access key ID')
  .option('-k, --accessKey [accessKey]', 'AWS access key')
  .option('-r, --reupload', 'Re-upload all items')
  .option('-v, --verbose', 'run in verbose mode')
  .parse(process.argv);

if (program.path && program.bucket) {
  const additionalParams = {};
  additionalParams.cli = true;
  additionalParams.verbose = program.verbose;
  additionalParams.reuploadAll = program.reupload;

  if (program.distribution) {
    additionalParams.distribution = {};
    additionalParams.distribution.id = program.distribution;
  }

  if (program.profile || program.key || program.keyId) {
    additionalParams.authentication = {};
  }

  if (program.profile) {
    additionalParams.authentication.profile = program.profile;
  }

  if (program.accessKey) {
    additionalParams.authentication.accessKey = program.accessKey;
  }

  if (program.keyId) {
    additionalParams.authentication.keyId = program.keyId;
  }

  deploy(program.path, program.bucket, additionalParams).then((msg) => {
    console.log(chalk.greenBright(msg));
  }).catch((e) => {
    if (e.message) {
      console.log(chalk.bold.red(`ERROR: ${e.message}`));
    }
    console.log(chalk.bold.red(`ERROR: ${e}`));
  });
} else {
  program.outputHelp();
}
