import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import uuid from 'uuid';
import Dropdown from 'react-dropdown';
import Hls from 'hls.js';
import Record from 'Recorder';
import Modal from 'react-modal';

import FaCommentsO from 'react-icons/lib/fa/comments-o';
import FaTrashO from 'react-icons/lib/fa/trash-o';
import MdRecordVoiceOver from 'react-icons/lib/md/record-voice-over';
import FaGamepad from 'react-icons/lib/fa/gamepad';
import MdVideoCollection from 'react-icons/lib/md/video-collection';

import * as actions from 'actions';
import Control from 'Control';
import ChatHistory from 'ChatHistory';
import Faces from 'Faces';
import Videos from 'Videos';

const io = require('socket.io-client');
const socket = io('');

const style = {
  overlay: {
    backgroundColor      : 'rgba(51, 51, 51, 0.5)'
  },
  content: {
    border                : '0',
    top                   : '50%',
    left                  : '50%',
    right                 : 'auto',
    bottom                : 'auto',
    marginRight           : '-50%',
    transform             : 'translate(-50%, -50%)',
    width                 : '140vh',
    height                : '80%'
  }
}

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userInput: false,
      audioInput: false,
      control: false,
      showModal: false
    };
  }
  changeLanguage(option) {
    var {dispatch} = this.props;
    dispatch(actions.setLanguage(option.value));
  }
  handleControl(e) {
    this.setState({control: !this.state.control});
  }
  handleUserInput() {
    this.setState({userInput: !this.state.userInput});
    this.setState({audioInput: false});
  }
  handleAudioInput() {
    this.setState({audioInput: !this.state.audioInput});
    this.setState({userInput: false});
  }
  handleSubmit(e) {
    e.preventDefault();
    var {dispatch} = this.props;
    var userInput = this.refs.userInput.value;
    if (userInput.length > 0) {
      this.refs.userInput.value = '';
      dispatch(actions.addHistory({
        type: 'user',
        content: userInput,
        id: uuid(),
        time: moment().unix()
      }));
    } else {
      this.refs.userInput.focus();
    }
    socket.emit('chat', userInput);
  }
  handleClear(e) {
    e.preventDefault();
    var {dispatch} = this.props;
    dispatch(actions.clearHistory());
    this.setState({audioInput: false});
    this.setState({userInput: false});
    this.setState({control: false});
  }
  showVideos(e) {
    e.preventDefault();
    this.setState({ showModal: true });
    $("body").addClass("modal-open");
  }
  handleCloseModal () {
    this.setState({ showModal: false });
    $("body").removeClass("modal-open");
  }
  componentDidMount() {
    var {dispatch} = this.props;

    socket.on('droid', (content) => {
      dispatch(actions.addHistory({
        type: 'droid',
        content,
        id: uuid(),
        time: moment().unix()
      }));
    });

    socket.on('visionkey', (content) => {
      dispatch(actions.setVisionKey(content));
    });

    socket.on('audioToText', (content) => {
      dispatch(actions.addHistory({
        type: 'user',
        content,
        id: uuid(),
        time: moment().unix()
      }));
    });

    socket.on('languages', (content) => {
      dispatch(actions.setLanguages(content.displayLanguages.sort()));
      dispatch(actions.setLanguage(content.defaultIndex));
    });

    socket.on('user', (content) => {
      dispatch(actions.addHistory({
        type: 'user',
        content,
        id: uuid(),
        time: moment().unix()
      }));
    });

    socket.emit('recordedVideos');

    socket.on('recordedVideos', (recordedVideos) => {
      dispatch(actions.setVideos(recordedVideos.reverse()));
    });

    var video = this.refs.video;
    if(Hls.isSupported()) {
      var hls = new Hls();
      var base = window.location.href;
      hls.loadSource(base + 'hls/index.m3u8');
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,function() {
        video.play();
      });
    }
  }
  render() {
    var {languages, language, zoomValue} = this.props;
    return (
      <div>
        <div className="text float__bottom">
          <ChatHistory />
          <div className="user__input">
            {
              this.state.userInput ?
              <div className="input__form" >
                <form onSubmit={this.handleSubmit.bind(this)}>
                  <input className="input input__box" type="text" ref="userInput"
                    placeholder="Talk to cognitive bot ..." />
                </form>
              </div>
              : this.state.audioInput ?
                <div className="language" >
                  <Dropdown options={languages} onChange={this.changeLanguage.bind(this)}
                    value={language} placeholder="Select a language" />
                  <Record ref={instance => { this.child = instance; }} />
                </div>
            : <div></div>
            }
          </div>
          <div className="button__panel">
            <button className="success button user__button" onClick={this.handleUserInput.bind(this)}>
              <span className="button__text"><FaCommentsO /></span>
            </button>
            <button className="success button user__button" onClick={this.handleAudioInput.bind(this)}>
              <span className="button__text"><MdRecordVoiceOver /></span>
            </button>
            <button className="secondary button user__button" onClick={this.handleClear.bind(this)}>
              <span className="button__text"><FaTrashO /></span>
            </button>
          </div>
        </div>
        <div className="text float__bottom bottom__left">
          {
            this.state.control ?
            <div><Control /></div>
            : <div className="control__hidden"><Control /></div>
          }

          <button className="button user__button button__left" onClick={this.showVideos.bind(this)}>
            <span className="button__text"><MdVideoCollection /></span>
          </button>
          <button className="button user__button button__left" onClick={this.handleControl.bind(this)}>
            <span className="button__text"><FaGamepad /></span>
          </button>
        </div>
        <div>
          <Modal isOpen={this.state.showModal} style={style}
            onRequestClose={this.handleCloseModal.bind(this)} contentLabel="Modal">
            <Videos />
          </Modal>
          <video className="video" id="video" ref="video" style={{
            width: zoomValue + "%",
            height: zoomValue + "%"
          }}></video>
        </div>
        <Faces />
      </div>
    );
  }
}

export default connect(
  (state) => {
    return state;
  })(Main);
