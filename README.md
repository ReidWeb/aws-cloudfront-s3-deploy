# aws-cloudfront-s3-deploy

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
let deploy = require("aws-cloudfront-s3-deploy");

deploy("path-to-files", "mybucketname", "ABCDEFGHIJKLM", "dev").then(msg => {
  console.log(msg);
}).catch(e=>{
  console.log(e);
})
```

The method has params in sequence:
* `path` - the path to the directory to upload, this will be excluded on s3 - i.e. if you upload `public`, then the contents of `public` will be uploaded to the root of your bucket.
* `bucketName` - Amazon S3 bucket name to upload to
* `distributionID` - ID of the CloudFront distribution to invalidate files in
* `profile` - local AWS credentials profile ID

### CLI

The module can be used from the CLI as follows

```bash
aws-cloudfront-deploy --path public --bucket mybucketname --distribution ABCDEFGHIJKLM --profile dev 
```

## Note

This module is a heavy work in progress. The following features are still missing:
* Specification of your own AWS keys as opposed to relying on profiles
* Full test suite