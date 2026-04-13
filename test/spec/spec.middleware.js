const i18n = require('../../index');

const localisedView = require('../../lib/localised-view');
const Translator = require('../../lib/translator');
const path = require('path');

describe('i18n.middleware', function () {
    let req, res, app, options, OriginalViewClass;
    beforeEach(function () {
        OriginalViewClass = class {
            render() { }
        };
        app = {
            use: sinon.stub(),
            get: sinon.stub(),
            set: sinon.stub()
        };
        app.get.returns();
        app.get.withArgs('view').returns(OriginalViewClass);
        app.get.withArgs('views').returns([ '/view1', '/view2' ]);

        sinon.stub(localisedView, 'existsFn').yields(false);

        req = require('hmpo-reqres').req();
        res = require('hmpo-reqres').res();
        sinon.stub(i18n.Translator.prototype, 'translate');
        sinon.stub(i18n.backends.fs, 'load').yieldsAsync(null, {});
        options = { cookie: { name: 'lang', maxAge: 86400 } };
    });
    afterEach(function () {
        i18n.Translator.prototype.translate.restore();
        i18n.backends.fs.load.restore();
        localisedView.existsFn.restore();
    });

    it('returns a function', function () {
        i18n.middleware.should.be.a('function');
    });

    describe('locals', function () {
        let middleware;

        beforeEach(function () {
            i18n.middleware(app, options);
            middleware = app.use.args[0][0];
        });

        it('sets the translate local function', function (done) {
            middleware(req, res, function () {
                res.locals.translate.should.be.a('function');
                res.locals.translate.should.equal(req.translate);
                done();
            });
        });

        it('sets the t local function', function (done) {
            middleware(req, res, function () {
                res.locals.t.should.be.a('function');
                res.locals.t.should.equal(req.translate);
                done();
            });
        });
    });

    describe('req.translate', function () {
        let middleware;

        beforeEach(function () {
            i18n.middleware(app, options);
            middleware = app.use.args[0][0];
        });

        it('is a function', function (done) {
            middleware(req, res, function () {
                req.translate.should.be.a('function');
                done();
            });
        });

        it('calls through to Translator instance', function (done) {
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key');
                done();
            });
        });

        it('sets language for translation from accept header', function (done) {
            options.detect = true;
            req.headers['accept-language'] = 'en';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['en'] });
                done();
            });
        });

        it('handles complex language headers', function (done) {
            options.detect = true;
            req.headers['accept-language'] = 'en-GB;q=0.8,en-US;q=0.7';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['en-GB', 'en-US'] });
                done();
            });
        });

        it('if no language header is present detect language from cookie', function (done) {
            req.cookies.lang = 'en';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['en'] });
                done();
            });
        });

        it('splits multiple language in cookies', function (done) {
            req.cookies.lang = 'en-GB,en';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['en-GB', 'en'] });
                done();
            });
        });

        it('saves language value back to a cookie', function (done) {
            options.detect = true;
            req.headers['accept-language'] = 'en-GB;q=0.8,en-US;q=0.7';
            middleware(req, res, function () {
                res.cookie.should.have.been.calledWith('lang', 'en-GB,en-US');
                done();
            });
        });

        it('saves detects a language from a query param', function (done) {
            options.query = 'lang';
            req.query = { lang: 'fr , en-GB, en-US;q-0.7' };
            middleware(req, res, function () {
                res.cookie.should.have.been.calledWith('lang', 'fr,en-GB,en-US');
                done();
            });
        });

        it('passes cookie options to res.cookie', function (done) {
            options.detect = true;
            req.headers['accept-language'] = 'en-GB;q=0.8,en-US;q=0.7';
            middleware(req, res, function () {
                res.cookie.should.have.been.calledWith('lang', 'en-GB,en-US', { maxAge: 86400, name: 'lang' });
                done();
            });
        });

        it('uses pre-existing lang cookie property if it exists', function (done) {
            options.detect = true;
            req.headers['accept-language'] = 'en-GB;q=0.8,en-US;q=0.7';
            req.cookies.lang = 'fr';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['fr'] });
                done();
            });
        });

        it('reduce lang list to allowed langs if specified', function (done) {
            options.allowedLangs = ['de', 'en'];
            req.cookies.lang = 'fr,es,de,it';
            middleware(req, res, function () {
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['de'] });
                done();
            });
        });

        it('set new current language', function (done) {
            middleware(req, res, function () {
                delete res.locals;
                req.setLanguage('es');
                req.translate('key');
                i18n.Translator.prototype.translate.should.have.been.calledWith('key', { lang: ['es'] });
                res.cookie.should.have.been.calledWithExactly('lang', 'es', { maxAge: 86400, name: 'lang' });
                done();
            });
        });

        it('doesn\'t set coookie if no cookie name', function (done) {
            delete options.cookie.name;
            middleware(req, res, function () {
                delete res.locals;
                req.setLanguage('es');
                res.cookie.should.not.have.been.called;
                done();
            });
        });

    });

    describe('localisedViews middleware', () => {
        let NewClass, options, opts, env, cb;

        beforeEach(() => {
            env = {
                render: sinon.stub()
            };
            app.get.withArgs('nunjucksEnv').returns(env);

            sinon.stub(OriginalViewClass.prototype, 'render');

            i18n.middleware(app, options);
            NewClass = app.set.args[0][1];
            cb = sinon.stub();
            options = { noCache: true };
            opts = { locals: true };
        });

        it('sets the view class to an exended view class', () => {
            app.set.should.have.been.calledWithExactly('view', sinon.match.func);

            let instance = new NewClass;
            instance.should.be.an.instanceOf(OriginalViewClass);
        });

        it('tries localised paths', () => {
            let instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            instance.ext = '.html';
            opts.lang = ['fr', 'en'];

            instance.render(opts, cb);

            localisedView.existsFn.should.have.been.calledWith(path.resolve('/view1', 'path/file_fr.html'));
            localisedView.existsFn.should.have.been.calledWith(path.resolve('/view2', 'path/file_fr.html'));
            localisedView.existsFn.should.have.been.calledWith(path.resolve('/view1', 'path/file_en.html'));
            localisedView.existsFn.should.have.been.calledWith(path.resolve('/view2', 'path/file_en.html'));
        });

        it('renders with first found file', () => {
            let instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file.html';
            opts.lang = ['fr'];

            localisedView.existsFn.withArgs(path.resolve('/view1', 'path/file_en.html')).yields(true);
            localisedView.existsFn.withArgs(path.resolve('/view2', 'path/file_fr.html')).yields(true);

            instance.render(opts, cb);

            env.render.should.have.been.calledWithExactly(path.join('path', 'file_fr.html'), opts, cb);
        });

        it('calls parent if no found file', () => {
            let instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            opts.lang = ['fr'];

            instance.render(opts, cb);
            env.render.should.not.have.been.called;
            OriginalViewClass.prototype.render.should.have.been.calledWithExactly(opts, cb);
        });

        it('updates render name if no found file with extension', () => {
            let instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file.html';
            opts.lang = ['fr'];

            instance.render(opts, cb);

            env.render.should.not.have.been.called;
            OriginalViewClass.prototype.render.should.have.been.calledWithExactly(opts, cb);
        });

        it('calls super render if there is no path', () => {
            let instance = new NewClass;

            instance.render(opts, cb);

            env.render.should.not.have.been.called;
            OriginalViewClass.prototype.render.should.have.been.calledWithExactly(opts, cb);
        });
    });

    describe('localisedViews locations', () => {
        let OriginalViewClass, env, translator, cb;

        beforeEach(() => {
            app = {
                use: sinon.stub(),
                get: sinon.stub(),
                set: sinon.stub()
            };
            app.get.returns();

            OriginalViewClass = class {
                render() { }
            };
            sinon.stub(OriginalViewClass.prototype, 'render');
            app.get.withArgs('view').returns(OriginalViewClass);

            env = {
                render: sinon.stub()
            };
            app.get.withArgs('nunjucksEnv').returns(env);

            translator = new Translator({});

            cb = sinon.stub();
        });

        it('gets views from the project dir', () => {
            localisedView.setup(app, translator, { noCache: true });
            const NewClass = app.set.args[0][1];
            const instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            instance.ext = '.html';

            instance.render({}, cb);

            localisedView.existsFn.should.have.been.calledWith(path.resolve(__dirname, '../../path/file_en.html'));
        });

        it('gets views from nunjucks loader', () => {
            env.loaders = [ { searchPaths: '/nunjucks/' } ];
            // app.get.withArgs('views').returns('.');

            localisedView.setup(app, translator, { noCache: true });
            const NewClass = app.set.args[0][1];
            const instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            instance.ext = '.html';

            instance.render({}, cb);

            localisedView.existsFn.should.have.been.calledWith(path.resolve('/nunjucks/', 'path/file_en.html'));
        });

        it('gets views from express views', () => {
            app.get.withArgs('views').returns('/express/');

            localisedView.setup(app, translator, { noCache: true });
            const NewClass = app.set.args[0][1];
            const instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            instance.ext = '.html';

            instance.render({}, cb);

            localisedView.existsFn.should.have.been.calledWith(path.resolve('/express/', 'path/file_en.html'));
        });

        it('get cached file', () => {
            app.get.withArgs('views').returns('/express/');

            localisedView.setup(app, translator, {});
            const NewClass = app.set.args[0][1];
            const instance = new NewClass;
            instance.name = 'path/file.html';
            instance.path = 'path/file';
            instance.ext = '.html';

            // existing first request
            localisedView.existsFn.yields(true);
            instance.render({}, cb);
            localisedView.existsFn.should.have.been.calledOnce;

            // existing second request
            instance.render({}, cb);
            localisedView.existsFn.should.have.been.calledOnce;

            // not existing first request
            localisedView.existsFn.yields(false);
            instance.name = 'path/new.html';
            instance.path = 'path/new';
            instance.render({}, cb);
            localisedView.existsFn.should.have.been.calledTwice;

            // not existing second request
            instance.render({}, cb);
            localisedView.existsFn.should.have.been.calledTwice;

            // final cache state
            localisedView.cache.should.deep.equal({
                [path.resolve('/express/', 'path/file_en.html')]: true,
                [path.resolve('/express/', 'path/new_en.html')]: false
            });

        });

    });

});
