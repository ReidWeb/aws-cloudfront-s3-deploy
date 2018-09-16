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

describe('cloudfront.js [Unit]', () => {
  describe('#prefixPaths()', () => {
    it('should prefix a `/` onto the front of every item in the array', async () => {
      const cloudfront = rewire('../src/lib/cloudfront');

      const prefixPaths = cloudfront.__get__('prefixPaths');

      const actual = await prefixPaths(['foo.txt', 'bar.yml']);
      actual.should.contain('/foo.txt');
      actual.should.contain('/bar.yml');
    });
  });

  describe('#invalidateDistribution()', () => {
    describe('when successful', () => {
      describe('should resolve with an object', () => {
        it('with message containing detail on the invalidation', async () => {
          const cloudfront = rewire('../src/lib/cloudfront');

          const invalidateDistribution = cloudfront.__get__('invalidateDistribution');

          class CloudFrontMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
            }

            // eslint-disable-next-line class-methods-use-this
            createInvalidation(params, callback) {
              callback(null, { Invalidation: { Id: 'INVALIDATION_ID' } });
            }
          }
          sinon.stub(CloudFrontMock.prototype, 'constructor');

          cloudfront.__set__({ AWS: { CloudFront: CloudFrontMock } });
          const files = ['/foo.txt,', 'bar.yml'];
          const res = await invalidateDistribution('foo', files);
          res.message.should.equal('Invalidation with ID INVALIDATION_ID has started for 2 changed files!');
        });

        it('with key containing files invalidated in the invalidation', async () => {
          const cloudfront = rewire('../src/lib/cloudfront');

          const invalidateDistribution = cloudfront.__get__('invalidateDistribution');

          class CloudFrontMock {
            // eslint-disable-next-line no-empty-function,no-useless-constructor
            constructor() {
            }

            // eslint-disable-next-line class-methods-use-this
            createInvalidation(params, callback) {
              callback(null, { Invalidation: { Id: 'INVALIDATION_ID' } });
            }
          }
          sinon.stub(CloudFrontMock.prototype, 'constructor');

          cloudfront.__set__({ AWS: { CloudFront: CloudFrontMock } });
          const files = ['/foo.txt,', 'bar.yml'];
          const res = await invalidateDistribution('foo', files);
          res.changedFiles.should.equal(files);
        });
      });

      describe('when a complete reupload is requested', () => {
        describe('should resolve with an object', () => {
          it('with message containing detail on the invalidation', async () => {
            const cloudfront = rewire('../src/lib/cloudfront');

            const invalidateDistribution = cloudfront.__get__('invalidateDistribution');

            class CloudFrontMock {
              // eslint-disable-next-line no-empty-function,no-useless-constructor
              constructor() {
              }

              // eslint-disable-next-line class-methods-use-this
              createInvalidation(params, callback) {
                callback(null, { Invalidation: { Id: 'INVALIDATION_ID' } });
              }
            }

            sinon.stub(CloudFrontMock.prototype, 'constructor');

            cloudfront.__set__({ AWS: { CloudFront: CloudFrontMock } });
            const files = ['/foo.txt,', 'bar.yml'];
            const res = await invalidateDistribution('foo', files, { reuploadAll: true });
            res.message.should.equal('Invalidation with ID INVALIDATION_ID has started for 2 changed files!');
          });

          it('with key containing the `*` path used in the invalidation', async () => {
            const cloudfront = rewire('../src/lib/cloudfront');

            const invalidateDistribution = cloudfront.__get__('invalidateDistribution');

            class CloudFrontMock {
              // eslint-disable-next-line no-empty-function,no-useless-constructor
              constructor() {
              }

              // eslint-disable-next-line class-methods-use-this
              createInvalidation(params, callback) {
                callback(null, { Invalidation: { Id: 'INVALIDATION_ID' } });
              }
            }

            sinon.stub(CloudFrontMock.prototype, 'constructor');

            cloudfront.__set__({ AWS: { CloudFront: CloudFrontMock } });
            const files = ['/foo.txt,', 'bar.yml'];
            const res = await invalidateDistribution('foo', files, { reuploadAll: true });
            res.changedFiles.length.should.equal(1);
            res.changedFiles.should.contain('*');
          });
        });
      });
    });

    describe('when an error is encountered', () => {
      it('should reject with an error', async () => {
        const cloudfront = rewire('../src/lib/cloudfront');

        const invalidateDistribution = cloudfront.__get__('invalidateDistribution');

        const errObj = { code: 'AnyCode' };
        class CloudFrontMock {
          // eslint-disable-next-line no-empty-function,no-useless-constructor
          constructor() {
          }

          // eslint-disable-next-line class-methods-use-this
          createInvalidation(params, callback) {
            callback(errObj, null);
          }
        }
        sinon.stub(CloudFrontMock.prototype, 'constructor');

        cloudfront.__set__({ AWS: { CloudFront: CloudFrontMock } });

        const commonMock = {
          handleAwsError() {
            return errObj;
          },
        };

        cloudfront.__set__({ common: commonMock });

        try {
          await invalidateDistribution('foo', ['/foo.txt,', 'bar.yml']);
        } catch (e) {
          e.should.equal(errObj);
        }
      });
    });
  });
});
