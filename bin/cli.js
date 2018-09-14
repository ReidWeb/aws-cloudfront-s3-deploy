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
