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
