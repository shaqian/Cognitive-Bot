import React, { Component} from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';
import io from 'socket.io-client';
import uuid from 'uuid';

import VideoView from './VideoView';
import Control from './Control';

import * as actions from '../actions';

class Main extends Component {
  componentWillMount() {
    const { socket, setSocket } = this.props;
    if (!socket.socket) {
      var websocket = io(socket.host);
      setSocket(websocket);
      websocket.on('droid', (message) => this.onReceivedMessage(message));
      websocket.on('user', (message) => this.onReceivedMessage(message));
    }
  }

  onReceivedMessage(message) {
    if (message.indexOf('AudiotoText:') >= 0) {
      var msg = {
        _id: uuid(),
        text: message.replace('AudiotoText:', '♫ '),
        createdAt: new Date(),
        user: {
          _id: -1,
        }
      };
    } else {
      var msg = {
        _id: uuid(),
        text: message,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Pi',
          avatar: require('../avatar/raspberrypi.png')
        }
      };
    }
    this.props.addMessage(msg);
  }

  componentWillUnmount() {
    const { socket, clearSocket, clearMessage, setControl, setVideoRecord } = this.props;
    socket.socket.close();
    clearSocket();
    clearMessage();
    setControl('chat');
    setVideoRecord(false);
  }

  render() {
    var { orientation } = this.props;
    return (
      <View style={styles.container}>
        <VideoView />
        {
          orientation === 'portrait' ?
          <Control /> : undefined
        }
      </View>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
};

const mapStateToProps = state => {
  return {
    orientation: state.orientation,
    socket: state.socket
  };
};

export default connect(mapStateToProps, actions)(Main);
