const express = require('express');
const router = express.Router();
const CONFIG = require('../../config');
const database = require('../database');


router.get('/packages.php', (req, res) => {

	const lastRelease = database.get('releases').filter({
		type: 'client',
		status: 'done',
	}).sortBy('created').first().value();

	if (!lastRelease) {
		res.sendStatus(404);
		return;
	}

	res.set('Content-Type', 'text/plain');
	res.status(200).send({
		minimumVersion: 1,
		packages: [
			{
				name: CONFIG.pack.name,
				title: CONFIG.pack.title,
				version: lastRelease.name,
				priority: 0,
				location: 'modpack.json',
			},
		],
	})
});

module.exports = router;
