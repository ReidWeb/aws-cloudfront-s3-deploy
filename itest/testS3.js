'use strict';
/* eslint-env mocha */

const chai = require('chai');
const rewire = require('rewire');
const should = chai.should();

describe("s3.js [ITEST]", ()=> {

  describe('#getFileLastModifiedDate', () => {

    it('Should read the last modified date correctly from a file', async () => {
      const s3 = rewire('../src/s3');
      const getFileLastModifiedDate = s3.__get__('getFileLastModifiedDate');
      const fileName = './itest/test-res/lastmodified.txt'
      const expected = "2018-09-12T16:18:32.362Z"


      const actual = await getFileLastModifiedDate(fileName);
      actual.toISOString().should.equal(expected);
    });

  });


});