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
const deploy = require('../src/index');

program
  .version('1.0.0')
  .option('-p, --path <required>', 'path')
  .option('-b, --bucket <required>', 'bucket name')
  .option('-d, --distribution [id]', 'cloudfront distribution id')
  .option('-p, --profile [profile name]', 'profile to use')
  .option('-V, --verbose', 'run in verbose mode')
  .parse(process.argv);

if (program.path && program.bucket) {
  deploy(program.path, program.bucket, program.distribution, program.profile, program.verbose, true).then((msg) => {
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
