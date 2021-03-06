const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const CONFIG = require('../../config');
const decompress = require('decompress');
const upload = multer({ dest: CONFIG.paths.uploads });
const fse = require('fs-extra');
const database = require('../database');
const exec = require('child_process').exec;

/**
 * @param {Array<Promise>} args
 * @returns {Promise}
 */
function runBackgroundTasks(...args) {
	return Promise.all(args).catch((e) => console.log(e));
}

/**
 * @returns {Promise}
 */
function decompressPack(file, output, filter = () => true) {
	return decompress(file, output/*, {filter}*/);
}

/**
 * @returns {Promise}
 */
function decompressClientPack({ archiveFile, type }) {
	return decompressPack(archiveFile, `${CONFIG.paths.deploy[type]}`, ({ path }) => new RegExp('(^.*(([a-z\\d]){2}\\/){2}(([a-z\\d]){1,}|)$)|(.*.json$)|(libraries\\/.*$)').test(path));
}

/**
 * @returns {Promise}
 */
function decompressServerPack({ archiveFile, type }) {
	return decompressPack(archiveFile, `${CONFIG.paths.deploy[type]}`, ({ path }) => new RegExp('(^config\\/.*)|(^mods\\/.*.jar$)|(^scripts\\/.*.zs$)').test(path));
}

function prepareRelease(type, name, file) {
	const releaseData = {
		name,
		type,
		file,
		hash: crypto.createHash('md5').update(name).digest('hex'),
		status: 'pending',
		created: new Date(),
	};
	database.get('releases').push(releaseData).write();
	return releaseData;
}

function markReleaseAsReady(type, release, archiveFile) {
	database.get('releases').find({ type, hash: release.hash }).assign({ status: 'ready', archiveFile }).write();
	return Promise.resolve();
}

function cleanUploadFile(file) {
	return fse.remove(file);
}

function checkReleaseExistence() {
	return function(req, res, next) {
		if (!req.query.release) {
			res.sendStatus(400).end();
			return;
		}
		next();
	}
}

function checkReleaseUniqueness(type) {
	return function(req, res, next) {
		const release = database.get('releases').find({ type, name: req.query.release }).value();
		if (!release) {
			req.release = prepareRelease(type, req.query.release, req.file.path);
			next();
			return;
		}
		res.sendStatus(409).end();
	}
}

router.post('/new/client', upload.single('modpack'), checkReleaseExistence(), checkReleaseUniqueness('client'), (req, res) => {
	runBackgroundTasks([markReleaseAsReady('client', req.release, req.release.file)]).then(() => {
		res.sendStatus(204).end();
	}).catch((e) => {
		console.log(e);
		res.sendStatus(500).end();
	})
});

router.post('/new/server', upload.single('modpack'), checkReleaseExistence(), checkReleaseUniqueness('server'), (req, res) => {
	runBackgroundTasks([markReleaseAsReady('server', req.release, req.release.file)]).then(() => {
		res.sendStatus(204).end();
	}).catch((e) => {
		console.log(e);
		res.sendStatus(500).end();
	})
});

router.post('/deploy', checkReleaseExistence(), (req, res) => {
	let releases = database.get('releases').filter({ name: req.query.release, status: 'ready' });
	if (releases.value().length !== 2) {
		res.status(403).send('Releases packages are not ready').end();
		return;
	}

	const clientPack = releases.filter({ type: 'client' }).first().value();
	const serverPack = releases.filter({ type: 'server' }).first().value();

	// Start background tasks
	runBackgroundTasks(
		Promise.all([
			fse.remove(CONFIG.paths.deploy.client),
			fse.remove(CONFIG.paths.deploy.server),
		]),
		Promise.all([
			decompressServerPack(serverPack),
			decompressClientPack(clientPack),
		]),
		Promise.all([
			cleanUploadFile(serverPack.archiveFile),
			cleanUploadFile(clientPack.archiveFile),
		]),
		new Promise((resolve) => {
			database.get('releases').find({
				name: req.query.release,
				type: 'client',
			}).assign({ status: 'done' }).write();
			database.get('releases').find({
				name: req.query.release,
				type: 'server',
			}).assign({ status: 'done' }).write();
			resolve();
		}),
		new Promise((resolve, reject) => {
			exec(`${CONFIG.commandToRestart}`, (error, stdout, stderr) => {
				if (error || stderr) {
					reject(error, stderr);
					return;
				}
				resolve(stdout);
			})
		}),
	).then(() => {
		res.sendStatus(204).end();
	}).catch((e) => {
		res.sendStatus(500).end();
		console.log(e);
	});
});


module.exports = router;
