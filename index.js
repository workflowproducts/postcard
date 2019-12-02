const os = require('os');

const net = require('net');
const path = require('path');
const electron = require('electron');
const fs = require('fs-extra');
const hidefile = require('hidefile');
const windowStateKeeper = require('electron-window-state');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const child_process = require('child_process');
var postgresqlProc = null;

//const postgresql_module_name = 'node_modules/postgresql-portable-' + (os.platform() != 'win32' ? (os.platform() + (os.arch() === 'x64' ? '64' : '32')) : 'windows');
//const postgresql_module_path = require.resolve('postgresql-portable-' + (os.platform() != 'win32' ? (os.platform() + (os.arch() === 'x64' ? '64' : '32')) : 'windows'));
const postgresql_module_path = app.getAppPath() + '/' + 'node_modules/postgresql-portable-' + (os.platform() != 'win32' ? (os.platform() + (os.arch() === 'x64' ? '64' : '32')) : 'windows');

exports.init = function (strAppName, callback) {
	try {
		// Check for postgres data
		fs.statSync(os.homedir() + '/.' + strAppName + '/data');

		// Start postgres
		postgresqlProc = child_process.spawn(path.normalize(postgresql_module_path + '/bin/postgres' + (process.platform == 'win32' ? '.exe' : '')), [
			'-D', path.normalize(os.homedir() + '/.' + strAppName + '/data'),
			'-k', '/tmp'
		], {
			cwd: path.normalize(postgresql_module_path + '/bin/')
		});
		postgresqlProc.stderr.on('data', function(data) {
			console.log('postgres ' + postgresqlProc.pid + ' got data:\n' + data);

			if (data.indexOf('database system is ready to accept connections') > -1) {
				callback(fs.readFileSync(path.normalize(os.homedir() + '/.' + strAppName + '/postgres_port')).toString());
			}
		});
		postgresqlProc.on('close', function(code) {
			console.log(postgresqlProc.pid + ' closed with code ' + code);
		});
	} catch (e) {
		// Open the progress window
		var progressWindow = new BrowserWindow({
			width: 800,
			height: 100,
			frame: false
		});

		// Set the content
		progressWindow.loadURL('about:blank');
		progressWindow.webContents.executeJavaScript(
			'document.body.innerHTML = \'<center style="padding: 1em;">' +
			'	   <span>Performing one-time setup</span>' +
			'	   <progress style="width: 100%; display: inline-block; text-align: center;" value="0" max="1000" />' +
			'</center>\';' +
			'document.body.style.background = \'none\';' +
			'document.body.style.overflow = \'none\';').then(
			function() {
				// Create the data directory
				fs.mkdirsSync(os.homedir() + '/.' + strAppName + '/');
				if (!hidefile.isHiddenSync(os.homedir() + '/.' + strAppName + '/')) {
					hidefile.hideSync(os.homedir() + '/.' + strAppName + '/');
				}
				fs.mkdirsSync(os.homedir() + '/.' + strAppName + '/data');

				const int_postgres_port = parseInt(Math.random().toString().substring(2)) % (65535 - 1024) + 1024;
				postgresqlProc = child_process.spawn(path.normalize(postgresql_module_path + '/bin/initdb' + (process.platform == 'win32' ? '.exe' : '')), [
					'-D', path.normalize(os.homedir() + '/.' + strAppName + '/data'),
					'-E', 'UTF8',
					'-U', 'postgres'
				], {
					cwd: path.normalize(postgresql_module_path + '/bin/')
				});

				// Every line of stdout advances the progress bar
				postgresqlProc.stdout.on('data', function(data) {
					progressWindow.webContents.executeJavaScript(
						'var progress = document.getElementsByTagName(\'progress\')[0];' +
						'progress.value = parseInt(progress.value, 10) + ' + data.toString().length / 1.5 + ';'
					);
					console.log('initdb ' + postgresqlProc.pid + ' got data:\n' + data);
				});
				postgresqlProc.stderr.on('data', function(data) {
					console.log('initdb ' + postgresqlProc.pid + ' got data:\n' + data);
				});
				postgresqlProc.on('close', function(code) {
					console.log('initdb ' + postgresqlProc.pid + ' closed with code ' + code);

					// Add some stuff to postgresql.conf
					fs.appendFileSync(path.normalize(os.homedir() + '/.' + strAppName + '/data/postgresql.conf'),
						'\n\nport = ' + int_postgres_port + '\nlog_destination = stderr\nlogging_collector = off\n\n');

					// spawn postgres
					postgresqlProc = child_process.spawn(path.normalize(postgresql_module_path + '/bin/postgres' + (process.platform == 'win32' ? '.exe' : '')), [
						'-D', path.normalize(os.homedir() + '/.' + strAppName + '/data'),
						'-k', '/tmp'
					], {
						cwd: path.normalize(postgresql_module_path + '/bin/')
					});

					postgresqlProc.stdout.on('data', function(data) {
						console.log('postgres ' + postgresqlProc.pid + ' got data:\n' + data);
					});
					postgresqlProc.stderr.on('data', function(data) {
						console.log('postgres ' + postgresqlProc.pid + ' got data:\n' + data);
						progressWindow.webContents.executeJavaScript(
							'var progress = document.getElementsByTagName(\'progress\')[0];' +
							'progress.value = parseInt(progress.value, 10) + ' + data.toString().length / 2 + ';'
						);

						// When we are ready
						if (data.indexOf('database system is ready to accept connections') > -1) {
							// Run init.sql againts the database
							var psqlProc = child_process.spawn(path.normalize(postgresql_module_path + '/bin/psql' + (process.platform == 'win32' ? '.exe' : '')), [
								'-f', path.normalize(app.getAppPath() + '/init.sql'),
								'-h', (process.platform == 'win32' ? '127.0.0.1' : '/tmp'),
								'-p', int_postgres_port,
								'-U', 'postgres'
							], {
								cwd: path.normalize(postgresql_module_path + '/bin/')
							});

							psqlProc.stdout.on('data', function(data) {
								console.log('psql ' + psqlProc.pid + ' got data:\n' + data);
							});
							psqlProc.stderr.on('data', function(data) {
								console.log('psql ' + psqlProc.pid + ' got data:\n' + data);
								progressWindow.webContents.executeJavaScript(
									'var progress = document.getElementsByTagName(\'progress\')[0];' +
									'progress.value = parseInt(progress.value, 10) + ' + data.toString().length / 2 + ';'
								);
							});
							psqlProc.on('close', function(code) {
								console.log('psql ' + psqlProc.pid + ' closed with code ' + code);

								// Set up pg_hba.conf
								if (process.platform == 'win32') {
									fs.writeFileSync(
										path.normalize(os.homedir() + '/.' + strAppName + '/data/pg_hba.conf'),
										'host		  all			 all			127.0.0.1/32			 md5'
									);
								} else {
									fs.writeFileSync(
										path.normalize(os.homedir() + '/.' + strAppName + '/data/pg_hba.conf'),
										'local		  all			 all			 md5'
									);
								}
								// Restart postgresql (by listening for close, and then killing)
								postgresqlProc.on('close', function(code) {
									postgresqlProc = child_process.spawn(path.normalize(postgresql_module_path + '/bin/postgres' + (process.platform == 'win32' ? '.exe' : '')), [
										'-D', path.normalize(os.homedir() + '/.' + strAppName + '/data'),
										'-k', '/tmp'
									], {
										cwd: path.normalize(postgresql_module_path + '/bin/')
									});

									postgresqlProc.stdout.on('data', function(data) {
										console.log('postgres ' + postgresqlProc.pid + ' got data:\n' + data);
									});
									postgresqlProc.stderr.on('data', function thisCallback(data) {
										console.log('postgres ' + postgresqlProc.pid + ' got data:\n' + data);
										progressWindow.webContents.executeJavaScript(
											'var progress = document.getElementsByTagName(\'progress\')[0];' +
											'progress.value = parseInt(progress.value, 10) + ' + data.toString().length / 2 + ';'
										);

										if (data.indexOf('database system is ready to accept connections') > -1) {
											postgresqlProc.stderr.removeListener('data', thisCallback);
											fs.writeFileSync(
												path.normalize(os.homedir() + '/.' + strAppName + '/postgres_port'),
												int_postgres_port.toString()
											);
											// Open main window
											callback(int_postgres_port);
											// Close progress window
											progressWindow.close();
										}
									});
									postgresqlProc.on('close', function(code) {
										console.log('postgres ' + postgresqlProc.pid + ' closed with code ' + code);
									});
								});

								if (process.platform === 'win32') {
									var pipe = net.connect('\\\\.\\pipe\\pgsignal_' + postgresqlProc.pid, function () {
										var uint8Data = new Uint8Array(1),
											data = new Buffer(uint8Data.buffer);
										uint8Data[0] = 15; // SIGTERM
										pipe.on('error', function () {
											console.log('error', arguments);
										});

										pipe.write(data);
										pipe.end();
									});
								} else {
									postgresqlProc.kill();
								}
							});
						}
					});
					postgresqlProc.on('close', function(code) {
						console.log('postgres ' + postgresqlProc.pid + ' closed with code ' + code);
					});
				});
			}
		);
	}
};

exports.quit = function () {
	console.log('quitting');
	if (process.platform === 'win32') {
		var pipe = net.connect('\\\\.\\pipe\\pgsignal_' + postgresqlProc.pid, function () {
			var uint8Data = new Uint8Array(1),
				data = new Buffer(uint8Data.buffer);
			uint8Data[0] = 15; // SIGTERM
			pipe.on('error', function () {
				console.log('error', arguments);
			});

			pipe.write(data);
			pipe.end();
		});
	} else {
		postgresqlProc.kill();
	}
};
