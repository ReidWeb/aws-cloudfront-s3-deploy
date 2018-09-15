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
const recursive = require('recursive-readdir');
const AWS = require('aws-sdk');
const chalk = require('chalk');
const fs = require('fs');
const ProgressBar = require('progress');
const mime = require('mime-types');
const path = require('path');
const common = require('./common');

const MAX_NUM_REATTEMPTS = 5;
const BAR_SEGMENTS = 60;

function getFileLastModifiedDate(filePath) {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, localFileData) => {
      if (localFileData.mtime) {
        resolve(localFileData.mtime);
      } else {
        resolve(false);
      }
    });
  });
}

function uploadObj(params, s3, reAttemptCount) {
  return new Promise((resolve, reject) => {
    s3.putObject(params, (err) => {
      if (err) {
        const customErr = common.handleAwsError(err);
        if (customErr.shouldCauseTermination) {
          reject(customErr);
        }
        if (reAttemptCount >= MAX_NUM_REATTEMPTS) {
          // eslint-disable-next-line prettier/prettier
          reject(new Error(`Error: Unable to process object ${params.Key}, reattempted for ${MAX_NUM_REATTEMPTS} (MAX)`));
        } else {
          reAttemptCount++;
          uploadObj(params, s3, reAttemptCount)
            .then(() => {
              resolve(params.Key);
            }).catch((e) => {
              reject(e);
            });
        }
      } else {
        resolve(params.Key);
      }
    });
  });
}

function hasFileChanged(pathToFile, fileName, bucketName, s3, localFileModifiedCheckFn) {
  return new Promise((resolve, reject) => {
    const params = { Bucket: bucketName, Key: fileName };

    s3.headObject(params, (err, remoteData) => {
      if (err) {
        if (err.code === 'NotFound') {
          resolve(true);
        } else {
          reject(common.handleAwsError(err));
        }
      } else {
        const filePath = `${pathToFile}/${fileName}`;
        localFileModifiedCheckFn(filePath).then((localFileLastModifiedDate) => {
          const remoteFileLastModifiedDate = remoteData.Metadata['last-modified'];
          if (!remoteFileLastModifiedDate) { // If last modified date could not be retrieved
            resolve(true);
          } else if (remoteFileLastModifiedDate !== localFileLastModifiedDate.toISOString()) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
  });
}

function lookupFileType(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const type = mime.lookup(filePath);
      if (type) {
        resolve(type);
      } else {
        resolve('application/octet-stream');
      }
    } catch (e) {
      reject(e);
    }
  });
}

function uploadFiles(pathToUpload, fileList, bucketName, additionalParams) {
  const s3 = new AWS.S3();
  return new Promise((resolve, reject) => {
    const fileListLength = fileList.length;
    const barIncrement = Math.round(fileList.length / BAR_SEGMENTS);
    let nextIncrement = barIncrement;
    let itemsProcessed = 0;
    let bar;

    if (additionalParams && additionalParams.cli) {
      bar = new ProgressBar('Uploading [:bar]  :percent', {
        total: BAR_SEGMENTS,
        clear: true,
        head: '>',
      });
    }

    fileList.forEach((filePathInTargetDir) => {
      const filePathOnDisk = `${pathToUpload}/${filePathInTargetDir}`;
      getFileLastModifiedDate(filePathOnDisk).then((localFileModifiedLastDate) => {
        lookupFileType(filePathOnDisk).then((fileType) => {
          const params = {
            Bucket: bucketName,
            Key: filePathInTargetDir,
            Body: fs.readFileSync(`public/${filePathInTargetDir}`),
            ContentType: fileType,
            Metadata: {
              'Last-Modified': localFileModifiedLastDate.toISOString(),
            },
          };
          uploadObj(params, s3, 0)
            .then((fileName) => {
              if (additionalParams && additionalParams.verbose) {
                // eslint-disable-next-line no-console
                console.log(chalk.green(`Successfully uploaded ${fileName} to ${bucketName}`));
              }
              itemsProcessed++;

              if (itemsProcessed >= nextIncrement) {
                nextIncrement += barIncrement;
                if (additionalParams && additionalParams.cli) {
                  bar.tick();
                }
              }

              if (itemsProcessed === fileListLength) {
                let i;
                if (additionalParams && additionalParams.cli) {
                  for (i = bar.total - bar.curr; i >= 0; i--) {
                    bar.tick();

                    if (i === 0) {
                      resolve('Upload complete!');
                    }
                  }
                } else resolve('Upload complete!');
              }
            })
            .catch((e) => {
              reject(e);
            });
        }).catch((e) => {
          reject(e);
        });
      });
    });
  });
}

function uploadChangedFilesInDir(pathToUpload, bucketName, additionalParams) {
  return new Promise((resolve, reject) => {
    const changedFiles = [];
    recursive(pathToUpload, (err, fileList) => {
      if (err) {
        if (err.code === 'ENOTDIR') {
          reject(new Error('Specified path is not a directory, please specify a valid directory path - this module cannot process individual files'));
        } else if (err.code === 'ENOENT') {
          reject(new Error('Specified path does not exist. Please specify a valid directory path.'));
        } else {
          reject(err);
        }
      } else {
        const s3 = new AWS.S3();

        let testedFiles = 0;
        const fileListLength = fileList.length;

        if (fileListLength === 0) {
          resolve({
            changedFiles: [],
            message: 'No files found at specified path',
          });
        } else {
          if (!additionalParams || !additionalParams.reuploadAll) {
            console.log(chalk.blue('Determining objects files...'));
          }
          fileList.forEach((fileName) => {
            const bucketPath = path.relative(pathToUpload, fileName);
            if (additionalParams && additionalParams.reuploadAll) {
              // eslint-disable-next-line no-console
              console.log(chalk.yellow(`${fileListLength} objects found, re-uploading all to S3 Bucket: ${bucketName}`));
              // eslint-disable-next-line max-len
              const fileListWithNoBase = fileList.map(currentFilePath => path.relative(pathToUpload, currentFilePath));

              uploadFiles(pathToUpload, fileListWithNoBase, bucketName, additionalParams)
                .then((msg) => {
                  resolve({
                    changedFiles: fileListWithNoBase,
                    message: msg,
                  });
                })
                .catch(e => reject(e));
            } else {
              hasFileChanged(pathToUpload, bucketPath, bucketName, s3, getFileLastModifiedDate)
                .then((hasChanged) => {
                  if (hasChanged) {
                    changedFiles.push(bucketPath);
                  }
                  testedFiles++;

                  if (testedFiles === fileListLength) {
                    if (changedFiles.length > 0) {
                      // eslint-disable-next-line no-console
                      console.log(chalk.yellow(`${fileListLength} objects found, uploading ${changedFiles.length} objects that require updates to S3 Bucket: ${bucketName}...`));
                      uploadFiles(pathToUpload, changedFiles, bucketName, additionalParams)
                        .then((msg) => {
                          resolve({
                            changedFiles,
                            message: msg,
                          });
                        })
                        .catch(e => reject(e));
                    } else {
                      resolve({
                        changedFiles: [],
                        message: 'No file updates required, skipping upload...',
                      });
                    }
                  }
                })
                .catch((e) => {
                  reject(e);
                });
            }
          });
        }
      }
    });
  });
}


module.exports.uploadChangedFilesInDir = uploadChangedFilesInDir;
