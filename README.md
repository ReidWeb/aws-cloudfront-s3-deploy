# aws-cloudfront-s3-deploy

**DEPRECATED: I would instead recommend using AWS' official CLI toolchain for such use cases - [Amplify CLI](https://github.com/aws-amplify/amplify-cli)**. No updates will be made to this repository

[![npm version](https://img.shields.io/npm/v/aws-cloudfront-s3-deploy.svg)](https://www.npmjs.com/package/gitinspector-csv)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/ReidWeb/GitInspector-CSV/master/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/aws-cloudfront-s3-deploy.svg)](https://www.npmjs.com/package/gitinspector-csv)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FReidWeb%2Faws-cloudfront-s3-deploy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FReidWeb%2Faws-cloudfront-s3-deploy?ref=badge_shield)
[![dependencies Status](https://david-dm.org/reidweb/aws-cloudfront-s3-deploy/status.svg)](https://david-dm.org/reidweb/aws-cloudfront-s3-deploy)

[![Build Status](https://travis-ci.com/ReidWeb/aws-cloudfront-s3-deploy.svg?branch=master)](https://travis-ci.com/ReidWeb/aws-cloudfront-s3-deploy)
[![devDependencies Status](https://david-dm.org/reidweb/aws-cloudfront-s3-deploy/dev-status.svg)](https://david-dm.org/reidweb/GitInspector-CSV?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/ReidWeb/aws-cloudfront-s3-deploy.svg)](https://greenkeeper.io/)

Node.js module that:
1. Uploads files at a specified path to a specified Amazon S3 bucket that require updates
1. Optionally invalidates the files that were just uploaded in a specified Amazon CloudFront distribution.

This module is not brilliant - I implemented it after incurring costs for invalidating `/*` on my CloudFront distribution - with each upload only a few files would be changing, so I wanted a more atomic way to tell CloudFront which files to update. **If you do not have this use case - I would recommend using the AWS CLI & a bash script or other such means**

## Usage

### Programmatic
You can use the module programmatically.

```javascript
let deploy = require('aws-cloudfront-s3-deploy');

let additionalParams = {
  cli: false,
  verbose: false,
  reuploadAll: false,
  distribution: {
    id: yourDistributionId
  },
  authentication: {
    profile: yourProfileName,
    keyId: yourKeyId,
    accessKey: yourAccessKey
  }
};

deploy('path-to-files', 'mybucketname', additionalParams).then(response => {
  //Do more stuff here
}).catch(e => {
  //Do more stuff here
})
```

The method has params in sequence:
* `path` - the path to the directory to upload, this will be excluded on s3 - i.e. if you upload `public`, then the contents of `public` will be uploaded to the root of your bucket.
* `bucketName` - Amazon S3 bucket name to upload to
* `additionalParams` - if passed as an option should be an object of type [additionalParams](#additionalparams-object).

#### additionalParams object

Keys as follows:
* `cli` - boolean indicating whether the program is being run in CLI mode (default: `false`)
* `verbose` - boolean indicating whether to run the program in verbose mode i.e. output a message for each upload (default: `false`)
* `reuploadAll` - boolean indicating whether to reupload all files regardless of if they have changed (default: `false`)
* `distribution` - object containing details of CloudFront distribution, absence will lead to no CloudFront distribution not being updated.
    * `id` - ID of Amazon CloudFront distribution
* `authentication` - object containing authentication options, absence will lead to using system defaults.
    * `profile` - identifier of profile in local AWS credentials ini file. (cannot be used in conjunction with `accessKey` or `keyId`)
    * `keyId` - AWS access key ID (cannot be used in conjunction with `profile`, must be used in conjunction with `accessKey`)
    * `accessKey` - AWS access key (cannot be used in conjunction with `profile`, must be used in conjunction with `keyId`)

### CLI

The module can be used from the CLI as follows

```bash
aws-cloudfront-deploy --path public --bucket mybucketname --distribution ABCDEFGHIJKLM --profile dev 
```

Options as follows
```bash
  -V, --version                 output the version number
  -p, --path <required>         path
  -b, --bucket <required>       bucket name
  -d, --distribution [id]       cloudfront distribution id
  -p, --profile [profile name]  profile to use
  -i, --keyId [keyId]           AWS access key ID
  -k, --accessKey [accessKey]   AWS access key
  -r, --reupload                Re-upload all items
  -v, --verbose                 run in verbose mode
  -h, --help                    output usage information
```

