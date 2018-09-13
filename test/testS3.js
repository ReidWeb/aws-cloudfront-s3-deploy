'use strict';
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');
const should = chai.should();
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('chai-as-promised'))

describe("s3.js [Unit]", ()=> {

  describe('#getFileLastModifiedDate', () => {

    it('Should resolve the last modified date when the meta-data is available', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const time = "2014-09-12T15:48:06.228Z";
      const fsMock = {
        stat: function (path, cb) {
          cb(null, {"mtime" : time});
        }
      };

      s3.__set__({fs:fsMock});

      const lastModified = await getFileLastModifiedDate('package.json');
      lastModified.should.equal(time);
    });

    it('Should resolve to `false` when the meta-data is non existant', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const fsMock = {
        stat: function (path, cb) {
          cb(null, {});
        }
      };

      s3.__set__({fs:fsMock});

      const actual = await getFileLastModifiedDate('package.json');
      actual.should.equal(false);
    });

    it('Should resolve to `false` when the meta-data is an empty string', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const fsMock = {
        stat: function (path, cb) {
          cb(null, {"mtime" : ""});
        }
      };

      s3.__set__({fs:fsMock});

      const actual = await getFileLastModifiedDate('package.json');
      actual.should.equal(false);
    });
  });

  describe('#uploadObj', () => {

    it('Should resolve the object key upon a successful upload', async () => {
      const s3 = rewire('../src/s3');
      const uploadObj = s3.__get__('uploadObj');

      const s3ClientMock = {
        putObject: function (params, cb) {
          cb(null,{})
        }
      };

      let actual = await uploadObj({"Key": "hiThere"}, s3ClientMock, 0);

      actual.should.equal("hiThere");
    });

    it('Should reject with an error after multiple failed uploads',  async () => {
      const s3 = rewire('../src/s3');
      const uploadObj = s3.__get__('uploadObj');

      const s3ClientMock = {
        putObject: function(params, cb) {
          cb(new Error('Generic error'), {});
        }
      };

      try{
        let x = await uploadObj({"Key": "foo"}, s3ClientMock, 4)
        "I".should.not.equal("Me");
      } catch (e) {
        e.message.should.equal("Error: Unable to process object foo, reattempted for 5 (MAX)");
      }

    });

  });

  describe("#hasFileChanged", () => {

    it('Should resolve to false when the dates match', async () => {
      const s3 = rewire('../src/s3');
      const hasFileChanged = s3.__get__('hasFileChanged');
      const res = {
        "Metadata": {
          "last-modified": "2017-09-12T15:48:06.228Z"
          }
      };

      const s3ClientMock = {
        headObject: function (params, cb) {
          cb(null, res);
        }
      };

      const fileModifiedCheckFn = function () {
        return new Promise((resolve, reject) => {
          resolve(new Date("2017-09-12T15:48:06.228Z"));
        });
      };

      const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, fileModifiedCheckFn);

      actual.should.equal(false);
    });

    it('Should resolve to true when the dates match', async () => {
      const s3 = rewire('../src/s3');
      const hasFileChanged = s3.__get__('hasFileChanged');
      const res = {
        "Metadata": {
          "last-modified": "2017-09-12T15:48:06.228Z"
        }
      };

      const s3ClientMock = {
        headObject: function (params, cb) {
          cb(null, res);
        }
      };

      const fileModifiedCheckFn = function () {
        return new Promise((resolve, reject) => {
          resolve(new Date("2007-09-12T15:48:06.228Z"));
        });
      };

      const spy = sinon.spy(fileModifiedCheckFn);

      const actual = await hasFileChanged('foo.txt', 'myBucket', s3ClientMock, spy);

      spy.calledWith('public/foo.txt').should.be.ok;
      actual.should.equal(true);
    });
  });
});