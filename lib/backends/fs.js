/* istanbul ignore file */

const glob = require('glob').glob;
const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
const callsites = require('callsites').default;
const findup = require('find-up').findUp;
const deepCloneMerge = require('deep-clone-merge');
const async = require('async');

async function getcallsite(cb) {
    let paths = callsites();
    let root = path.resolve(__dirname, '../../');

    let source = paths
        .map(function (p) { return p.getFileName(); })
        .reduce(function (src, p) {
            if (src) {
                return src;
            } else if (path.resolve(root, p).indexOf(root) < 0) {
                return p;
            }
        }, null);

    if (source) {
        try {
            const packagePath = await findup('package.json', { cwd: source });
            if (packagePath) {
                cb(null, packagePath);  // Call the callback with the found package.json path
            } else {
                cb();  // No package.json found
            }
        } catch (err) {
            cb(err);  // Handle errors
        }
    } else {
        cb();  // If no source was found
    }
}


function load(options, callback) {
    if (arguments.length === 1 && typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = Object.assign({
        path: 'locales/__lng__/__ns__.__ext__'
    }, options);

    // Keep glob patterns POSIX-style because `glob` expects forward slashes on
    // Windows, but use a normalized form when matching returned filenames.
    const pattern = options.path.replace(/\\/g, '/');
    const normalizedPattern = path.normalize(pattern);

    const glb = pattern
        .replace('__lng__', '+([a-zA-Z_-])')
        .replace('__ns__', '+(+([a-zA-Z_-])*(.)+([a-zA-Z_-]))')
        .replace('__ext__', '@(json|yml|yaml)');
    const rgx = new RegExp(normalizedPattern
        .replace(/\\/g, '\\\\') // Windows hack, noop for unix file paths
        .replace(/\./g, '\\.')
        .replace('__lng__', '([a-zA-Z_-]+)')
        .replace('__ns__', '([a-zA-Z_.-]+[a-zA-Z_]+)')
        .replace('__ext__', '(json|yml|yaml|__ext__)'));

    // find language and namespace indexes in path matches
    const parts = normalizedPattern.match(rgx).slice(1);
    let lngIndex, nsIndex;
    parts.forEach((fragment, i) => {
        if (fragment === '__lng__') lngIndex = i;
        if (fragment === '__ns__') nsIndex = i;
    });

    let dirs = [];

    function getDirs(done) {
        if (options.baseDir) {
            dirs = options.baseDir;
            if (!Array.isArray(dirs)) dirs = [dirs];
            return done();
        }

        getcallsite((err, baseDir) => {
            if (err || !baseDir) {
                dirs = [process.cwd()];
            } else {
                dirs = [baseDir];
            }
            done();
        });
    }

    function sortFiles(a, b) {
        if (a.lng !== b.lng) return a.lng < b.lng ? -1 : 1;
        if (a.ns !== b.ns) return (a.ns === 'default' || a.ns < b.ns) ? -1 : 1;
        if (a.ext !== b.ext) return a.ext < b.ext ? -1 : 1;
        return 0;
    }

    let files = [];

    function findFiles(done) {
        async.forEachSeries(dirs, (dir, done) => {
            const filePath = path.resolve(dir, glb).replace(/\\/g, '/');
            glob(filePath).catch(done).then((filenames) => {
                const dirFiles = [];
                filenames.forEach((filename) => {
                    filename = path.normalize(filename);
                    const parts = filename.match(rgx).slice(1);

                    const lng = parts[lngIndex];
                    const ns = parts[nsIndex];
                    const ext = path.extname(filename).substr(1);

                    if (lng && ns) {
                        filename = path.resolve(dir, filename);
                        dirFiles.push({ filename, dir, lng, ns, ext });
                    }
                });

                dirFiles.sort(sortFiles);

                files = files.concat(dirFiles);

                done();
            });
        }, done);
    }

    let datastore = {};

    function readFiles(done) {
        datastore = {};
        async.forEachSeries(files, (file, done) => {
            fs.readFile(file.filename, (err, buffer) => {
                if (err) return done(err);

                let data;
                try {
                    if (file.ext === 'json') {
                        data = JSON.parse(buffer.toString());
                    } else if (file.ext === 'yaml' || file.ext === 'yml') {
                        data = yaml.load(buffer.toString());
                    } else {
                        throw new Error('Unknown localisation file format: ' + file.filename);
                    }
                } catch (e) {
                    if (e instanceof SyntaxError || e instanceof yaml.YAMLException) {
                        e.message = 'Localisation file syntax error: ' + file.filename + ': ' + e.message;
                    }
                    return done(e);
                }

                // make deep object based on namespace
                let namespacedObject;
                if (file.ns !== 'default') {
                    namespacedObject = {};
                    const parts = file.ns.split('.');
                    const topPart = parts.pop();
                    const top = parts.reduce((obj, part) => (obj[part] = {}), namespacedObject);
                    top[topPart] = data;
                } else {
                    namespacedObject = data;
                }

                datastore[file.lng] = deepCloneMerge(namespacedObject, datastore[file.lng]);

                done();
            });
        }, done);
    }

    let watcher;

    function watchFiles(done) {
        if (!options.watch) return done();
        if (watcher) return done();

        let chokidar;
        try {
            chokidar = require('chokidar');
        } catch {
            throw new Error('watch requires chokidar to be installed');
        }

        watcher = chokidar.watch(files.map((file) => file.filename));
        watcher.on('change', (fullname) => {
            console.log('hmpo-i18n watcher file changed: ' + fullname);
            update();
        });
        watcher.on('error', (error) => {
            console.log('hmpo-i18n watcher error: ' + error);
        });

        done();
    }

    function update() {
        async.series([
            getDirs,
            findFiles,
            readFiles,
            watchFiles
        ], (err) => {
            if (err) {
                if (watcher) return console.error(err);
                return callback(err);
            }
            callback(null, datastore);
        });
    }

    update();
}

module.exports = {
    load
};
