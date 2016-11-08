# Postcard
A database driven application platform leveraging Electron and PostgreSQL.

### What is Postcard
Postcard is a tool for developers that makes writing and distributing database driven applications easy!

Postcard makes it easy to build database apps. Programs for business, like accounting or inventory. Once you've written your application, Postcard helps you package your app for Linux, Mac and Windows computers. When users go to open your app, Postcard will manage starting PostgeSQL.

In order to accomplish all this magic, Postcard makes several interesting choices to bring together an application stack. But although a lot of work went into Postcard, it would not have been possible without the following projects:

#### Electron 
Electron (by Github) is an application shell that provides you with several important components. The first is the web engine from Chromium, which renders your HTML and Javascript just like a browser. In order to display your HTML and Javascript files you need a webserver, so Electron provides and embeds a Node server. Finally, Electron helps you package your application so that you can easily distribute it to Linux, Mac and Windows computers. Electron is a powerful combination of technologies and effort.

#### PostgreSQL
PostgreSQL is an enterprise class, open source object-relational database. Postcard brings portable binaries of PostgreSQL for Linux, Mac and Windows into Node modules.

Postcard is still pre-release. Please ignore it for now.

# Getting Started

There are two functions in Postcard:

`postcard.init(appName, callback)`
- **appName**
 - Postcard uses this to create a folder to hold the PostgreSQL cluster
- **callback(postgresPort)**
 - This function will be called after envelope has started up, the `postgresPort` argument will allow you to tell connect to postgres

`postcard.quit()`
- You need to call this function when the process is going to exit. If you don't then PostgreSQL will keep running and you won't be able to start it the next time.

## Example

#### index.js

	const postcard = require('postcard');
	const electron = require('electron');
	const path = require('path');
	const app = electron.app;
	const BrowserWindow = electron.BrowserWindow;

	let mainWindows = [];

	app.on('ready', function () {
		postcard.init('postcard-example', function (postgresPort) {
			var curWindow = new BrowserWindow({
				'width': 1024,
				'height': 768
			});
			mainWindows.push(curWindow);

			curWindow.loadURL('file://' + path.normalize(app.getAppPath() + '/web_root/index.html'), {
				'extraHeaders': 'pragma: no-cache\n'
			});

			// Emitted when the window is closed.
			curWindow.on('closed', function() {
				mainWindows.splice(mainWindows.indexOf(curWindow), 1);
			});
		});
	});

	app.on('quit', function() {
		postcard.quit();
	});


Then in web_root/index.html, to connect to PostgreSQL, you would do something like:

	const pg = require('pg');
	var client = new pg.Client({
		user: 'main_user',
		database: 'postgres',
		password: 'password',
		host: (process.platform == 'win32' ? '127.0.0.1' : '/tmp'),
		port: fs.readFileSync(path.normalize(os.homedir() + '/.postcard-example/postgres_port')).toString(),
		ssl: false
	});



