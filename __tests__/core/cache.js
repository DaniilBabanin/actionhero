'use strict'

var fs = require('fs')
var os = require('os')
var path = require('path')
var async = require('async')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: Cache', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('cache methods should exist', (done) => {
    expect(api.cache).toBeInstanceOf(Object)
    expect(api.cache.save).toBeInstanceOf(Function)
    expect(api.cache.load).toBeInstanceOf(Function)
    expect(api.cache.destroy).toBeInstanceOf(Function)
    done()
  })

  it('cache.save', (done) => {
    api.cache.save('testKey', 'abc123', null, (error, resp) => {
      expect(error).toBeNull()
      expect(resp).toBe(true)
      done()
    })
  })

  it('cache.load', (done) => {
    api.cache.load('testKey', (error, resp) => {
      expect(error).toBeNull()
      expect(resp).toBe('abc123')
      done()
    })
  })

  it('cache.load failures', (done) => {
    api.cache.load('something else', (error, resp) => {
      expect(String(error)).toBe('Error: Object not found')
      expect(resp).toBeNull()
      done()
    })
  })

  it('cache.destroy', (done) => {
    api.cache.destroy('testKey', (error, resp) => {
      expect(error).toBeNull()
      expect(resp).toBe(true)
      done()
    })
  })

  it('cache.destroy failure', (done) => {
    api.cache.destroy('testKey', (error, resp) => {
      expect(error).toBeNull()
      expect(resp).toBe(false)
      done()
    })
  })

  it('cache.save with expire time', (done) => {
    api.cache.save('testKey', 'abc123', 10, (error, resp) => {
      expect(error).toBeNull()
      expect(resp).toBe(true)
      done()
    })
  })

  it('cache.load with expired items should not return them', (done) => {
    api.cache.save('testKey_slow', 'abc123', 10, (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      setTimeout(() => {
        api.cache.load('testKey_slow', (error, loadResp) => {
          expect(String(error)).toBe('Error: Object Expired')
          expect(loadResp).toBeFalsy()
          done()
        })
      }, 20)
    })
  })

  it('cache.load with negative expire times will never load', (done) => {
    api.cache.save('testKeyInThePast', 'abc123', -1, (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      api.cache.load('testKeyInThePast', (error, loadResp) => {
        expect(String(error)).toMatch(/Error: Object/)
        expect(loadResp).toBeFalsy()
        done()
      })
    })
  })

  it('cache.save does not need to pass expireTime', (done) => {
    api.cache.save('testKeyForNullExpireTime', 'abc123', (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      api.cache.load('testKeyForNullExpireTime', (error, loadResp) => {
        expect(error).toBeNull()
        expect(loadResp).toBe('abc123')
        done()
      })
    })
  })

  it('cache.load without changing the expireTime will re-apply the redis expire', (done) => {
    var key = 'testKey'
    api.cache.save(key, 'val', 1000, () => {
      api.cache.load(key, (error, loadResp) => {
        expect(error).toBeNull()
        expect(loadResp).toBe('val')
        setTimeout(() => {
          api.cache.load(key, (error, loadResp) => {
            expect(String(error)).toMatch(/Error: Object not found/)
            expect(loadResp).toBeNull()
            done()
          })
        }, 1001)
      })
    })
  })

  it('cache.load with options that extending expireTime should return cached item', (done) => {
    var expireTime = 400
    var timeout = 200
    // save the initial key
    api.cache.save('testKey_slow', 'abc123', expireTime, (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      // wait for `timeout` and try to load the key
      setTimeout(() => {
        api.cache.load('testKey_slow', {expireTimeMS: expireTime}, (error, loadResp) => {
          expect(error).toBeNull()
          expect(loadResp).toBe('abc123')
          // wait another `timeout` and load the key again within the extended expire time
          setTimeout(() => {
            api.cache.load('testKey_slow', (error, loadResp) => {
              expect(error).toBeNull()
              expect(loadResp).toBe('abc123')
              // wait another `timeout` and the key load should fail without the extension
              setTimeout(() => {
                api.cache.load('testKey_slow', (error, loadResp) => {
                  expect(String(error)).toBe('Error: Object not found')
                  expect(loadResp).toBeNull()
                  done()
                })
              }, timeout)
            })
          }, timeout)
        })
      }, timeout)
    })
  })

  it('cache.save works with arrays', (done) => {
    api.cache.save('array_key', [1, 2, 3], (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      api.cache.load('array_key', (error, loadResp) => {
        expect(error).toBeNull()
        expect(loadResp[0]).toBe(1)
        expect(loadResp[1]).toBe(2)
        expect(loadResp[2]).toBe(3)
        done()
      })
    })
  })

  it('cache.save works with objects', (done) => {
    var data = {}
    data.thing = 'stuff'
    data.otherThing = [1, 2, 3]
    api.cache.save('obj_key', data, (error, saveResp) => {
      expect(error).toBeNull()
      expect(saveResp).toBe(true)
      api.cache.load('obj_key', (error, loadResp) => {
        expect(error).toBeNull()
        expect(loadResp.thing).toBe('stuff')
        expect(loadResp.otherThing[0]).toBe(1)
        expect(loadResp.otherThing[1]).toBe(2)
        expect(loadResp.otherThing[2]).toBe(3)
        done()
      })
    })
  })

  it('can clear the cache entirely', (done) => {
    api.cache.save('thingA', 123, () => {
      api.cache.size((error, count) => {
        expect(error).toBeNull()
        expect(count > 0).toBe(true)
        api.cache.clear(() => {
          api.cache.size((error, count) => {
            expect(error).toBeNull()
            expect(count).toBe(0)
            done()
          })
        })
      })
    })
  })

  describe('lists', () => {
    it('can push and pop from an array', (done) => {
      var jobs = []

      jobs.push((next) => { api.cache.push('testListKey', 'a string', next) })
      jobs.push((next) => { api.cache.push('testListKey', ['an array'], next) })
      jobs.push((next) => { api.cache.push('testListKey', {what: 'an aobject'}, next) })
      async.parallel(jobs, (error) => {
        expect(error).toBeNull()
        jobs = []

        jobs.push((next) => {
          api.cache.pop('testListKey', (error, data) => {
            expect(error).toBeNull()
            expect(data).toBe('a string')
            next()
          })
        })
        jobs.push((next) => {
          api.cache.pop('testListKey', (error, data) => {
            expect(error).toBeNull()
            expect(data).toEqual(['an array'])
            next()
          })
        })
        jobs.push((next) => {
          api.cache.pop('testListKey', (error, data) => {
            expect(error).toBeNull()
            expect(data).toEqual({what: 'an aobject'})
            next()
          })
        })

        async.series(jobs, (error) => {
          expect(error).toBeNull()
          done()
        })
      })
    })

    it('will return undefined if the list is empty', (done) => {
      api.cache.pop('emptyListKey', (error, data) => {
        expect(error).toBeUndefined()
        expect(data).toBeUndefined()
        done()
      })
    })

    it('can get the length of an array when full', (done) => {
      api.cache.push('testListKey2', 'a string', () => {
        api.cache.listLength('testListKey2', (error, l) => {
          expect(error).toBeNull()
          expect(l).toBe(1)
          done()
        })
      })
    })

    it('will return 0 length when the key does not exist', (done) => {
      api.cache.listLength('testListKey3', (error, l) => {
        expect(error).toBeNull()
        expect(l).toBe(0)
        done()
      })
    })
  })

  describe('locks', () => {
    var key = 'testKey'
    afterEach((done) => {
      api.cache.lockName = api.id
      api.cache.unlock(key, done)
    })

    it('things can be locked, checked, and unlocked aribitrarily', (done) => {
      api.cache.lock(key, 100, (error, lockOk) => {
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.cache.checkLock(key, null, (error, lockOk) => {
          expect(error).toBeNull()
          expect(lockOk).toBe(true)
          api.cache.unlock(key, (error, lockOk) => {
            expect(error).toBeNull()
            expect(lockOk).toBe(true)
            done()
          })
        })
      })
    })

    it('locks have a TTL and the default will be assumed from config', (done) => {
      api.cache.lock(key, null, (error, lockOk) => {
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.redis.clients.client.ttl(api.cache.lockPrefix + key, (error, ttl) => {
          expect(error).toBeNull()
          expect(ttl >= 9).toBe(true)
          expect(ttl <= 10).toBe(true)
          done()
        })
      })
    })

    it('you can save an item if you do hold the lock', (done) => {
      api.cache.lock(key, null, (error, lockOk) => {
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.cache.save(key, 'value', (error, success) => {
          expect(error).toBeNull()
          expect(success).toBe(true)
          done()
        })
      })
    })

    it('you cannot save a locked item if you do not hold the lock', (done) => {
      api.cache.lock(key, null, (error, lockOk) => {
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.cache.lockName = 'otherId'
        api.cache.save(key, 'value', (error) => {
          expect(String(error)).toBe('Error: Object Locked')
          done()
        })
      })
    })

    it('you cannot destroy a locked item if you do not hold the lock', (done) => {
      api.cache.lock(key, null, (error, lockOk) => {
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.cache.lockName = 'otherId'
        api.cache.destroy(key, (error) => {
          expect(String(error)).toBe('Error: Object Locked')
          done()
        })
      })
    })

    it('you can opt to retry to obtain a lock if a lock is held (READ)', (done) => {
      api.cache.lock(key, 1, (error, lockOk) => { // will be rounded up to 1s
        expect(error).toBeNull()
        expect(lockOk).toBe(true)
        api.cache.save(key, 'value', (error, success) => {
          expect(error).toBeNull()
          expect(success).toBe(true)

          api.cache.lockName = 'otherId'
          api.cache.checkLock(key, null, (error, lockOk) => {
            expect(error).toBeNull()
            expect(lockOk).toBe(false)

            var start = new Date().getTime()
            api.cache.load(key, {retry: 2000}, (error, data) => {
              expect(error).toBeNull()
              expect(data).toBe('value')
              var delta = new Date().getTime() - start
              expect(delta >= 1000).toBe(true)
              done()
            })
          })
        })
      })
    })

    describe('locks are actually blocking', () => {
      var originalLockName

      beforeAll(() => {
        originalLockName = api.cache.lockName
      })

      afterAll(() => {
        api.cache.lockName = originalLockName
      })

      it('locks are actually blocking', (done) => {
        var key = 'test'
        var locksRetrieved = 0
        var locksRejected = 0
        var concurentLocksCount = 100
        var jobs = []

        var go = (next) => {
          // proxy for another actionhero instance accessing the same locked object
          api.cache.lockName = 'test-name-pass-' + (locksRetrieved + locksRejected)

          api.cache.checkLock(key, null, (error, lockOk) => {
            if (error) { return next(error) }

            if (lockOk) {
              locksRetrieved++
              api.cache.lock(key, (1000 * 60), next)
            } else {
              locksRejected++
              next()
            }
          })
        }

        for (var i = 0; i < concurentLocksCount; i++) {
          jobs.push(go)
        }

        async.series(jobs, (error) => {
          expect(error).toBeNull()
          expect(locksRetrieved).toBe(1) // Only first atempt
          expect(locksRejected).toBe(concurentLocksCount - 1) // Everything else
          done()
        })
      })
    })
  })

  describe('cache dump files', () => {
    if (typeof os.tmpdir !== 'function') { os.tmpdir = os.tmpDir } // resolution for node v0.8.x
    var file = os.tmpdir() + path.sep + 'cacheDump'

    it('can read write the cache to a dump file', (done) => {
      api.cache.clear(() => {
        api.cache.save('thingA', 123, () => {
          api.cache.dumpWrite(file, (error, count) => {
            expect(error).toBeNull()
            expect(count).toBe(1)
            var body = JSON.parse(String(fs.readFileSync(file)))
            var content = JSON.parse(body['actionhero:cache:thingA'])
            expect(content.value).toBe(123)
            done()
          })
        })
      })
    })

    it('can laod the cache from a dump file', (done) => {
      api.cache.clear(() => {
        api.cache.dumpRead(file, (error, count) => {
          expect(error).toBeNull()
          expect(count).toBe(1)
          api.cache.load('thingA', (error, value) => {
            expect(error).toBeNull()
            expect(value).toBe(123)
            done()
          })
        })
      })
    })
  })
})