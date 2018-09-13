const recursive = require('recursive-readdir');
const AWS = require('aws-sdk');
const chalk = require('chalk');
const fs = require('fs');
const ProgressBar = require('progress');
const mime = require('mime-types');

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
          reject(err);
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

function uploadFiles(pathToUpload, fileList, bucketName, verboseMode, isCli) {
  const s3 = new AWS.S3();
  return new Promise((resolve, reject) => {
    const fileListLength = fileList.length;
    const barIncrement = Math.round(fileList.length / BAR_SEGMENTS);
    let nextIncrement = barIncrement;
    let itemsProcessed = 0;
    let bar;

    if (isCli) {
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
              if (verboseMode) {
                // eslint-disable-next-line no-console
                console.log(chalk.green(`Successfully uploaded ${fileName} to ${bucketName}`));
              }
              itemsProcessed++;

              if (itemsProcessed >= nextIncrement) {
                nextIncrement += barIncrement;
                if (isCli) {
                  bar.tick();
                }
              }

              if (itemsProcessed === fileListLength) {
                let i;
                if (isCli) {
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

function uploadChangedFilesInDir(pathToUpload, bucketName, distId, verboseMode, isCli) {
  return new Promise((resolve, reject) => {
    const changedFiles = [];
    recursive(pathToUpload, (err, fileList) => {
      const s3 = new AWS.S3();

      let testedFiles = 0;
      const fileListLength = fileList.length;

      fileList.forEach((fileName) => {
        const bucketPath = fileName.substring(pathToUpload.length + 1);
        hasFileChanged(pathToUpload, bucketPath, bucketName, s3, getFileLastModifiedDate)
          .then((hasChanged) => {
            if (hasChanged) {
              changedFiles.push(bucketPath);
            }
            testedFiles++;

            if (testedFiles === fileListLength) {
              if (changedFiles.length > 0) {
                // eslint-disable-next-line no-console
                console.log(chalk.yellow(`${fileListLength} objects found, ${changedFiles.length} objects require updates...`));
                uploadFiles(pathToUpload, changedFiles, bucketName, verboseMode, isCli)
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
          .catch(e => reject(e));
      });
    });
  });
}


module.exports.uploadChangedFilesInDir = uploadChangedFilesInDir;
