/* global emit */

import PouchDB from 'pouchdb-core'
import PouchDBAdapterIDB from 'pouchdb-adapter-idb'
import PouchDBMapReduce from 'pouchdb-mapreduce'

PouchDB.plugin(PouchDBAdapterIDB).plugin(PouchDBMapReduce)

// instantiate db (every doc will be an event, that's it)
// ~
export const db = new PouchDB('nostr-events')

// db schema (views)
// ~
db.put({
  _id: '_design/main',
  views: {
    profiles: {
      map: function (event) {
        if (event.kind === 0) {
          emit(event.pubkey)
        }
      }.toString()
    },
    homefeed: {
      map: function (event) {
        if (event.kind === 1) {
          emit(event.created_at)
        }
      }.toString()
    },
    mentions: {
      map: function (event) {
        if (event.kind === 1) {
          for (var i = 0; i < event.tags.length; i++) {
            var tag = event.tags[i]
            if (tag[0] === 'p') emit([tag[1], event.created_at])
            if (tag[0] === 'e') emit([tag[1], event.created_at])
          }
        }
      }.toString()
    },
    messages: {
      map: function (event) {
        if (event.kind === 4) {
          for (var i = 0; i < event.tags.length; i++) {
            var tag = event.tags[i]
            if (tag[0] === 'p') {
              emit([tag[1], event.created_at])
            }
          }
          emit([event.pubkey, event.created_at])
        }
      }.toString()
    }
  }
}).catch(err => {
  if (err.name === 'conflict') return
  console.error(err)
})

db.viewCleanup()
db.compact()

// db queries
// ~
export async function dbGetHomeFeedNotes(
  limit = 50,
  since = Math.round(Date.now() / 1000)
) {
  let result = await db.query('main/homefeed', {
    include_docs: true,
    descending: true,
    limit,
    startkey: since
  })
  return result.rows.map(r => r.doc)
}

export function onNewHomeFeedNote(onNewEvent = () => {}) {
  // listen for changes
  let changes = db.changes({
    live: true,
    since: 'now',
    include_docs: true,
    filter: '_view',
    view: 'main/homefeed'
  })

  changes.on('change', change => onNewEvent(change.doc))

  return changes
}

export async function dbGetMessages(
  peerPubKey,
  limit = 50,
  since = Math.round(Date.now() / 1000)
) {
  let result = await db.query('main/messages', {
    include_docs: true,
    descending: true,
    startkey: [peerPubKey, since],
    endkey: [peerPubKey, 0],
    limit
  })
  return result.rows
    .map(r => r.doc)
    .reverse()
    .reduce((acc, event) => {
      if (!acc.length) return [event]
      let last = acc[acc.length - 1]
      if (
        last.pubkey === event.pubkey &&
        last.created_at + 120 >= event.created_at
      ) {
        last.combination = last.combination || [last]
        last.combination.push(event)
      } else {
        acc.push(event)
      }
      return acc
    }, [])
}

export function onNewMessage(peerPubKey, onNewEvent = () => {}) {
  // listen for changes
  let changes = db.changes({
    live: true,
    since: 'now',
    include_docs: true,
    filter: '_view',
    view: 'main/messages'
  })

  changes.on('change', change => {
    if (
      change.doc.pubkey === peerPubKey ||
      change.doc.tags.find(([t, v]) => t === 'p' && v === peerPubKey)
    ) {
      onNewEvent(change.doc)
    }
  })

  return changes
}

export async function dbGetMentions(ourPubKey, limit = 20, skip = 0) {
  let result = await db.query('main/mentions', {
    include_docs: true,
    descending: true,
    startkey: [ourPubKey, {}],
    endkey: [ourPubKey],
    limit,
    skip
  })
  return result.rows.map(r => r.doc)
}

export async function dbGetProfile(pubkey) {
  let result = await db.query('main/profiles', {
    include_docs: true,
    key: pubkey
  })
  switch (result.rows.length) {
    case 0:
      return null
    case 1:
      return result.rows[0].doc
    default: {
      let sorted = result.rows.sort(
        (a, b) => b.doc.created_at - a.doc.created_at
      )
      sorted.slice(1).forEach(row => db.remove(row.doc))
      return sorted[0].doc
    }
  }
}
