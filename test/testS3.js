/* eslint-disable no-underscore-dangle */
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');

const should = chai.should();
const sinon = require('sinon');
chai.use(require('chai-as-promised'));

describe('s3.js [Unit]', () => {
  describe('#getFileLastModifiedDate', () => {
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

  describe('#uploadObj', () => {
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
  });

  describe('#hasFileChanged', () => {
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

          const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);

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
          await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFnSpy);
          // eslint-disable-next-line no-unused-expressions
          fileModifiedCheckFnSpy.calledWith('public/foo.txt').should.be.ok;
        });

        it('should resolve to true', async () => {
          const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFnSpy);
          actual.should.equal(true);
        });
      });

      describe('and last modified date is not available for remote file', () => {
        it('should resolve to true (in order to instigate an upload', async () => {
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

          const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);

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

        const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);
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

        function fileModifiedCheckFn() {
          return new Promise((resolve) => {
            resolve(new Date('2017-09-12T15:48:06.228Z'));
          });
        }

        try {
          await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);
          'I'.should.equal('Me');
        } catch (e) {
          e.should.equal(errorRes);
        }
      });
    });
  });
});
