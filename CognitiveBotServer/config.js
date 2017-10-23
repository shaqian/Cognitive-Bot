module.exports = {
  PORT: 3000,
  baseDir: '/home/pi/Cognitive-Bot/CognitiveBotServer/',
  picamDir: '/home/pi/picam/',
  musicDir: '/home/pi/Music/',
  languageURL: 'https://dev.microsofttranslator.com/languages?api-version=1.0',
  luisURL: '',
  tokenURL: 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
  detectURL: 'https://api.microsofttranslator.com/V2/Http.svc/Detect',
  transURL: 'https://api.microsofttranslator.com/V2/Http.svc/Translate',
  sttURL: 'wss://dev.microsofttranslator.com/speech/translate?from={0}&to=en-US&features=texttospeech&api-version=1.0',
  ttsURL: 'https://speech.platform.bing.com/synthesize',
  transSubKey: '',
  sttSubKey: '',
  ttsSubKey: '',
  visionKey: ''
}
