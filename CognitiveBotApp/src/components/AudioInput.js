import React, { Component } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity, PanResponder, PermissionsAndroid } from 'react-native';
import { connect } from 'react-redux';
import { AudioRecorder, AudioUtils } from 'react-native-audio';
import Sound from 'react-native-sound';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';

import * as actions from '../actions';
import * as style from '../style';

class AudioInput extends Component {
  state = {
    currentTime: 0.0,
    recording: false,
    stoppedRecording: false,
    finished: false,
    audioPath: AudioUtils.DocumentDirectoryPath + '/audio.aac',
    hasPermission: undefined,
    // error: undefined,
  };

  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._handlePanResponderStart.bind(this),
      onMoveShouldSetPanResponder: this._handlePanResponderStart.bind(this),
      onPanResponderRelease: this._handlePanResponderEnd.bind(this),
      onPanResponderTerminate: this._handlePanResponderEnd.bind(this),
    });
  }

  componentDidMount() {
    this._checkPermission().then((hasPermission) => {
      this.setState({ hasPermission });

      if (!hasPermission) return;

      this.prepareRecordingPath(this.state.audioPath);

      AudioRecorder.onProgress = (data) => {
        this.setState({currentTime: Math.floor(data.currentTime)});
      };

      AudioRecorder.onFinished = (data) => {
        // Android callback comes in the form of a promise instead.
        if (Platform.OS === 'ios') {
          this._finishRecording(data.status === "OK", data.audioFileURL);
        }
      };
    });
  }

  _checkPermission() {
    if (Platform.OS !== 'android') {
      return Promise.resolve(true);
    }

    const rationale = {
      'title': 'Microphone Permission',
      'message': 'AudioExample needs access to your microphone so you can record audio.'
    };

    return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, rationale)
      .then((result) => {
        console.log('Permission result:', result);
        return (result === true || result === PermissionsAndroid.RESULTS.GRANTED);
      });
  }

  _handlePanResponderStart() {
    this.props.startAudioInput(true);
    this._record();
    return true;
  }

  _handlePanResponderEnd() {
    this.props.startAudioInput(false);
    this._stop();
  }

  prepareRecordingPath(audioPath){
    AudioRecorder.prepareRecordingAtPath(audioPath, {
      SampleRate: 22050,
      Channels: 1,
      AudioQuality: "Low",
      AudioEncoding: "aac",
      AudioEncodingBitRate: 32000
    });
  }

  async _record() {
    if (!this.state.hasPermission) {
      console.warn('Can\'t record, no permission granted!');
      return;
    }

    this.prepareRecordingPath(this.state.audioPath);

    try {
      const filePath = await AudioRecorder.startRecording();
    } catch (error) {
      console.error(error);
    }
  }

  async _stop() {
    try {
      const filePath = await AudioRecorder.stopRecording();

      if (Platform.OS === 'android') {
        this._finishRecording(true, filePath);
      }

      // this._play();
      return filePath;
    } catch (error) {
      console.error(error);
    }
  }

  _finishRecording(didSucceed, filePath) {
    this.setState({ finished: didSucceed });
    console.log(`Finished recording of duration ${this.state.currentTime} seconds at path: ${filePath}`);

    var path = this.props.control === 'audio' ? '/audio' : '/voicecontrol';
    var formData = new FormData();
    formData.append('fname', {
      uri: Platform.OS === 'ios' ? filePath : 'file://' + filePath,
      name: 'audio.aac',
      type: 'multipart/form-data'
    });
    axios.post(
      this.props.host + path,
      formData,
      {
        headers: {
          'Content-Type': `multipart/form-data`,
          'Format': 'aac'
        }
      })
    .then((response) => {
      console.log(response.data);
    })
    .catch((error) => {
      console.log(error: error);
    });
  }

  // async _play() {
  //   setTimeout(() => {
  //     var sound = new Sound(this.state.audioPath, '', (error) => {
  //       if (error) {
  //         console.log('failed to load the sound', error);
  //       }
  //     });
  //
  //     setTimeout(() => {
  //       sound.play((success) => {
  //         if (success) {
  //           console.log('successfully finished playing');
  //         } else {
  //           console.log('playback failed due to audio decoding errors');
  //         }
  //       });
  //     }, 100);
  //   }, 100);
  // }

  render() {
    const { audioInput, control } = this.props;
    if (control === 'audio') {
      return (
        <View {...this._panResponder.panHandlers}>
          {
            audioInput.start === true ?
            <View style={styles.container}>
              <MaterialIcons name={'keyboard-voice'} size={100} color={style.darkGrey} />
              <Text style={styles.text}>Release to Send</Text>
            </View>
            :
            <View style={styles.container}>
              <MaterialIcons name={'keyboard-voice'} size={100} color={style.blue} />
              <Text style={{...styles.text, color: style.blue}}>Hold to Talk</Text>
            </View>
          }
        </View>
      );
    } else {
      return (
        <View style={styles.audioInput} {...this._panResponder.panHandlers}>
          <View style={
            audioInput.start === true ?
            [styles.button, {backgroundColor: '#b2b2b2'}]
            : styles.button
          }>
          {
            audioInput.start === true ?
            <Text style={{...styles.buttonText, color: 'white'}}>
                Release to send
            </Text>
            :
            <Text style={styles.buttonText}>
                Hold to talk
            </Text>
          }
          </View>
        </View>
      );
    }
  }
}

const styles = {
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    fontSize: 20,
    color: style.darkGrey,
    fontFamily: style.font,
    marginTop: 10
  },
  audioInput: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    marginTop: Platform.select({
      ios: 6,
      android: 0,
    }),
    marginBottom: Platform.select({
      ios: 5,
      android: 3,
    }),
    height: Platform.select({
      ios: 33,
      android: 41,
    }),
  },
  buttonText: {
    fontSize: 16,
    color: '#999',
    alignSelf: 'center'
  },
  button: {
    height: 32,
    backgroundColor: 'white',
    borderColor: '#b2b2b2',
    borderWidth: 1,
    borderRadius: 1,
    marginTop: Platform.select({
      ios: 0,
      android: 6,
    }),
    alignSelf: 'stretch',
    justifyContent: 'center'
  }
}

const mapStateToProps = state => {
  return {
    audioInput: state.audioInput,
    host: state.socket.host,
    control: state.control
  };
};

export default connect(mapStateToProps, actions)(AudioInput);
