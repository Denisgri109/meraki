/**
 * Web shim for react-native-nfc-manager. Browsers have no NFC reader, so `isSupported`
 * answers false and the app falls back to its QR path, exactly as it does on a phone
 * without NFC hardware.
 */
const NfcManager = {
  start: async () => {},
  isSupported: async () => false,
  isEnabled: async () => false,
  requestTechnology: async () => {},
  cancelTechnologyRequest: async () => {},
  getTag: async () => null,
  setEventListener: () => {},
  registerTagEvent: async () => {},
  unregisterTagEvent: async () => {},
};

module.exports = NfcManager;
module.exports.default = NfcManager;
module.exports.NfcTech = { Ndef: 'Ndef', NfcA: 'NfcA' };
module.exports.Ndef = {
  text: { decodePayload: () => '' },
  uri: {},
  encodeMessage: () => [],
  textRecord: () => ({}),
};
module.exports.NfcEvents = { DiscoverTag: 'NfcManagerDiscoverTag' };
