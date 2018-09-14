/* eslint-disable no-underscore-dangle */
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');

const should = chai.should();

describe('cloudfront.js [Unit]', () => {
  describe('#prefixPaths()', () => {
    it('should prefix a `/` onto the front of every item in the array', async () => {
      const cloudfront = rewire('../src/cloudfront');

      const prefixPaths = cloudfront.__get__('prefixPaths');

      const actual = await prefixPaths(['foo.txt', 'bar.yml']);
      actual.should.contain('/foo.txt');
      actual.should.contain('/bar.yml');
    });
  });

  describe('#invalidateDistribution()', () => {
    describe('when successful', () => {
      it('should resolve with a message containing detail on the invalidation', async () => {
        const cloudfront = rewire('../src/cloudfront');

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
        const msg = await invalidateDistribution('foo', ['/foo.txt,', 'bar.yml']);
        msg.should.equal('Invalidation with ID INVALIDATION_ID has started for 2 changed files!');
      });
    });

    describe('when an error is encountered', () => {
      it('should reject with an error', async () => {
        const cloudfront = rewire('../src/cloudfront');

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
