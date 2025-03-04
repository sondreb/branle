import {LocalStorage} from 'quasar'

export default function () {
  return {
    keys: LocalStorage.getItem('keys') || {pub: '00000000000000000000000000'}, // {priv, pub }

    relays: {
      // 'wss://nostr.rocks': {read: true, write: true},
      'wss://relayer.fiatjaf.com': {read: true, write: true},
      // 'wss://nostrrr.bublina.eu.org': {read: true, write: true},
      'wss://nostr-pub.wellorder.net': {read: true, write: true}
      // 'wss://nostr-relay.freeberty.net': {read: true, write: true},
      // 'wss://freedom-relay.herokuapp.com/ws': {read: true, write: true}
    }, // { [url]: {} }
    following: [], // [ pubkeys... ]

    profilesCache: {}, // { [pubkey]: {name, about, picture, ...} }
    profilesCacheLRU: [], // [ pubkeys... ]
    contactListCache: {}, // { [pubkey]: {name, about, picture, ...} }
    contactListCacheLRU: [], // [ pubkeys... ]

    lastMessageRead: LocalStorage.getItem('lastMessageRead') || {},
    unreadMessages: {},

    lastNotificationRead: LocalStorage.getItem('lastNotificationRead') || 0,
    unreadNotifications: 0
  }
}
