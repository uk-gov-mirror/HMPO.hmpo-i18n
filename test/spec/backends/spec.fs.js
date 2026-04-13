const backend = require('../../../lib/backends/fs');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const chai = require('chai');
const { expect } = chai;

describe('fs backend', function () {
    it('exports a load function', function () {
        expect(backend.load).to.be.a('function');
    });

    describe('default behaviour', function () {
        it('loads json or yaml files from default location', function (done) {
            backend.load(function (err, data) {
                if (err) return done(err);
                expect(data.en).to.eql({
                    test: {
                        name: 'John',
                        deep: {
                            object: 'English'
                        }
                    }
                });
                expect(data.fr).to.eql({
                    test: {
                        name: 'Jean',
                        deep: {
                            object: 'French'
                        }
                    }
                });
                done();
            });
        });
    });

    describe('with options', function () {
        it('can handle a path created with path.resolve', function (done) {
            backend.load({
                path: path.resolve(__dirname, '../../../locales/__lng__/__ns__.json')
            }, function (err, data) {
                if (err) return done(err);
                expect(data).to.have.property('en');
                expect(data).to.have.property('fr');
                done();
            });
        });

        it('can handle a path created with path.join', function (done) {
            backend.load({
                path: path.join(__dirname, '../../../locales/__lng__/__ns__.json')
            }, function (err, data) {
                if (err) return done(err);
                expect(data).to.have.property('en');
                expect(data).to.have.property('fr');
                done();
            });
        });

        it('loads locales when the configured path contains Windows separators', function (done) {
            backend.load({
                path: 'locales\\__lng__\\__ns__.__ext__',
                baseDir: path.resolve(__dirname)
            }, function (err, data) {
                if (err) return done(err);
                expect(data.en).to.eql({
                    test: {
                        name: 'Jack',
                        namespaced: 'item',
                        deep: {
                            object: 'Other English'
                        }
                    }
                });
                expect(data.de).to.eql({
                    test: {
                        name: 'Hans',
                        deep: {
                            object: 'German'
                        }
                    }
                });
                done();
            });
        });

        it('uses the baseDir from options', function (done) {
            backend.load({
                baseDir: path.resolve(__dirname)
            }, function (err, data) {
                if (err) return done(err);
                expect(data).to.have.property('en');
                expect(data).to.have.property('de');
                done();
            });
        });

        it('uses a baseDir array from options', function (done) {
            backend.load({
                baseDir: [
                    path.resolve(__dirname),
                    path.resolve(__dirname, '../../../')
                ]
            }, function (err, data) {
                if (err) return done(err);
                expect(data.en).to.eql({
                    test: {
                        name: 'Jack',
                        namespaced: 'item',
                        deep: {
                            object: 'Other English'
                        }
                    }
                });
                expect(data.fr).to.eql({
                    test: {
                        name: 'Jean',
                        deep: {
                            object: 'French'
                        }
                    }
                });
                expect(data.de).to.eql({
                    test: {
                        name: 'Hans',
                        deep: {
                            object: 'German'
                        }
                    }
                });
                done();
            });
        });
    });

    describe('when no resources exist', function () {
        it('calls back with an empty datastore', function (done) {
            backend.load({
                path: './not-a-real-location/__lng__/__ns__.json'
            }, function (err, data) {
                if (err) return done(err);
                expect(data).to.eql({});
                done();
            });
        });
    });

    describe('getcallsite', function () {
        let sandbox;
        let load;
        let callsitesStub;
        let findupStub;
        let globStub;
        let fsStub;

        beforeEach(function () {
            sandbox = sinon.createSandbox();

            callsitesStub = sandbox.stub();
            findupStub = sandbox.stub();
            globStub = sandbox.stub();
            fsStub = {
                readFile: sandbox.stub()
            };

            load = proxyquire('../../../lib/backends/fs', {
                'callsites': { default: callsitesStub },
                'find-up': { findUp: findupStub },
                'glob': { glob: globStub },
                'fs': fsStub
            }).load;
        });


        afterEach(function () {
            sandbox.restore();
        });


        it('should call getcallsite and return a valid package.json path', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(path.resolve('/mock', 'package.json'));

            globStub.resolves([]);
            fsStub.readFile.yields(null, JSON.stringify({}));

            load({}, function (err) {
                expect(err).to.be.null;
                expect(findupStub.calledOnce).to.be.true;
                done();
            });
        });

        it('should fallback to process.cwd() when getcallsite does not find a source', function (done) {
            callsitesStub.returns([]); // Simulate no source found

            globStub.resolves([]);
            fsStub.readFile.yields(null, JSON.stringify({}));

            load({}, function (err, result) {
                expect(err).to.be.null;
                expect(result).to.be.an('object');
                done();
            });
        });

        it('should handle missing package.json and proceed with default directory', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(null); // No package.json found

            globStub.resolves([]);
            fsStub.readFile.yields(null, JSON.stringify({}));

            load({}, function (err, result) {
                expect(err).to.be.null;
                expect(findupStub.calledOnce).to.be.true;
                expect(result).to.be.an('object');
                done();
            });
        });

        it('should handle errors during file reading', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(path.resolve('/mock', 'package.json'));

            globStub.resolves(['/locales/en/default.json']);

            fsStub.readFile.yields(new Error('File read error'));

            load({}, function (err) {
                expect(err).to.exist;
                expect(err.message).to.equal('File read error');
                done();
            });
        });

        it('should read and merge localization files correctly', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(path.resolve('/mock', 'package.json'));

            globStub.resolves(['/locales/en/default.json']);

            fsStub.readFile.yields(null, JSON.stringify({
                greeting: 'Hello'
            }));

            load({}, function (err, result) {
                expect(err).to.be.null;
                expect(result).to.deep.equal({
                    en: {
                        greeting: 'Hello'
                    }
                }); // Expecting the correct merged localization
                done();
            });
        });
    });

    describe('watchFiles', function () {
        let sandbox;
        let load;
        let callsitesStub;
        let findupStub;
        let globStub;
        let fsStub;
        let chokidarStub;

        beforeEach(function () {
            sandbox = sinon.createSandbox();
            callsitesStub = sandbox.stub();
            findupStub = sandbox.stub();
            globStub = sandbox.stub();
            fsStub = {
                readFile: sandbox.stub()
            };

            chokidarStub = {
                watch: sandbox.stub().returns({
                    on: sandbox.stub()
                })
            };

            load = proxyquire('../../../lib/backends/fs', {
                'callsites': { default: callsitesStub },
                'find-up': { findUp: findupStub, },
                'glob': { glob: globStub },
                'fs': fsStub,
                'chokidar': chokidarStub
            }).load;
        });

        afterEach(function () {
            sandbox.restore();
        });

        it('should call chokidar.watch when options.watch is true', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(path.resolve('/mock', 'package.json'));
            globStub.resolves([]);
            fsStub.readFile.yields(null, JSON.stringify({}));

            load({ watch: true }, function (err) {
                expect(err).to.be.null;
                expect(chokidarStub.watch.calledOnce).to.be.true;
                done();
            });
        });

        it('should call done without error when watch is disabled', function (done) {
            callsitesStub.returns([{ getFileName: () => '/mock/file.js' }]);
            findupStub.resolves(path.resolve('/mock', 'package.json'));
            globStub.resolves([]);
            fsStub.readFile.yields(null, JSON.stringify({}));

            load({ watch: false }, function (err) {
                expect(err).to.be.null;
                expect(chokidarStub.watch.notCalled).to.be.true;
                done();
            });
        });
    });

});
