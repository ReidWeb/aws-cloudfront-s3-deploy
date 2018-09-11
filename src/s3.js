const recursive = require('recursive-readdir');
const AWS = require('aws-sdk');
const chalk = require('chalk');
const fs = require('fs');
const ProgressBar = require('progress');
var mime = require('mime-types')

const reAttemptMax = 5;

function getFileLastModifiedDate(filePath) {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, localFileData) => {
      resolve(localFileData.mtime);
    });
  });
}

function uploadObj(params, s3, reAttemptCount) {
  return new Promise((resolve, reject) => {
    s3.putObject(params, (err) => {
      if (err) {
        if (reAttemptCount === reAttemptMax) {
          // eslint-disable-next-line prettier/prettier
          reject(new Error(`Error: Unable to process object ${params.Key}, reattempted for ${reAttemptMax} (MAX)`));
        }
        reAttemptCount++;
        uploadObj(params, s3, reAttemptCount)
          .then(resolve(params.Key))
          .catch((e) => {
            reject(e);
          });
      } else {
        resolve(params.Key);
      }
    });
  });
}

function hasFileChanged(path, bucketName, s3) {
  return new Promise((resolve, reject) => {
    const params = { Bucket: bucketName, Key: path };

    s3.headObject(params, (err, remoteData) => {
      if (err) {
        if (err.code === 'NotFound') {
          resolve(true);
        } else {
          reject(err);
        }
      } else {
        const filePath = `public/${path}`;
        getFileLastModifiedDate(filePath).then((localFileLastModifiedDate) => {
          if (err) reject(err);
          else {
            const remoteFileLastModifiedDate = remoteData.Metadata['last-modified'];
            if (remoteFileLastModifiedDate !== localFileLastModifiedDate.toString()) {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        });
      }
    });
  });
}

function lookupFileType (filePath) {
  return new Promise((resolve, reject) => {
    try {
      let type = mime.lookup(filePath)
      if (type) {
        resolve(type);
      } else {
        resolve('application/octet-stream');
      }
    } catch (e) {
      resolve('application/octet-stream');
    }
  });
}

function uploadFiles(fileList, bucketName, verboseMode, isCli) {
  const s3 = new AWS.S3();
  return new Promise((resolve, reject) => {
    let itemsProcessed = 0;
    const barSegments = 60;
    const fileListLength = fileList.length;
    const barIncrement = Math.round(fileList.length / barSegments);
    let nextIncrement = barIncrement;
    let bar;

    if (isCli) {
      bar = new ProgressBar('Uploading [:bar]  :percent', {
        total: barSegments,
        clear: true,
        head: '>',
      });
    }

    fileList.forEach((filePath) => {
      getFileLastModifiedDate(`public/${filePath}`).then((localFileModifiedLastDate) => {
        lookupFileType(`public/${filePath}`).then((fileType) => {
          const params = {
            Bucket: bucketName,
            Key: filePath,
            Body: fs.readFileSync(`public/${filePath}`),
            ContentType: fileType,
            Metadata: {
              'Last-Modified': localFileModifiedLastDate.toString(),
            },
          };
          uploadObj(params, s3, 0)
            .then((fileName) => {
              if (verboseMode) {
                // eslint-disable-next-line no-console
                console.log(chalk.green(`Successfully uploaded ${fileName} to ${bucketName}`));
              }
              itemsProcessed++;

              if (itemsProcessed === nextIncrement) {
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
                } else resolve("Upload complete!");
              }
            })
            .catch((e) => {
              reject(e);
            });
        }).catch((e) => {
          reject(e)
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
        hasFileChanged(bucketPath, bucketName, s3)
          .then((hasChanged) => {
            if (hasChanged) {
              changedFiles.push(bucketPath);
            }
            testedFiles++;

            if (testedFiles === fileListLength) {
              if (changedFiles.length > 0) {
                // eslint-disable-next-line no-console
                console.log(chalk.yellow(`${fileListLength} objects found, ${changedFiles.length} objects require updates...`));
                uploadFiles(changedFiles, bucketName, verboseMode, isCli)
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
