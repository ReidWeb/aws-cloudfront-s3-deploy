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

function BadRequestError() {
  this.name = 'BadRequest';
  this.code = 'BadRequest';
  this.message = ('Received BadRequest code from AWS API, please verify that the supplied profile/keys are still valid and have not expired.');
  this.shouldCauseTermination = true;
}
BadRequestError.prototype = Error.prototype;

function CredentialsError(msg) {
  this.code = 'CredentialsError';
  this.name = 'CredentialsError';
  this.message = (`Specified credentials are missing in your ~/.aws/credentials file - ${msg}`);
  this.shouldCauseTermination = true;
}
CredentialsError.prototype = Error.prototype;

function AccessDeniedError() {
  this.code = 'AccessDeniedError';
  this.name = 'AccessDeniedError';
  this.message = ('You are not permitted to access the resource you attempted to access');
  this.shouldCauseTermination = true;
}
CredentialsError.prototype = Error.prototype;

function handleAwsError(err) {
  if (err.code === 'BadRequest') {
    return (new BadRequestError());
  } if (err.code === 'CredentialsError') {
    return (new CredentialsError(err.originalError.originalError.message));
  } if (err.code === 'AccessDenied') {
    return (new AccessDeniedError());
  }
  return (err);
}

exports.handleAwsError = handleAwsError;
