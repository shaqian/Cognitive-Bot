var async = require('async');
var bodyParser = require('body-parser');
var cors = require('cors');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
var express = require('express');
var fs = require('fs');
var multer  = require('multer');
var parseString = require('xml2js').parseString;
var request = require('request');
var Speaker = require('speaker');
var streamBuffers = require('stream-buffers');
var wav = require('wav');
var wsClient = require('websocket').client;

var config = require('./config');
var motor = require('./motor');
var voice = require('./voice');

var transToken, sttToken, ttsToken, language, audioLanguage = 'en', music, pendingCmd;
var languages = {};
var displayLanguages = [];
var defaultIndex = 0;
var voiceInput = false;

// Servo
const max = 11.5, min = 2.5;
var dutyCycle = 7;

var music, musicProcess, recording;

console.log("Current platform: " + process.platform);

if (process.platform === 'linux') {
  var videDir = config.picamDir + 'rec/archive';
  var musicDir = config.musicDir;
} else {
  var videDir = './archive';
  var musicDir = './archive/music';
}

var app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use("/videos", express.static(videDir));

// var storage = multer.memoryStorage();
// var upload = multer({ storage: storage });

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/')
  },
  filename: function (req, file, cb) {
    cb(null, 'audio')
  }
});

var upload = multer({ storage: storage });

var server = app.listen(config.PORT, function () {
  console.log('Running on HTTP port: ' + config.PORT);
});

// Get tokens and available languages
var init = function () {
  request.post({
    uri: config.tokenURL,
    headers: {
      'Ocp-Apim-Subscription-Key': config.transSubKey
    },
    strictSSL: true
  }, function (err, res) {
    if (res && res.statusCode === 200) {
      transToken = res.body;
      console.log('Translator API token:' + transToken);
    } else {
      console.log(err);
    }
  });

  request.post({
    uri: config.tokenURL,
    headers: {
      'Ocp-Apim-Subscription-Key': config.sttSubKey
    },
    strictSSL: true
  }, function (err, res) {
    if (res && res.statusCode === 200) {
      sttToken = res.body;
      console.log('Speech to text token: ' + sttToken);
    } else {
      console.log(err);
    }
  });

  request.post({
    uri: config.tokenURL,
    headers: {
      'Ocp-Apim-Subscription-Key': config.ttsSubKey
    },
    strictSSL: true
  }, function (err, res) {
    if (res && res.statusCode === 200) {
      ttsToken = res.body;
      console.log('Text to speech token: ' + ttsToken);
    } else {
      console.log(err);
    }
  });

  request.get({
    uri: config.languageURL,
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en'
    },
    strictSSL: true
  }, function (err, res) {
    if (res && res.statusCode === 200) {
      result = JSON.parse(res.body);
      displayLanguages = [];
      for(var key in result.text) {
        var name = result.text[key].name;
        languages[name] = key;
        displayLanguages.push(name);
      }
    } else {
      console.log(err);
    }
  });
}

init();

// Get new tokens every 9 mins
setInterval(function () {
  init()
}, 9*60*1000);

app.post('/audio', upload.any(), function (req, res) {
  var cmd = 'avplay /tmp/audio';
  _execute(cmd);
  res.send('OK');
});

app.post('/voicecontrol', upload.any(), function (req, res) {
  var file = '/tmp/audio';
  voiceInput = true;
  audioLanguage = languages[req.headers.language] ? languages[req.headers.language] : audioLanguage;
  if (req.headers.format !== 'wav') {
    execSync('avconv -i /tmp/audio /tmp/audio.wav -y');
    file = '/tmp/audio.wav';
  }
  voiceControl(file);
  res.send('OK');
});

function voiceControl(file) {
  var buffer = fs.readFileSync(file);
  var ws = new wsClient();

  ws.on('connectFailed', function (error) {
    console.log('Initial connection failed: ' + error.toString());
  });

  ws.on('connect', function (connection) {
    console.log('Websocket client connected');
    connection.on('message', processMessage);
    connection.on('close', function (reasonCode, description) {
      console.log('Connection closed: ' + reasonCode);
    });
    connection.on('error', function (error) {
      console.log('Connection error: ' + error.toString());
    });
    sendData(connection, buffer);
  });

  ws.connect(config.sttURL.replace('{0}', audioLanguage), null, null, { 'Authorization' : 'Bearer ' + sttToken });
}

function processMessage(message) {
  if (message.type == 'utf8') {
    var result = JSON.parse(message.utf8Data)
    console.log('type:%s recognition:%s translation:%s', result.type, result.recognition, result.translation);
    io.emit('user', 'AudiotoText:' + result.recognition);
    processCommand(result.translation);
  }
  else {
    console.log(message.type);
  }
}

function sendData(connection, buffer) {
  var myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 100,
    chunkSize: 32000
  });
  myReadableStreamBuffer.put(buffer);
  myReadableStreamBuffer.put(new Buffer(3200000));
  myReadableStreamBuffer.stop();
  myReadableStreamBuffer.on('data', function (data) {
    connection.sendBytes(data);
  });
  myReadableStreamBuffer.on('end', function () {
    console.log('All data sent, closing connection');
    connection.close(1000);
  });
}

app.get('*', function (req, res) {
  res.sendFile('public/index.html', { root: __dirname });
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  socket.emit('droid', 'Welcome!');

  socket.on('disconnect', function () {
    if (recording) {
      _stopRecording();
    }
  });

  socket.on('ac', (msg) => {
    if(msg === true) {
      var cmd = config.baseDir + 'bin/on.out';
    } else {
      var cmd = config.baseDir + 'bin/off.out';
    }
    _execute(cmd);
  });

  socket.on('fan', (msg) => {
    var cmd = config.baseDir + 'bin/on.out';
    _execute(cmd);
  });

  socket.on('speaker', (msg) => {
    var cmd = "amixer set 'Speaker',0 " + msg + '%';
    _execute(cmd);
  });

  socket.on('camera', (msg) => {
    dutyCycle = (msg + max - min) / 2 + min;
    _moveCam(dutyCycle);
  });

  socket.on('music', (msg) => {
    _stopMusic();
    if (music !== msg) {
      _playMusic(msg);
    } else {
      music = undefined;
    }
  });

  socket.emit('visionkey', config.visionKey);

  socket.emit('languages', {displayLanguages: displayLanguages, defaultIndex: 'English'});

  socket.on('user', function(message) {
    console.log('Received message: ' + message);
    processCommand(message);
  });

  socket.on('recordedVideos', function() {
    _refreshVideos();
  });

  socket.on('refreshMusicFiles', () => {
    _refreshMusicFiles();
  });

  socket.on('roomTemp', () => {
    var res = _getTemp();
    socket.emit('roomTemp', res);
  });

  socket.on('roomHumidity', () => {
    var res = _getHumidity();
    socket.emit('roomHumidity', res);
  });

  socket.on('direction', (msg) => {
    console.log(msg);
    switch (msg) {
      case 'forward':
        motor.forward();
        break;
      case 'backward':
        motor.backward();
        break;
      case 'left':
        motor.left();
        break;
      case 'right':
        motor.right();
        break;
      case 'camleft':
        dutyCycle = dutyCycle + 1.5 > max ? dutyCycle: dutyCycle + 1.5;
        _moveCam(dutyCycle);
        break;
      case 'camright':
        dutyCycle = dutyCycle - 1.5 < min ? dutyCycle: dutyCycle - 1.5;
        _moveCam(dutyCycle);
        break;
      default:
        motor.stop();
    }
  });

  socket.on('record', (msg) => {
    if (msg) {
      _startRecording();
    } else {
      _stopRecording();
    }
  });
});

var _execute = function (cmd) {
  console.log('Execute command: ' + cmd);
  exec(cmd,
    (error, stdout, stderr) => {
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        if (error !== null) {
            console.log(`exec error: ${error}`);
        }
  });
}

var _moveCam = (dutyCycle) => {
  var cmd = config.baseDir + 'bin/direct.py ' + dutyCycle;
  _execute(cmd);
}

// Initialize servo to middle position
if (process.platform == 'linux') {
  _moveCam(7);
}

// Initialize motor output
motor.init();

var processCommand = function (message) {
  async.waterfall([
    function (cb) {
      _detectLanguage(message, cb);
    },function (cb) {
      _translateToEN(message, cb);
    },
    function (enMessage, cb) {
      _callLUIS(enMessage, cb);
    },
    function (intent, entity, cb) {
      _action(intent, entity, cb);
    },
    function (reply, cb) {
      _translateToLC(reply, cb);
    },
    function (text, cb) {
      _textToSpeech(text, cb);
    }
  ], function (err) {
    console.log(err);
  });
}

_getTemp = () => {
  var res = '';
  if (process.platform === 'linux') {
    while (res.length === 0) {
      res = execSync('python ' + config.baseDir + 'bin/temp_hum/getTemp.py').toString().trim();
    }
  } else {
    res = 20;
  }
  return res;
}

var _checkTemp = function(temp) {
  console.log('Current temperature: ' + temp);
  if (parseInt(temp) > 25) {
    var message = "Current room temperature is above the comfort level (24 - 25℃). Do you want to turn on air-conditioning?";
    async.waterfall([
      function (cb) {
        _translateToLC(message, cb);
      },
      function (text, cb) {
        _textToSpeech(text, cb);
      }
    ], function (err) {
      console.log(err);
    });
    pendingCmd = 'Aircon.On';
  }
}

_getHumidity = () => {
  var res = '';
  if (process.platform === 'linux') {
    while (res.length === 0) {
      res = execSync('python ' + config.baseDir + 'bin/temp_hum/getHum.py').toString().trim();
    }
  } else {
    res = 50;
  }
  return res;
}

var _startRecording = function () {
  recording = true;
  var cmd = 'rm -rf ' + config.picamDir + 'hooks/*; rm -rf ' + config.picamDir + 'rec/archive/*.ts; rm -rf ' + config.picamDir + 'rec/*.ts';
  _execute(cmd);
  cmd =  'touch ' + config.picamDir + 'hooks/start_record';
  _execute(cmd);
}

var _stopRecording = function () {
  recording = false;
  var cmd = 'touch ' + config.picamDir + 'hooks/stop_record';
  _execute(cmd);
  cmd = 'cd ' + videDir + "; VIDEO=`ls -r | grep .ts | head -n 1`; OUTFILE=`echo $VIDEO | cut -f1 -d'.'`; avconv -i $VIDEO -c:v copy -c:a copy -bsf:a aac_adtstoasc $OUTFILE.mp4";
  _execute(cmd);
  setTimeout(function () {
    _refreshVideos();
  }, 5*1000);
}

var _refreshVideos = function () {
  console.log(videDir);
  fs.readdir(videDir, function (err, files) {
    console.log(files);
    var videos = [];
    if (files) {
      for (var i=0; i<files.length; i++) {
        if (files[i].indexOf('.mp4') !== -1) {
          videos.push(files[i]);
        }
      }
    }
    io.emit('recordedVideos', videos);
  });
}

var _refreshMusicFiles = function () {
  console.log(musicDir);
  fs.readdir(musicDir, function (err, files) {
    console.log(files);
    var music = [];
    if (files) {
      for (var i=0; i<files.length; i++) {
        if (files[i].indexOf('.mp3') !== -1) {
          music.push(files[i]);
        }
      }
    }
    io.emit('refreshMusicFiles', music);
  });
}

var _stopMusic = () => {
  if (musicProcess) {
    var cmd = 'kill ' + musicProcess.pid;
    _execute(cmd);
  }
}

var _playMusic = (msg) => {
  var filename = musicDir + msg;
  musicProcess =  spawn('mpg123', [ filename ], {detached: true});
  music = msg;
  console.log('mpg123 Process ID:' + musicProcess.pid);
}

var _changeVolume = (volume) => {
  var cmd = "amixer set 'Speaker',0 " + volume + '%';
  _execute(cmd);
}

var _detectLanguage = function (message, cb) {
  cb = cb || function () {};
  if (voiceInput) {
    language = audioLanguage;
    voiceInput = false;
    cb(null);
  } else {
    request.get({
      uri: config.detectURL + '?text=' + encodeURIComponent(message),
      headers: {
        'Authorization': 'Bearer ' + transToken
      },
      strictSSL: true
    }, function (err, res) {
      if (res && res.statusCode) {
        parseString(res.body, function (err, result) {
          language = result.string._;
          console.log('Source language: ' + language);
        });
      }
      cb(err);
    });
  }
}

// Translate to English
var _translateToEN = function (message, cb) {
  cb = cb || function () {};
  if (language !== 'en') {
    request.get({
      uri: config.transURL + '?text=' + encodeURIComponent(message) + '&to=en-US',
      headers: {
        'Authorization': 'Bearer ' + transToken
      },
      strictSSL: true
    }, function (err, res) {
      if (res && res.statusCode) {
        parseString(res.body, function (err, result) {
          console.log('Translated to English: ' + result.string._);
          cb(err, result.string._);
        });
      } else {
        cb(err);
      }
    });
  } else {
    cb(null, message);
  }
}

// Translate to local language
var _translateToLC = function (message, cb) {
  cb = cb || function () {};
  console.log('Message: ' + message);
  console.log('Target language: ' + language);
  if (language !== 'en') {
    request.get({
      uri: config.transURL + '?text=' + encodeURIComponent(message) + '&to=' + language,
      headers: {
        'Authorization': 'Bearer ' + transToken
      },
      strictSSL: true
    }, function (err, res) {
      if (res && res.statusCode) {
        parseString(res.body, function (err, result) {
          console.log('Translated to message: ' + result.string._);
          io.emit('droid', result.string._);
          cb(err, result.string._);
        });
      } else {
        cb(err);
      }
    });
  } else {
    io.emit('droid', message);
    cb(null, message);
  }
}

var _textToSpeech = function (text, cb) {
  cb = cb || function () {};
  request.post({
    uri: config.ttsURL,
    headers: {
      'Authorization': 'Bearer ' + ttsToken,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
      'X-FD-AppId': 'D4D52672-91D7-4C74-8AD8-42B1D98141A5',
      'User-Agent': 'Cognitive-bot'
    },
    body: "<speak version='1.0' xml:lang='" + voice.mapping[language].language +
          "'><voice xml:lang='" + voice.mapping[language].language +
          "' xml:gender='" + voice.mapping[language].gender +
          "' name='Microsoft Server Speech Text to Speech Voice (" + voice.mapping[language].name + ")'>" + text +
          "</voice></speak>",
    encoding: null
  }, function (err, res, speak_data) {
    if (res && res.statusCode) {
      try {
        var reader = new wav.Reader();
        reader.on('format', function (format) {
          reader.pipe(new Speaker(format));
        });
        var Readable = require('stream').Readable;
        var s = new Readable;
        s.push(speak_data);
        s.push(null);
        s.pipe(reader);
      } catch (e) {
        console.log(e.message);
      }
    }
    cb(err);
  });
}

var _callLUIS = function (message, cb) {
  cb = cb || function () {};
  request.get({
    uri: config.luisURL + encodeURIComponent(message),
    strictSSL: true
  }, function (err, res) {
    if (res && res.statusCode == 200) {
      var body = JSON.parse(res.body);
      var intent = "";
      var entity = undefined;
      if (body.topScoringIntent.intent)
        intent = body.topScoringIntent.intent;

      if (message) {
        message = message.toLowerCase();
        if (message.indexOf('yes') !== -1 || message.indexOf('ok') !== -1)
         intent = 'Pi.Confirm';
      }

      if (body.entities[0])
        entity = body.entities[0].entity;
      console.log('Intent: ' + intent);
      console.log('Entity: ' + entity);
      cb(err, intent, entity);
    } else {
      cb(err);
    }
  });
}

var _action = function (intent, entity, cb) {
  cb = cb || function () {};
  var reply = intent;

  switch(intent) {
    case 'Aircon.On':
      var cmd = config.baseDir + 'bin/on.out';
      _execute(cmd);
      reply = "Turned on air conditioner.";
      break;

    case 'Aircon.Off':
      var cmd = config.baseDir + 'bin/off.out';
      _execute(cmd);
      reply = "Turned off air conditioner.";
      break;

    case 'Camera.CaptureVideo':
      _startRecording();
      reply = "Started video recording.";
      break;

    case 'Camera.StopVideoRecording':
      _stopRecording();
      reply = "Stopped video recording.";
      break;

    case 'Fan.On':
      var cmd = config.baseDir + 'bin/on.out';
      _execute(cmd);
      reply = "Turned on fan.";
      break;

    case 'Fan.Off':
      var cmd = config.baseDir + 'bin/on.out';
      _execute(cmd);
      reply = "Turned off fan.";
      break;

    case 'Music.PlayMusic':
      _stopMusic();
      fs.readdir(config.musicDir, function (err, files) {
        try {
          var number = Math.floor(Math.random() * (files.length + 1));
          console.log('Music file: ' + files[number])
          _playMusic(files[number]);
        } catch (e) {
          console.log(e.message);
        }
      });
      reply = "Playing music.";
      break;

    case 'Music.Stop':
      _stopMusic();
      reply = "Music has been stopped.";
      break;

    case 'Music.DecreaseVolume':
      if (!entity) {
        entity = 20;
      }
      _changeVolume(entity);
      reply = "Sound volume adjusted to " + entity + " percent.";
      break;

    case 'Music.IncreaseVolume':
      if (!entity) {
        entity = 80;
      }
      _changeVolume(entity);
      reply = "Sound volume adjusted to " + entity + " percent.";
      break;

    case 'Language.Change':
      if (entity) {
        if (entity.toLowerCase().indexOf('chinese') !== -1) {
          language = languages['Chinese Simplified'];
        } else {
          language = languages[entity.replace(/^\S/,function(s){return s.toUpperCase();})];
        }
        audioLanguage = language;
        reply = "Language has been changed to " + entity;
      } else {
        reply = "Please specify a language."
      }
      break;

    case 'Pi.Confirm':
      if (pendingCmd === 'Aircon.On') {
        var cmd = config.baseDir + 'bin/on.out';
        _execute(cmd);
        reply = "Turned on air conditioner.";
      } else {
        reply = "No pending command.";
      }
      pendingCmd = '';
      break;

    case 'Pi.Reject':
      reply = "OK.";
      pendingCmd = '';
      break;

    case 'Pi.Forward':
      motor.forward();
      reply = "Going forward";
      break;

    case 'Pi.Backward':
      motor.backward();
      reply = "Going backward";
      break;

    case 'Pi.TurnLeft':
      motor.left();
      reply = "Turning left";
      break;

    case 'Pi.TurnRight':
      motor.right();
      reply = "Turning right";
      break;

    case 'Pi.Stop':
      motor.stop();
      reply = "Stopped";
      break;

    case 'Pi.Greetings':
      reply = "Hi there!";
      break;

    case 'Pi.Temp':
      var res = _getTemp();
      reply = "Current room temperature is " + res + "℃";
      setTimeout(function() {
        _checkTemp(res);
      }, 4000);
      break;

    case 'Pi.Humidity':
      var res = _getHumidity();
      reply = "Current humidity " + res + "％";
      break;
  }
  cb(null, reply);
}
