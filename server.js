var async = require('async');
var bodyParser = require('body-parser');
var cors = require('cors');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var express = require('express');
var fs = require('fs');
var https = require('https');
var multer  = require('multer');
var parseString = require('xml2js').parseString;
var path = require('path');
var request = require('request');
var Sound = require('aplay');
var Speaker = require('speaker');
var streamBuffers = require('stream-buffers');
var wav = require('wav');
var wsClient = require('websocket').client;

var config = require('./config');
var motor = require('./motor');
var voice = require('./voice');

var transToken, sttToken, ttsToken, language, audioLanguage, music, pendingCmd;
var languages = {};
var displayLanguages = [];
var defaultIndex = 0;
var dutyCycle = 7;

console.log("Current platform: " + process.platform);

if (process.platform === 'linux') {
  var videDir = config.picamDir + 'rec/archive';
} else {
  var videDir = '~/archive';
}

var app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use("/videos", express.static(videDir));

var storage = multer.memoryStorage();
var upload = multer({ storage: storage });

// if(process.env.NODE_ENV === 'ngrok'){
  var server = app.listen(config.PORT, function () {
    console.log('Running on HTTP port: ' + config.PORT);
  });
// } else {
  // var options = {
  //   key: fs.readFileSync(config.baseDir + 'my.key'),
  //   cert: fs.readFileSync(config.baseDir + 'my.crt')
  // };
  //
  // var server = https.createServer(options, app).listen(config.PORT);
  // console.log('Running on HTTPS port: ' + config.PORT);
// }

var io = require('socket.io')(server);

// Initialize motor output
motor.init();

// Get tokens and available languages
var init = function () {
  request.post({
    uri: config.tokenURL,
    headers: {
      'Ocp-Apim-Subscription-Key': config.transSubKey
    },
    strictSSL: true
  }, function (err, res) {
    if (res.statusCode === 200) {
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
    if (res.statusCode === 200) {
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
    if (res.statusCode === 200) {
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
    if (res.statusCode === 200) {
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
  if (!audioLanguage) {
    audioLanguage = languages[req.headers.language] ? languages[req.headers.language] : 'en';
  }

  var buffer = req.files[0].buffer;
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

  res.send('OK');
});

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

app.get('/forward', function (req, res) {
  res.send('forward');
  motor.forward();
});

app.get('/backward', function (req, res) {
  res.send('backward');
  motor.backward();
});

app.get('/left', function (req, res) {
  res.send('left');
  motor.left();
});

app.get('/right', function (req, res) {
  res.send('right');
  motor.right();
});

app.get('/stop', function (req, res) {
  res.send('stop');
  motor.stop();
});

// Turn camera to the right
app.get('/camright', function (req, res) {
  res.send('camright');
  if (dutyCycle > 3) {
    dutyCycle -= 1.5;
    var cmd = config.baseDir + 'bin/direct.py ' + dutyCycle;
    _execute(cmd);
  }
});

// Turn camera to the left
app.get('/camleft', function (req, res) {
  res.send('camleft');
  if (dutyCycle < 11) {
    dutyCycle += 1.5;
    var cmd = config.baseDir + 'bin/direct.py ' + dutyCycle;
    _execute(cmd);
  }
});

app.get('*', function (req, res) {
  res.sendFile('public/index.html', { root: __dirname });
});

io.on('connection', function(socket) {
  socket.emit('droid', 'Welcome!');

  socket.emit('visionkey', config.visionKey);

  socket.emit('languages', {displayLanguages: displayLanguages, defaultIndex: 'English'});

  socket.on('chat', function(message) {
    console.log('Received message: ' + message);
    processCommand(message);
  });

  socket.on('recordedVideos', function() {
    _refreshVideos();
  })
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

// Initialize servo to middle position
if (process.platform == 'linux') {
  dutyCycle = 7;
  var cmd = config.baseDir + 'bin/direct.py ' + dutyCycle;
  _execute(cmd);
}

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

var _refreshVideos = function (socket) {
  fs.readdir(videDir, function (err, files) {
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

var _detectLanguage = function (message, cb) {
  cb = cb || function () {};
  if (audioLanguage) {
    language = audioLanguage;
    audioLanguage = undefined;
    cb(null);
  } else {
    request.get({
      uri: config.detectURL + '?text=' + encodeURIComponent(message),
      headers: {
        'Authorization': 'Bearer ' + transToken
      },
      strictSSL: true
    }, function (err, res) {
      if (res.statusCode) {
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
      if (res.statusCode) {
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
      if (res.statusCode) {
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
    if (res.statusCode) {
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
    if (res.statusCode == 200) {
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
      var cmd = 'rm -rf ' + config.picamDir + 'hooks/*; rm -rf ' + config.picamDir + 'rec/archive/*.ts; rm -rf ' + config.picamDir + 'rec/*.ts';
      _execute(cmd);
      cmd =  'touch ' + config.picamDir + 'hooks/start_record';
      _execute(cmd);
      reply = "Started video recording.";
      break;

    case 'Camera.StopVideoRecording':
      var cmd = 'touch ' + config.picamDir + 'hooks/stop_record';
      _execute(cmd);
      cmd = 'cd ' + videDir + "; VIDEO=`ls -r | grep .ts | head -n 1`; OUTFILE=`echo $VIDEO | cut -f1 -d'.'`; avconv -i $VIDEO -c:v copy -c:a copy -bsf:a aac_adtstoasc $OUTFILE.mp4";
      _execute(cmd);
      setTimeout(function () {
        _refreshVideos();
      }, 5*1000);
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
      if (music) {
        music.stop();
      }
      fs.readdir(config.musicDir, function (err, files) {
        try {
          music = new Sound();
          var number = Math.floor(Math.random() * (files.length + 1));
          console.log('Music file: ' + config.musicDir + files[number])
          music.play(config.musicDir + files[number]);
        } catch (e) {
          console.log(e.message);
        }
      });
      reply = "Playing music.";
      break;

    case 'Music.Stop':
      try {
        if (music) {
          music.stop();
        }
      } catch (e) {
        console.log(e.message);
      }
      reply = "Music has been stopped.";
      break;

    case 'Music.DecreaseVolume':
      if (entity) {
        // Run "amixer scontrols" to get the simple control name
        var cmd = "amixer set 'Speaker',0 " + entity + '%';
        _execute(cmd);
        reply = "Sound volume adjusted to " + entity + " percent.";
      } else {
        var cmd = "amixer set 'Speaker',0 20%";
        _execute(cmd);
        reply = "Sound volume adjusted to " + '20' + " percent.";
      }
      break;

    case 'Music.IncreaseVolume':
      if (entity) {
        var cmd = "amixer set 'Speaker',0 " + entity + '%';
        _execute(cmd);
        reply = "Sound volume adjusted to " + entity + " percent.";
      } else {
        var cmd = "amixer set 'Speaker',0 80%";
        _execute(cmd);
        reply = "Sound volume adjusted to " + '80' + " percent.";
      }
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
      var res = '';
      while (res.length === 0) {
        res = execSync('python ' + config.baseDir + 'bin/temp_hum/getTemp.py').toString().trim();
      }
      reply = "Current room temperature is " + res + "℃";
      setTimeout(function() {
        _checkTemp(res);
      }, 4000);
      break;

    case 'Pi.Humidity':
      var res = "";
      while (res.length === 0) {
        res = execSync('python ' + config.baseDir + 'bin/temp_hum/getHum.py').toString().trim();
      }
      reply = "Current humidity " + res + "％";
      break;
  }
  cb(null, reply);
}
