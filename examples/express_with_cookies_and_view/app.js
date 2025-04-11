const express = require('express');
const app = express();
const i18n = require('hmpo-i18n');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');

app.use(cookieParser());

nunjucks.configure('views', {
    autoescape: true,
    express: app,
});
app.set('view engine', 'html');

i18n.middleware(app, {
    detect: true,
    resources: {
        en: require('./locales/en/default.json'),
        cy: require('./locales/cy/default.json'),
    },
    cookie: {
        name: 'lang',
        options: {
            maxAge: 86400000,
            httpOnly: true,
        },
    },
    fallbackLang: ['cy'],
});

app.get('/', (req, res) => {
    const title = req.translate('welcome.title');
    const welcomeMessage = req.translate('welcome.message');
    const notFoundMessage = req.translate('errors.notFound');
    const serverErrorMessage = req.translate('errors.serverError');

    res.render('index', {
        title,
        welcomeMessage,
        notFoundMessage,
        serverErrorMessage,
    });
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
