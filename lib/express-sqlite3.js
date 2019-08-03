/**
 * Express - SQLite3
 * Copyright(c) 2019 Bradley Treweek
 * MIT Licensed
 * forked from https://github.com/rawberg/connect-sqlite3
 */

/**
 * Module dependencies.
 */
const sqlite3 = require('sqlite3')
const events = require('events')
const path = require('path')

/**
 * @type {Integer}  One day in milliseconds.
 */
const oneDay = 86400000

/**
 * Return the SQLiteStore extending Express's session Store.
 *
 * @param   {object}  express
 * @return  {Function}
 * @api   public
 */
module.exports = function (express) {
  /**
   * Express's Store.
   */
  const Store = (express.session) ? express.session.Store : express.Store

  /**
   * Remove expired sessions from database.
   * @param   {Object}  store
   * @api   private
   */
  function dbCleanup(store) {
    store.db.run(`DELETE FROM ${store.table} WHERE ? > expired`, [
      new Date().getTime()
    ])
  }

  /**
   * Initialize SQLiteStore with the given options.
   *
   * @param   {Object}  options
   * @api   public
   */
  function SQLiteStore(options = {}) {
    Store.call(this, options)

    this.table = options.table || 'sessions'
    this.db = options.db || this.table
    let dbPath

    if (this.db.indexOf(':memory:') > -1 || this.db.indexOf('?mode=memory') > -1) {
      dbPath = this.db
    } else {
      dbPath = path.join((options.dir || '.'), this.db)
    }
    
    this.db = new sqlite3.Database(dbPath, options.mode)
    this.client = new events.EventEmitter()
    const self = this

    this.db.exec(`${(options.WAL ? 'PRAGMA journal_mode=wal ' : '')}CREATE TABLE IF NOT EXISTS ${this.table} (sid PRIMARY KEY, expired INTEGER, sess); CREATE INDEX IF NOT EXISTS expired ON ${this.table} (expired)`, err => {
      if (err) throw err
      self.client.emit('connect')

      dbCleanup(self)
      setInterval(dbCleanup, oneDay, self).unref()
    })
  }

  /**
   * Inherit from Store.
   */
  SQLiteStore.prototype = Object.create(Store.prototype)
  SQLiteStore.prototype.constructor = SQLiteStore

  /**
   * Attempt to fetch session by the given sid.
   *
   * @param   {String}  sid
   * @param   {Function}  fn
   * @api   public
   */
  SQLiteStore.prototype.get = function (sid, fn) {
    this.db.get(`SELECT sess FROM ${this.table} WHERE sid=? AND ? <= expired`, [
      sid, 
      new Date().getTime()
    ], function (err, row) {
      if (err) fn(err)
      if (!row) return fn()
      fn(null, JSON.parse(row.sess))
    })
  }

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param   {String}  sid
   * @param   {Session}   sess
   * @param   {Function}  fn
   * @api   public
   */
  SQLiteStore.prototype.set = function (sid, sess, fn) {
    try {
      const maxAge = sess.cookie.maxAge
      const now = new Date().getTime()
      const expired = maxAge ? now + maxAge : now + oneDay

      this.db.all(`INSERT OR REPLACE INTO ${this.table} VALUES (?, ?, ?)`, [
        sid, 
        expired, 
        JSON.stringify(sess)
      ], function (err, rows) {
          if (fn) fn.apply(this, arguments)
        }
      )
    } catch (e) {
      if (fn) fn(e)
    }
  }

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param   {String}  sid
   * @api   public
   */
  SQLiteStore.prototype.destroy = function (sid, fn) {
    this.db.run(`DELETE FROM ${this.table} WHERE sid=?`, [
      sid
    ], fn)
  }

  /**
   * Fetch number of sessions.
   *
   * @param   {Function}  fn
   * @api   public
   */
  SQLiteStore.prototype.length = function (fn) {
    this.db.all(`SELECT COUNT(*) AS count FROM ${this.table}`, function (err, rows) {
      if (err) fn(err)
      fn(null, rows[0].count)
    })
  }

  /**
   * Clear all sessions.
   *
   * @param   {Function}  fn
   * @api   public
   */
  SQLiteStore.prototype.clear = function (fn) {
    this.db.exec(`DELETE FROM ${this.table}`, function (err) {
      if (err) fn(err)
      fn(null, true)
    })
  }

  /**
   * Touch the given session object associated with the given session ID.
   *
   * @param   {string}  sid
   * @param   {object}  session
   * @param   {function}  fn
   * @public
   */
  SQLiteStore.prototype.touch = function (sid, session, fn) {
    if (session && session.cookie && session.cookie.expires) {
      const cookieExpires = new Date(session.cookie.expires).getTime()
      this.db.run(`UPDATE ${this.table} SET expired=? WHERE sid=? AND ? <= expired`, [
        cookieExpires, 
        sid,
        new Date().getTime()
      ], function (err) {
        if (fn) {
          if (err) fn(err)
          fn(null, true)
        }
      })
    } else {
       fn(null, true)
    }
  }

  return SQLiteStore
}
