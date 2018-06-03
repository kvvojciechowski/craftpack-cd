const express = require('express');
const app = express();
const CONFIG = require("./config");

app.set("x-powered-by", false);

['libraries', 'objects', "modpack.json"].forEach((p) => {
    app.use(`/${p}`, express.static(`${CONFIG.paths.deploy.client}/${p}`));
});

app.all("/api/*", (req, res, next) => {
    if (req.header("X-Token") === CONFIG.credentials.web.token) {
        next();
        return;
    }

    res.sendStatus(403).end();
});

app.use("/", require("./src/route/modpack"));
app.use("/api/pack", require("./src/route/pack"));

app.listen(CONFIG.port, () => {
    console.log('App listening on port 3000!');
});