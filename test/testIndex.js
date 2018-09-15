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
/* eslint-disable no-underscore-dangle */
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');

const should = chai.should();

describe('index.js [Unit]', () => {
  describe('#validateParams()', () => {
    const index = rewire('../src/index');

    const validateParams = index.__get__('validateParams');

    describe('when authentication object is provided', () => {
      describe('and keyId is provided', () => {
        describe('and profile is also provided', () => {
          it('should reject with an error', async () => {
            const testObj = {};
            testObj.authentication = {};
            testObj.authentication.keyId = 'my key';
            testObj.authentication.profile = 'my profile';
            try {
              await validateParams(testObj);
              'i'.should.not.equal('pass');
            } catch (e) {
              e.message.should.equal('Two methods of authentication supplied, please remove either keyId/accessKey or profile from the params.authentication block.');
            }
          });
        });
        describe('and accessKey is not provided', () => {
          it('should reject with an error', async () => {
            const testObj = {};
            testObj.authentication = {};
            testObj.authentication.keyId = 'my key id';
            try {
              await validateParams(testObj);
              'i'.should.not.equal('pass');
            } catch (e) {
              e.message.should.equal('`keyId` has been provided, but `accessKey` has not. Please add your `accessKey` and try again.');
            }
          });
        });
        describe('and accessKey is provided', () => {
          it('should resolve', async () => {
            const testObj = {};
            testObj.authentication = {};
            testObj.authentication.keyId = 'my key id';
            testObj.authentication.accessKey = 'my key';
            const actual = await validateParams(testObj);
            actual.should.equal(true);
          });
        });
      });

      describe('and accessKey is provided', () => {
        describe('and profile is also provided', () => {
          it('should reject with an error', async () => {
            const testObj = {};
            testObj.authentication = {};
            testObj.authentication.accessKey = 'my key';
            testObj.authentication.profile = 'my profile';
            try {
              await validateParams(testObj);
              'i'.should.not.equal('pass');
            } catch (e) {
              e.message.should.equal('Two methods of authentication supplied, please remove either keyId/accessKey or profile from the params.authentication block.');
            }
          });
        });
      });

      describe('and profile alone is provided', () => {
        it('should resolve', async () => {
          const testObj = {};
          testObj.authentication = {};
          testObj.authentication.profile = 'my profile';
          const actual = await validateParams(testObj);
          actual.should.equal(true);
        });
      });
    });
  });

  describe('#setAwsConfig()', () => {
    describe('when using access key auth', () => {
      it('should set accessKey correctly', async () => {
        const index = rewire('../src/index');
        const setAwsConfig = index.__get__('setAwsConfig');
        const AWS = index.__get__('AWS');
        setAwsConfig({ authentication: { keyId: 'foo', accessKey: 'bar' } });
        AWS.config.secretAccessKey.should.equal('bar');
      });

      it('should set keyId correctly', async () => {
        const index = rewire('../src/index');
        const setAwsConfig = index.__get__('setAwsConfig');
        const AWS = index.__get__('AWS');
        setAwsConfig({ authentication: { keyId: 'foo', accessKey: 'bar' } });
        AWS.config.accessKeyId.should.equal('foo');
      });
    });

    describe('when using profile based auth', () => {
      it('should set credentials obj correctly', async () => {
        const index = rewire('../src/index');
        const setAwsConfig = index.__get__('setAwsConfig');
        const AWS = index.__get__('AWS');
        setAwsConfig({ authentication: { profile: 'foo b' } });
        AWS.config.credentials.profile.should.equal('foo b');
      });
    });

    describe('when specifying region', () => {
      it('should region correctly', async () => {
        const index = rewire('../src/index');
        const setAwsConfig = index.__get__('setAwsConfig');
        const AWS = index.__get__('AWS');
        setAwsConfig({ region: 'eu-central-1' });
        AWS.config.region.should.equal('eu-central-1');
      });
    });
  });

  describe('#deploy()', () => {
    describe('when uploading the files to s3', () => {
      describe('and the upload is successful', () => {
        const index = rewire('../src/index');
        const deploy = index.__get__('deploy');

        const setAwsConfigStub = sinon.stub();
        index.__set__('setAwsConfig', setAwsConfigStub);

        const isAbsoluteStub = sinon.stub();
        isAbsoluteStub.withArgs('myProj').returns(false);
        isAbsoluteStub.withArgs('/Users/joebloggs/path').returns(true);

        const resolveStub = sinon.stub();
        resolveStub.withArgs('myProj').returns('/Users/joebloggs/myProj');

        const pathStub = {
          isAbsolute: isAbsoluteStub,
          resolve: resolveStub,
        };

        index.__set__({ path: pathStub });
        const logStub = sinon.stub();

        const consoleMock = {
          log: logStub,
        };
        index.__set__({ console: consoleMock });

        const uploadChangedFilesInDirStub = sinon.stub();
        uploadChangedFilesInDirStub.resolves({ changedFiles: ['myFile.txt', 'yourFile.json'], message: 'a message' });

        const s3Stub = {
          uploadChangedFilesInDir: uploadChangedFilesInDirStub,
        };

        index.__set__({ s3: s3Stub });

        describe('and a cloudfront invalidation is not being run', () => {
          it('should resolve the result of the S3 upload', async () => {
            const result = await deploy('path', 'bucket');
            result.message.should.equal('a message');
          });
        });

        describe('and a cloudfront invalidation is being run', () => {
          describe('and the invalidation is successful', () => {
            it('should resolve the result of invalidation', async () => {
              const successfulInvalidationStub = sinon.stub();
              successfulInvalidationStub.resolves({ changedFiles: ['foo.txt', 'file.json'], invalidationId: 'bar', message: 'Hello' });
              index.__set__({ cloudFront: { invalidateDistribution: successfulInvalidationStub } });

              const result = await deploy('path', 'bucket', { distribution: { id: 'foo' } });
              result.message.should.equal('Hello');
            });
          });

          describe('and the invalidation experiences an error', () => {
            it('should reject with an error', async () => {
              const successfulInvalidationStub = sinon.stub();
              successfulInvalidationStub.rejects({ message: 'error occurred' });
              index.__set__({ cloudFront: { invalidateDistribution: successfulInvalidationStub } });

              try {
                await deploy('path', 'bucket', { distribution: { id: 'foo' } });
                'i'.should.equal('bar');
              } catch (e) {
                e.message.should.equal('error occurred');
              }
            });
          });
        });
      });

      describe('and the upload experiences an error', () => {
        const index = rewire('../src/index');
        const deploy = index.__get__('deploy');

        const setAwsConfigStub = sinon.stub();
        index.__set__('setAwsConfig', setAwsConfigStub);

        const isAbsoluteStub = sinon.stub();
        isAbsoluteStub.withArgs('myProj').returns(false);
        isAbsoluteStub.withArgs('/Users/joebloggs/path').returns(true);

        const resolveStub = sinon.stub();
        resolveStub.withArgs('myProj').returns('/Users/joebloggs/myProj');

        const pathStub = {
          isAbsolute: isAbsoluteStub,
          resolve: resolveStub,
        };

        index.__set__({ path: pathStub });
        const logStub = sinon.stub();

        const consoleMock = {
          log: logStub,
        };
        index.__set__({ console: consoleMock });

        const uploadChangedFilesInDirStub = sinon.stub();
        uploadChangedFilesInDirStub.rejects(new Error('Error encountered'));

        const s3Stub = {
          uploadChangedFilesInDir: uploadChangedFilesInDirStub,
        };

        index.__set__({ s3: s3Stub });
        it('should reject with the error received from s3 client', async () => {
          try {
            await deploy('path', 'bucket');
            'i'.should.equal('me');
          } catch (e) {
            e.message.should.equal('Error encountered');
          }
        });
      });
    });
  });
});
