# Express SQLite3

express-sqlite3 is a SQLite3 session store modeled after the TJ's express-redis store.


## Installation
```sh
	  $ npm install express-sqlite3
```

## Options

  - `table='sessions'` Database table name (defaults to sessions)
  - `path=':memory:'` Directory to save '<db>.db' file (defaults to memory)
  - `WAL='false'` Enables [WAL](https://www.sqlite.org/wal.html) mode (defaults to false)

## Usage
```js
    var session = require('express-session')
    var SQLiteStore = require('express-sqlite3')(session)

    app.configure(function() {
      app.set('views', __dirname + '/views')
      app.set('view engine', 'ejs')
      app.use(express.bodyParser())
      app.use(express.methodOverride())
      app.use(express.cookieParser())
      app.use(session({
        store: new SQLiteStore,
        secret: 'your secret',
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
      }))
      app.use(app.router)
      app.use(express.static(__dirname + '/public'))
    })
```
## Test
```sh
    $ npm test
```
