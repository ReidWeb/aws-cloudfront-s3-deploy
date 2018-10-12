/*
 MIT License

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
/* eslint-disable no-console */
const chalk = require('chalk');
const AWS = require('aws-sdk');
const path = require('path');
const s3 = require('./s3');
const cloudFront = require('./cloudfront');

function validateParams(additionalParams) {
  return new Promise((resolve, reject) => {
    if (additionalParams && additionalParams.authentication) {
      const authObj = additionalParams.authentication;
      if ((authObj.keyId || authObj.accessKey) && authObj.profile) {
        reject(Error('Two methods of authentication supplied, please remove either keyId/accessKey or profile from the params.authentication block.'));
      }

      if (authObj.keyId && !authObj.accessKey) {
        reject(new Error('`keyId` has been provided, but `accessKey` has not. Please add your `accessKey` and try again.'));
      }

      if (!authObj.keyId && authObj.accessKey) {
        reject(new Error('`accessKey` has been provided, but `keyId` has not. Please add your `keyId` and try again.'));
      }
    }
    resolve(true);
  });
}

function setAwsConfig(additionalParams) {
  if (additionalParams.authentication) {
    const authObj = additionalParams.authentication;
    if (authObj.keyId && authObj.accessKey) {
      AWS.config.accessKeyId = authObj.keyId;
      AWS.config.secretAccessKey = authObj.accessKey;
    } else if (authObj.profile) {
      const { profile } = authObj;
      AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile });
    }
  }

  if (additionalParams.region) {
    AWS.config.region = additionalParams.region;
  }
}


function deploy(userPath, bucketName, additionalParams) {
  return new Promise(async (resolve, reject) => {
    try {
      await validateParams(additionalParams);

      setAwsConfig(additionalParams);

      let uploadPath = userPath;
      if (!path.isAbsolute(userPath)) {
        uploadPath = path.resolve(userPath);
      }

      // eslint-disable-next-line max-len
      const uploadResult = await s3.uploadFilesInDir(uploadPath, bucketName, additionalParams);

      // eslint-disable-next-line max-len
      if (!additionalParams || !additionalParams.distribution || !additionalParams.distribution.id || uploadResult.changedFiles.length === 0) { // If no invalidation required
        resolve(uploadResult);
      } else if (additionalParams && additionalParams.distribution.id) {
        console.log(chalk.green(uploadResult.message));
        console.log(chalk.yellow(`Commencing invalidation operation for distribution ${additionalParams.distribution.id} of ${uploadResult.changedFiles.length}...`));
        // eslint-disable-next-line max-len
        resolve(await cloudFront.invalidateDistribution(additionalParams.distribution.id, uploadResult.changedFiles, additionalParams));
      }
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = deploy;
