/* eslint-disable no-console */
const chalk = require('chalk');
const AWS = require('aws-sdk');
const path = require('path');
const s3 = require('./s3');
const cloudFront = require('./cloudfront');

function deploy(userPath, bucketName, distributionId, profile, verboseMode, isCli) {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue(`Starting deployment of gatsby app to S3 bucket: ${bucketName}...`));

    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile });

    let uploadPath = userPath;
    if (!path.isAbsolute(userPath)) {
      uploadPath = path.resolve(userPath);
    }

    s3.uploadChangedFilesInDir(uploadPath, bucketName, verboseMode, isCli).then((res) => {
      if (distributionId && res.changedFiles.length > 0) {
        console.log(chalk.green(res.message));
        console.log(chalk.yellow(`Commencing invalidation operation for distribution ${distributionId}...`));
        cloudFront.invalidateDistribution(distributionId, res.changedFiles)
          .then((msg) => {
            resolve(msg);
          })
          .catch(e => reject(e));
      } else {
        resolve(res.message);
      }
    }).catch((e) => {
      reject(e);
    });
  });
}

module.exports = deploy;
