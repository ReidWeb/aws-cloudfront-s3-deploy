/* eslint-disable no-underscore-dangle */
/* eslint-env mocha */

const chai = require('chai');
const common = require('../src/common');

const should = chai.should();

describe('common.js [Unit]', () => {
  describe('#handleAwsError()', () => {
    it('should return a message telling users to verify their profile is still valid if `BadRequest` code is received', () => {
      const errorObj = {
        code: 'BadRequest',
      };
      common.handleAwsError(errorObj).message.should.equal('Received BadRequest code from AWS API, please verify that the supplied profile/keys are still valid and have not expired.');
    });

    it('should return a message telling users to verify their profile is still valid if `BadRequest` code is received', () => {
      const errorObj = {
        code: 'AccessDenied',
      };
      common.handleAwsError(errorObj).message.should.equal('You are not permitted to access the resource you attempted to access');
    });

    it('should return a message telling users to verify their profile exists when `CredentialsError` is received', () => {
      const errorObj = {
        message: 'Missing credentials in config',
        code: 'CredentialsError',
        time: '2018-09-14T16:46:03.792Z',
        originalError: {
          message: 'Could not load credentials from SharedIniFileCredentials',
          code: 'CredentialsError',
          time: '2018-09-14T16:46:03.792Z',
          originalError: {
            message: 'Profile reidweb-test not found',
            code: 'SharedIniFileCredentialsProviderFailure',
            time: '2018-09-14T16:46:03.785Z',
          },
        },
      };
      common.handleAwsError(errorObj).message.should.equal('Specified credentials are missing in your ~/.aws/credentials file - Profile reidweb-test not found');
    });

    it('should return the error object when no custom response is defined', () => {
      const errorObj = { code: 'anyErr' };
      common.handleAwsError(errorObj).should.equal(errorObj);
    });
  });
});
