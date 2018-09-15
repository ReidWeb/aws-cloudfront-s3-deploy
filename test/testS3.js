/* eslint-disable no-underscore-dangle */
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');

const should = chai.should();
const sinon = require('sinon');
chai.use(require('chai-as-promised'));

describe('s3.js [Unit]', () => {
  describe('#getFileLastModifiedDate()', () => {
    it('should resolve the last modified date when the meta-data is available', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const time = '2014-09-12T15:48:06.228Z';
      const fsMock = {
        stat(path, cb) {
          cb(null, { mtime: time });
        },
      };

      s3.__set__({ fs: fsMock });

      const lastModified = await getFileLastModifiedDate('package.json');
      lastModified.should.equal(time);
    });

    it('should resolve to `false` when the meta-data is non existant', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const fsMock = {
        stat(path, cb) {
          cb(null, {});
        },
      };

      s3.__set__({ fs: fsMock });

      const actual = await getFileLastModifiedDate('package.json');
      actual.should.equal(false);
    });

    it('should resolve to `false` when the meta-data is an empty string', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const fsMock = {
        stat(path, cb) {
          cb(null, { mtime: '' });
        },
      };

      s3.__set__({ fs: fsMock });

      const actual = await getFileLastModifiedDate('package.json');
      actual.should.equal(false);
    });
  });

  describe('#uploadObj()', () => {
    it('should resolve the object key upon a successful upload', async () => {
      const s3 = rewire('../src/s3');
      const uploadObj = s3.__get__('uploadObj');

      const s3ClientMock = {
        putObject(params, cb) {
          cb(null, {});
        },
      };

      const actual = await uploadObj({ Key: 'hiThere' }, s3ClientMock, 0);

      actual.should.equal('hiThere');
    });

    it('should reject with an error after multiple failed uploads', async () => {
      const s3 = rewire('../src/s3');
      const uploadObj = s3.__get__('uploadObj');

      const s3ClientMock = {
        putObject(params, cb) {
          cb(new Error('Generic error'), {});
        },
      };

      try {
        await uploadObj({ Key: 'foo' }, s3ClientMock, 4);
        'I'.should.equal('Me');
      } catch (e) {
        e.message.should.equal('Error: Unable to process object foo, reattempted for 5 (MAX)');
      }
    });

    it('should reject immediately with an error if a fatal error occurs', async () => {
      const s3 = rewire('../src/s3');
      const uploadObj = s3.__get__('uploadObj');

      const s3ClientMock = {
        putObject(params, cb) {
          cb({ code: 'BadRequest' }, {});
        },
      };

      const handleAwsErrStub = sinon.stub();
      handleAwsErrStub.returns({ shouldCauseTermination: true, message: 'Fatal error' });
      const commonMock = {
        handleAwsError: handleAwsErrStub,
      };
      s3.__set__({ common: commonMock });

      try {
        await uploadObj({ Key: 'foo' }, s3ClientMock, 4);
        'I'.should.equal('Me');
      } catch (e) {
        e.message.should.equal('Fatal error');
      }
    });
  });

  describe('#hasFileChanged()', () => {
    describe('when file already exists in S3', () => {
      describe('and last modified dates do not match', () => {
        it('should resolve to false', async () => {
          const s3 = rewire('../src/s3');
          const hasFileChanged = s3.__get__('hasFileChanged');
          const res = {
            Metadata: {
              'last-modified': '2017-09-12T15:48:06.228Z',
            },
          };

          const s3ClientMock = {
            headObject(params, cb) {
              cb(null, res);
            },
          };

          function fileModifiedCheckFn() {
            return new Promise((resolve) => {
              resolve(new Date('2017-09-12T15:48:06.228Z'));
            });
          }

          const actual = await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);

          actual.should.equal(false);
        });
      });

      describe('and last modified dates match', () => {
        const s3 = rewire('../src/s3');
        const hasFileChanged = s3.__get__('hasFileChanged');
        const res = {
          Metadata: {
            'last-modified': '2017-09-12T15:48:06.228Z',
          },
        };

        const s3ClientMock = {
          headObject(params, cb) {
            cb(null, res);
          },
        };

        function fileModifiedCheckFn() {
          return new Promise((resolve) => {
            resolve(new Date('2007-09-12T15:48:06.228Z'));
          });
        }

        const fileModifiedCheckFnSpy = sinon.spy(fileModifiedCheckFn);

        it('`hasFileChanged(..)` should be called with the correct arguments', async () => {
          await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFnSpy);
          // eslint-disable-next-line no-unused-expressions
          fileModifiedCheckFnSpy.calledWith('path/to/foo.txt').should.be.ok;
        });

        it('should resolve to true', async () => {
          const actual = await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFnSpy);
          actual.should.equal(true);
        });
      });

      describe('and last modified date is not available for remote file', () => {
        it('should resolve to true (in order to instigate an upload)', async () => {
          const s3 = rewire('../src/s3');
          const hasFileChanged = s3.__get__('hasFileChanged');
          const res = {
            Metadata: {},
          };

          const s3ClientMock = {
            headObject(params, cb) {
              cb(null, res);
            },
          };

          function fileModifiedCheckFn() {
            return new Promise((resolve) => {
              resolve(new Date('2017-09-12T15:48:06.228Z'));
            });
          }

          const actual = await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);

          actual.should.equal(true);
        });
      });
    });

    describe('when file does not already exist in S3', () => {
      it('should resolve to true (in order to instigate an upload)', async () => {
        const s3 = rewire('../src/s3');
        const hasFileChanged = s3.__get__('hasFileChanged');
        const errorRes = {
          code: 'NotFound',
        };

        const s3ClientMock = {
          headObject(params, cb) {
            cb(errorRes, {});
          },
        };

        function fileModifiedCheckFn() {
          return new Promise((resolve) => {
            resolve(new Date('2017-09-12T15:48:06.228Z'));
          });
        }

        const actual = await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);
        actual.should.equal(true);
      });
    });

    describe('when a error is encountered getting the object from S3', () => {
      it('should reject with the error', async () => {
        const s3 = rewire('../src/s3');
        const hasFileChanged = s3.__get__('hasFileChanged');
        const errorRes = {
          code: 'AnyErrorButNotFound',
        };

        const s3ClientMock = {
          headObject(params, cb) {
            cb(errorRes, {});
          },
        };

        const handleAwsErrStub = sinon.stub();
        handleAwsErrStub.returns(errorRes);
        const commonMock = {
          handleAwsError: handleAwsErrStub,
        };
        s3.__set__({ common: commonMock });

        function fileModifiedCheckFn() {
          return new Promise((resolve) => {
            resolve(new Date('2017-09-12T15:48:06.228Z'));
          });
        }

        try {
          await hasFileChanged('path/to', 'foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);
          'I'.should.equal('Me');
        } catch (e) {
          e.should.equal(errorRes);
        }
      });
    });
  });

  describe('#lookupFileType()', () => {
    it('should resolve the file type when the filetype as an associated mime type', async () => {
      const s3 = rewire('../src/s3');
      const lookupFileType = s3.__get__('lookupFileType');

      const mimeMock = {
        lookup() {
          return 'application/json';
        },
      };

      s3.__set__({ mime: mimeMock });

      const actual = await lookupFileType('imaginary.json');
      actual.should.equal('application/json');
    });

    it('should resolve to `application/octet-stream` when the filetype has no associated mime type', async () => {
      const s3 = rewire('../src/s3');
      const lookupFileType = s3.__get__('lookupFileType');

      const mimeMock = {
        lookup() {
          return null;
        },
      };

      s3.__set__({ mime: mimeMock });

      const actual = await lookupFileType('_headers');
      actual.should.equal('application/octet-stream');
    });

    describe('when an error is encountered looking up the mime type', () => {
      it('should reject with error', async () => {
        const s3 = rewire('../src/s3');
        const lookupFileType = s3.__get__('lookupFileType');

        const mimeMock = {
          lookup() {
            throw (new Error("Hi i'm a generic error!"));
          },
        };

        s3.__set__({ mime: mimeMock });

        try {
          await lookupFileType('a');
          'I'.should.equal('not invoked');
        } catch (e) {
          e.message.should.equal("Hi i'm a generic error!");
        }
      });
    });
  });

  describe('#uploadFiles()', () => {
    describe('when program is being run from CLI', async () => {
      it('then the progress bar should be created', async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');

        let constructorCallCount = 0;

        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
            constructorCallCount++;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.resolves('text/yaml');
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.resolves('anything.txt');
        s3.__set__('uploadObj', uploadObjStub);


        const dummyArr = [];
        let i;
        for (i = 0; i < 2; i++) {
          dummyArr[i] = `foo${i}.txt`;
        }
        await uploadFiles('path/to', dummyArr, 'yourBucket', { cli: true });
        constructorCallCount.should.equal(1);
      });
    });

    describe('when verbose mode is turned on', () => {
      it('then log statements should be output with progress', async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');


        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.resolves('text/yaml');
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.resolves('anything.txt');
        s3.__set__('uploadObj', uploadObjStub);


        const logSpy = sinon.spy();
        const consoleMock = {
          log: logSpy,
        };
        s3.__set__({ console: consoleMock });

        const dummyArr = [];
        let i;
        for (i = 0; i < 9; i++) {
          dummyArr[i] = `foo${i}.txt`;
        }
        await uploadFiles('path/to', dummyArr, 'yourBucket', { cli: false, verbose: true });
        (logSpy.callCount).should.equal(9);
      });
    });

    describe('when parameters are supplied to `uploadObj` function', () => {
      let interceptedArgs;
      before(async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');


        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.resolves('text/yaml');
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.resolves('anything.txt');
        s3.__set__('uploadObj', uploadObjStub);


        const consoleMock = {
          log() {},
        };
        s3.__set__({ console: consoleMock });

        await uploadFiles('path/to', ['foo.txt'], 'yourBucket');
        const invocationOne = uploadObjStub.getCall(0);
        // eslint-disable-next-line prefer-destructuring
        interceptedArgs = invocationOne.args[0];
      });

      it('then Key should omit target directory', async () => {
        interceptedArgs.Key.should.equal('foo.txt');
      });

      it('then Body should equal that of the file in the target directory', async () => {
        interceptedArgs.Body.should.equal('dummy data');
      });

      it('then Last-Modified meta-data should be correctly set to an ISO time string', async () => {
        interceptedArgs.Metadata['Last-Modified'].should.equal('2016-09-12T15:48:06.228Z');
      });

      it('then the content type should correctly be set', async () => {
        interceptedArgs.ContentType.should.equal('text/yaml');
      });
    });

    describe('when the file type of the file is looked up', () => {
      it('it should be the local file path that is used, not the remote file path', async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');


        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.resolves('text/yaml');
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.resolves('anything.txt');
        s3.__set__('uploadObj', uploadObjStub);


        const consoleMock = {
          log() {},
        };
        s3.__set__({ console: consoleMock });

        await uploadFiles('path/to', ['foo.txt'], 'yourBucket');
        sinon.assert.calledWith(lookupFileTypeStub, 'path/to/foo.txt');
      });

      it('it should reject with an error when an error is encountered', async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');


        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.rejects(new Error('An error'));
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.resolves('anything.txt');
        s3.__set__('uploadObj', uploadObjStub);


        const consoleMock = {
          log() {},
        };
        s3.__set__({ console: consoleMock });

        try {
          await uploadFiles('path/to', ['foo.txt'], 'yourBucket');
          'I'.should.equal('Not be called');
        } catch (e) {
          e.message.should.equal('An error');
        }
      });
    });

    describe('when an error is encountered uploading the file', () => {
      it('should reject with error', async () => {
        const s3 = rewire('../src/s3');
        const uploadFiles = s3.__get__('uploadFiles');


        class ProgressBarMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
            this.total = 60;
            this.curr = 0;
          }

          tick() {
            this.curr++;
          }
        }
        sinon.stub(ProgressBarMock.prototype, 'constructor');

        s3.__set__({ ProgressBar: ProgressBarMock });

        const getFileLastModifiedDateStub = sinon.stub();
        getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
        s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

        const lookupFileTypeStub = sinon.stub();
        lookupFileTypeStub.resolves('text/yaml');
        s3.__set__('lookupFileType', lookupFileTypeStub);

        const fsMock = {
          readFileSync() {
            return 'dummy data';
          },
        };
        s3.__set__({ fs: fsMock });

        const uploadObjStub = sinon.stub();
        uploadObjStub.rejects(new Error('upload error'));
        s3.__set__('uploadObj', uploadObjStub);


        const consoleMock = {
          log() {},
        };
        s3.__set__({ console: consoleMock });

        try {
          await uploadFiles('path/to', ['foo.txt'], 'yourBucket');
          'I'.should.not.equal('be called');
        } catch (e) {
          e.message.should.equal('upload error');
        }
      });
    });

    describe('when all files have been successfully uploaded', () => {
      describe('and program is not being run from CLI', () => {
        it('then the progress bar should never have been incremented', async () => {
          const s3 = rewire('../src/s3');
          const uploadFiles = s3.__get__('uploadFiles');

          let tickCallCount = 0;
          class ProgressBarMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
              this.total = 60;
              this.curr = 0;
            }

            tick() {
              this.curr++;
              tickCallCount++;
            }
          }
          sinon.stub(ProgressBarMock.prototype, 'constructor');

          s3.__set__({ ProgressBar: ProgressBarMock });

          const getFileLastModifiedDateStub = sinon.stub();
          getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
          s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

          const lookupFileTypeStub = sinon.stub();
          lookupFileTypeStub.resolves('text/yaml');
          s3.__set__('lookupFileType', lookupFileTypeStub);

          const fsMock = {
            readFileSync() {
              return 'dummy data';
            },
          };
          s3.__set__({ fs: fsMock });

          const uploadObjStub = sinon.stub();
          uploadObjStub.resolves('anything.txt');
          s3.__set__('uploadObj', uploadObjStub);


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const dummyArr = [];
          let i;
          for (i = 0; i < 100; i++) {
            dummyArr[i] = `foo${i}.txt`;
          }
          await uploadFiles('path/to', dummyArr, 'yourBucket');
          tickCallCount.should.equal(0);
        });

        it('should resolve with `Upload complete!`', async () => {
          const s3 = rewire('../src/s3');
          const uploadFiles = s3.__get__('uploadFiles');

          class ProgressBarMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
              this.total = 60;
              this.curr = 0;
            }

            tick() {
              this.curr++;
            }
          }
          sinon.stub(ProgressBarMock.prototype, 'constructor');

          s3.__set__({ ProgressBar: ProgressBarMock });

          const getFileLastModifiedDateStub = sinon.stub();
          getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
          s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

          const lookupFileTypeStub = sinon.stub();
          lookupFileTypeStub.resolves('text/yaml');
          s3.__set__('lookupFileType', lookupFileTypeStub);

          const fsMock = {
            readFileSync() {
              return 'dummy data';
            },
          };
          s3.__set__({ fs: fsMock });

          const uploadObjStub = sinon.stub();
          uploadObjStub.resolves('anything.txt');
          s3.__set__('uploadObj', uploadObjStub);


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const dummyArr = [];
          let i;
          for (i = 0; i < 100; i++) {
            dummyArr[i] = `foo${i}.txt`;
          }
          const actual = await uploadFiles('path/to', dummyArr, 'yourBucket');
          actual.should.equal('Upload complete!');
        });
      });

      describe('and program is being run from CLI', () => {
        it('then the progress bar should have been incremented successfully', async () => {
          const s3 = rewire('../src/s3');
          const uploadFiles = s3.__get__('uploadFiles');

          let tickCallCount = 0;
          class ProgressBarMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
              this.total = 60;
              this.curr = 0;
            }

            tick() {
              this.curr++;
              tickCallCount++;
            }
          }
          sinon.stub(ProgressBarMock.prototype, 'constructor');

          s3.__set__({ ProgressBar: ProgressBarMock });

          const getFileLastModifiedDateStub = sinon.stub();
          getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
          s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

          const lookupFileTypeStub = sinon.stub();
          lookupFileTypeStub.resolves('text/yaml');
          s3.__set__('lookupFileType', lookupFileTypeStub);

          const fsMock = {
            readFileSync() {
              return 'dummy data';
            },
          };
          s3.__set__({ fs: fsMock });

          const uploadObjStub = sinon.stub();
          uploadObjStub.resolves('anything.txt');
          s3.__set__('uploadObj', uploadObjStub);


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const dummyArr = [];
          let i;
          for (i = 0; i < 100; i++) {
            dummyArr[i] = `foo${i}.txt`;
          }
          await uploadFiles('path/to', dummyArr, 'yourBucket', { cli: true });
          tickCallCount.should.equal(61);
        });

        it('should resolve with `Upload complete!`', async () => {
          const s3 = rewire('../src/s3');
          const uploadFiles = s3.__get__('uploadFiles');

          class ProgressBarMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
              this.total = 60;
              this.curr = 0;
            }

            tick() {
              this.curr++;
            }
          }
          sinon.stub(ProgressBarMock.prototype, 'constructor');

          s3.__set__({ ProgressBar: ProgressBarMock });

          const getFileLastModifiedDateStub = sinon.stub();
          getFileLastModifiedDateStub.resolves(new Date('2016-09-12T15:48:06.228Z'));
          s3.__set__('getFileLastModifiedDate', getFileLastModifiedDateStub);

          const lookupFileTypeStub = sinon.stub();
          lookupFileTypeStub.resolves('text/yaml');
          s3.__set__('lookupFileType', lookupFileTypeStub);

          const fsMock = {
            readFileSync() {
              return 'dummy data';
            },
          };
          s3.__set__({ fs: fsMock });

          const uploadObjStub = sinon.stub();
          uploadObjStub.resolves('anything.txt');
          s3.__set__('uploadObj', uploadObjStub);


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const dummyArr = [];
          let i;
          for (i = 0; i < 100; i++) {
            dummyArr[i] = `foo${i}.txt`;
          }
          const actual = await uploadFiles('path/to', dummyArr, 'yourBucket');
          actual.should.equal('Upload complete!');
        });
      });
    });
  });

  describe('#uploadChangedFilesInDir()', () => {
    describe('when there are files at the specified path', () => {
      describe('when no files have changed', () => {
        it('should resolve to object with property message indicating no file updates were required', async () => {
          const s3 = rewire('../src/s3');
          const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

          const recursiveStub = sinon.stub();
          recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
          s3.__set__('recursive', recursiveStub);

          const bucketName = 'myBucket';

          const hasFileChangedStub = sinon.stub();
          hasFileChangedStub.withArgs('base', 'foo.txt', bucketName, sinon.match.any, sinon.match.any).resolves(false);
          hasFileChangedStub.withArgs('base', 'bar.yml', bucketName, sinon.match.any, sinon.match.any).resolves(false);
          hasFileChangedStub.withArgs('base', 'path/to/hello.json', bucketName, sinon.match.any, sinon.match.any).resolves(false);

          s3.__set__('hasFileChanged', hasFileChangedStub);

          const actual = await uploadChangedFilesInDir('base', bucketName);

          actual.message.should.equal('No file updates required, skipping upload...');
        });

        it('should resolve to object property `changedFiles` that should be an empty array', async () => {
          const s3 = rewire('../src/s3');
          const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

          const recursiveStub = sinon.stub();
          recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
          s3.__set__('recursive', recursiveStub);

          const bucketName = 'myBucket';

          const hasFileChangedStub = sinon.stub();
          hasFileChangedStub.withArgs('base', 'foo.txt', bucketName, sinon.match.any, sinon.match.any).resolves(false);
          hasFileChangedStub.withArgs('base', 'bar.yml', bucketName, sinon.match.any, sinon.match.any).resolves(false);
          hasFileChangedStub.withArgs('base', 'path/to/hello.json', bucketName, sinon.match.any, sinon.match.any).resolves(false);

          s3.__set__('hasFileChanged', hasFileChangedStub);

          const actual = await uploadChangedFilesInDir('base', bucketName);

          actual.changedFiles.length.should.equal(0);
        });
      });

      describe('when files have changed', () => {
        describe('should instigate the upload of the changed files and should resolve an object where', () => {
          it('the files changed are stored to property `changedFiles`', async () => {
            const s3 = rewire('../src/s3');
            const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

            const recursiveStub = sinon.stub();
            recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
            s3.__set__('recursive', recursiveStub);

            const bucketName = 'myBucket';

            const consoleMock = {
              log() {},
            };
            s3.__set__({ console: consoleMock });

            const hasFileChangedStub = sinon.stub();
            hasFileChangedStub.withArgs('base', 'foo.txt', bucketName, sinon.match.any, sinon.match.any).resolves(true);
            hasFileChangedStub.withArgs('base', 'bar.yml', bucketName, sinon.match.any, sinon.match.any).resolves(false);
            hasFileChangedStub.withArgs('base', 'path/to/hello.json', bucketName, sinon.match.any, sinon.match.any).resolves(true);

            s3.__set__('hasFileChanged', hasFileChangedStub);

            const uploadFilesStub = sinon.stub();
            uploadFilesStub.resolves('Mock Upload complete!');

            s3.__set__('uploadFiles', uploadFilesStub);

            const actual = await uploadChangedFilesInDir('base', bucketName);
            actual.changedFiles.should.contain('path/to/hello.json');
            actual.changedFiles.should.contain('foo.txt');
            actual.changedFiles.should.not.contain('bar.yml');
          });

          it('the success message from `uploadFiles` is stored to property `message`', async () => {
            const s3 = rewire('../src/s3');
            const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

            const recursiveStub = sinon.stub();
            recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
            s3.__set__('recursive', recursiveStub);

            const bucketName = 'myBucket';

            const consoleMock = {
              log() {},
            };
            s3.__set__({ console: consoleMock });

            const hasFileChangedStub = sinon.stub();
            hasFileChangedStub.withArgs('base', 'foo.txt', bucketName, sinon.match.any, sinon.match.any).resolves(true);
            hasFileChangedStub.withArgs('base', 'bar.yml', bucketName, sinon.match.any, sinon.match.any).resolves(false);
            hasFileChangedStub.withArgs('base', 'path/to/hello.json', bucketName, sinon.match.any, sinon.match.any).resolves(true);

            s3.__set__('hasFileChanged', hasFileChangedStub);

            const uploadFilesStub = sinon.stub();
            uploadFilesStub.resolves('Mock Upload complete!');

            s3.__set__('uploadFiles', uploadFilesStub);

            const actual = await uploadChangedFilesInDir('base', bucketName);
            actual.message.should.equal('Mock Upload complete!');
          });
        });
      });

      describe('when a complete re-upload is requested', () => {
        describe('should instigate the upload of all files and should resolve an object where', () => {
          it('the files updated are stored to property `changedFiles`', async () => {
            const s3 = rewire('../src/s3');
            const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

            const recursiveStub = sinon.stub();
            recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
            s3.__set__('recursive', recursiveStub);

            const bucketName = 'myBucket';

            const consoleMock = {
              log() {},
            };
            s3.__set__({ console: consoleMock });

            const hasFileChangedStub = sinon.spy();

            s3.__set__('hasFileChanged', hasFileChangedStub);

            const uploadFilesStub = sinon.stub();
            uploadFilesStub.resolves('Mock Upload complete!');

            s3.__set__('uploadFiles', uploadFilesStub);

            const actual = await uploadChangedFilesInDir('base', bucketName, { reuploadAll: true });
            actual.changedFiles.should.contain('path/to/hello.json');
            actual.changedFiles.should.contain('foo.txt');
            actual.changedFiles.should.contain('bar.yml');
            sinon.assert.notCalled(hasFileChangedStub);
          });

          it('the success message from `uploadFiles` is stored to property `message`', async () => {
            const s3 = rewire('../src/s3');
            const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

            const recursiveStub = sinon.stub();
            recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
            s3.__set__('recursive', recursiveStub);

            const bucketName = 'myBucket';

            const consoleMock = {
              log() {},
            };
            s3.__set__({ console: consoleMock });

            const hasFileChangedStub = sinon.spy();

            s3.__set__('hasFileChanged', hasFileChangedStub);

            const uploadFilesStub = sinon.stub();
            uploadFilesStub.resolves('Mock Upload complete!');

            s3.__set__('uploadFiles', uploadFilesStub);

            const actual = await uploadChangedFilesInDir('base', bucketName, { reuploadAll: true });
            actual.message.should.equal('Mock Upload complete!');
          });
        });
      });

      describe('when an error occurs checking if a file has changed', () => {
        it('should reject with an error', async () => {
          const s3 = rewire('../src/s3');
          const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

          const recursiveStub = sinon.stub();
          recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
          s3.__set__('recursive', recursiveStub);

          const bucketName = 'myBucket';

          const hasFileChangedStub = sinon.stub();
          hasFileChangedStub.rejects(new Error('my home made error'));

          s3.__set__('hasFileChanged', hasFileChangedStub);

          try {
            await uploadChangedFilesInDir('base', bucketName);
            'i'.should.equal('not invoked');
          } catch (e) {
            e.message.should.equal('my home made error');
          }
        });
      });

      describe('when an error occurs uploading the files', () => {
        it('should reject with an error when uploading changed files', async () => {
          const s3 = rewire('../src/s3');
          const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

          const recursiveStub = sinon.stub();
          recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
          s3.__set__('recursive', recursiveStub);

          const bucketName = 'myBucket';


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const hasFileChangedStub = sinon.stub();
          hasFileChangedStub.withArgs('base', 'foo.txt', bucketName, sinon.match.any, sinon.match.any).resolves(true);
          hasFileChangedStub.withArgs('base', 'bar.yml', bucketName, sinon.match.any, sinon.match.any).resolves(false);
          hasFileChangedStub.withArgs('base', 'path/to/hello.json', bucketName, sinon.match.any, sinon.match.any).resolves(true);

          s3.__set__('hasFileChanged', hasFileChangedStub);

          const uploadFilesStub = sinon.stub();
          uploadFilesStub.rejects(new Error('mocked error uploading!'));

          s3.__set__('uploadFiles', uploadFilesStub);

          try {
            await uploadChangedFilesInDir('base', bucketName);
            'i'.should.equal('not invoked');
          } catch (e) {
            e.message.should.equal('mocked error uploading!');
          }
        });

        it('should reject with an error when uploading all files', async () => {
          const s3 = rewire('../src/s3');
          const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

          const recursiveStub = sinon.stub();
          recursiveStub.yields(null, ['base/foo.txt', 'base/bar.yml', 'base/path/to/hello.json']);
          s3.__set__('recursive', recursiveStub);

          const bucketName = 'myBucket';


          const consoleMock = {
            log() {},
          };
          s3.__set__({ console: consoleMock });

          const hasFileChangedStub = sinon.stub();

          s3.__set__('hasFileChanged', hasFileChangedStub);

          const uploadFilesStub = sinon.stub();
          uploadFilesStub.rejects(new Error('mocked error uploading!'));

          s3.__set__('uploadFiles', uploadFilesStub);

          try {
            await uploadChangedFilesInDir('base', bucketName, { reuploadAll: true });
            'i'.should.equal('not invoked');
          } catch (e) {
            e.message.should.equal('mocked error uploading!');
          }
        });
      });
    });

    describe('when there are no files at the specified path', () => {
      it('should resolve with a message stating that it could not find any files', async () => {
        const s3 = rewire('../src/s3');
        const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

        const recursiveStub = sinon.stub();
        recursiveStub.yields(null, []);
        s3.__set__('recursive', recursiveStub);

        const actual = await uploadChangedFilesInDir('base', 'myBucket');
        actual.message.should.equal('No files found at specified path');
      });
    });

    describe('when there is an un-handled error recursively processing the specified path', () => {
      it('should reject with error', async () => {
        const s3 = rewire('../src/s3');
        const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

        const recursiveStub = sinon.stub();
        recursiveStub.yields(new Error('Generic error message'), null);
        s3.__set__('recursive', recursiveStub);

        try {
          await uploadChangedFilesInDir('base', 'myBucket');
          'I'.should.equal('not called');
        } catch (e) {
          e.message.should.equal('Generic error message');
        }
      });
    });

    describe('when the directory specified does not exist', () => {
      it('should reject with a descript error', async () => {
        const s3 = rewire('../src/s3');
        const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

        const recursiveStub = sinon.stub();
        recursiveStub.yields({ code: 'ENOTDIR' }, null);
        s3.__set__('recursive', recursiveStub);

        try {
          await uploadChangedFilesInDir('base', 'myBucket');
          'I'.should.equal('not called');
        } catch (e) {
          e.message.should.equal('Specified path is not a directory, please specify a valid directory path - this module cannot process individual files');
        }
      });
    });

    describe('when the directory specified is not a directory', () => {
      it('should reject with a descript error', async () => {
        const s3 = rewire('../src/s3');
        const uploadChangedFilesInDir = s3.__get__('uploadChangedFilesInDir');

        const recursiveStub = sinon.stub();
        recursiveStub.yields({ code: 'ENOENT' }, null);
        s3.__set__('recursive', recursiveStub);

        try {
          await uploadChangedFilesInDir('base', 'myBucket');
          'I'.should.equal('not called');
        } catch (e) {
          e.message.should.equal('Specified path does not exist. Please specify a valid directory path.');
        }
      });
    });
  });
});
