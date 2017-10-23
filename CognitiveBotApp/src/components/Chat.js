import React, { Component } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { connect } from 'react-redux';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import uuid from 'uuid';

import CustomActions from './CustomActions';
import AudioInput from './AudioInput';
import * as actions from '../actions';
import * as style from '../style';

class Chat extends Component {
  constructor(props) {
    super(props);
    this.onSend = this.onSend.bind(this);
  }

  onSend(messages=[]) {
    const { socket } = this.props;
    if (socket) {
      socket.emit('user', messages[0].text);
    }
    this.props.addMessage(messages[0]);
  }

  renderCustomActions(props) {
    return (
      <CustomActions
        {...props}
      />
    );
  }

  renderBubble(props) {
    return (
      <Bubble {...props}
        wrapperStyle={{
          left: {
            backgroundColor: 'white',
          },
          right: {
            backgroundColor: style.blue,
          }
        }} />
      );
    }

  renderComposer() {
    return (
      <AudioInput />
    );
  }

  render() {
    var user = { _id: -1 };
    return (
      <View style={styles.container}>
        {
          this.props.audioInput.show ?
          <GiftedChat
            messages={this.props.messages}
            onSend={this.onSend}
            user={user}
            renderActions={this.renderCustomActions}
            renderBubble={this.renderBubble.bind(this)}
            renderComposer={this.renderComposer}
          />
          :
          <GiftedChat
            messages={this.props.messages}
            onSend={this.onSend}
            user={user}
            renderActions={this.renderCustomActions}
            renderBubble={this.renderBubble.bind(this)}
          />
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: style.lightGrey,
  },
});

const mapStateToProps = state => {
  return {
    messages: state.messages,
    socket: state.socket.socket,
    audioInput: state.audioInput
  };
};

export default connect(mapStateToProps, actions)(Chat);
