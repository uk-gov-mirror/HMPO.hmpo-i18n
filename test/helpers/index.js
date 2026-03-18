let chai = require('chai');

chai.should();
chai.use(require('sinon-chai').default);

global.sinon = require('sinon');
global.expect = chai.expect;

