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
const AWS = require('aws-sdk');
const common = require('./common');

function prefixPaths(files) {
  return new Promise((resolve) => {
    const updatedFiles = [];
    files.forEach((file) => {
      updatedFiles.push(`/${file}`);

      if (updatedFiles.length === files.length) {
        resolve(updatedFiles);
      }
    });
  });
}

function invalidateDistribution(distId, files, additionalParams) {
  return new Promise((resolve, reject) => {
    const fileCount = files.length;
    if (additionalParams && additionalParams.reuploadAll) {
      files = ['*'];
    }
    prefixPaths(files).then((prefixedFiles) => {
      const cloudfront = new AWS.CloudFront({ apiVersion: '2018-06-18' });

      const params = {
        DistributionId: distId,
        InvalidationBatch: {
          CallerReference: new Date().getTime().toString(),
          Paths: {
            Quantity: files.length,
            Items: prefixedFiles,
          },
        },
      };

      cloudfront.createInvalidation(params, (err, data) => {
        if (err) {
          reject(common.handleAwsError(err));
        } else {
          const res = {
            message: `Invalidation with ID ${data.Invalidation.Id} has started for ${fileCount} changed files!`,
            changedFiles: files,
            invalidationId: data.Invalidation.Id,
          };
          resolve(res);
        }
      });
    });
  });
}

module.exports.invalidateDistribution = invalidateDistribution;
