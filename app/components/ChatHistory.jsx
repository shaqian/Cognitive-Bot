import React from 'react';
import { connect } from 'react-redux';

import PiRaspberry from 'react-icons/lib/pi/raspberry';
import FaSmileO from 'react-icons/lib/fa/smile-o';
import FaMusic from 'react-icons/lib/fa/music';

class ChatHistory extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    var {chatHistory} = this.props;
    var renderChat = () => {
      if (chatHistory.length > 0) {
        return chatHistory.map((h) => {
          if (h.type === 'droid'){
            return (
              <div key={h.id} className="chat__droid fade__in">
                <h3 className="droid"><PiRaspberry /></h3>
                <div className="chat__form">
                  <div className="chat__content chat__content__left">{h.content}</div>
                </div>
              </div>
            );
          } else if (h.content.indexOf('AudiotoText:') >= 0) {
            var content = h.content.replace('AudiotoText:', ' ');
            return (
              <div key={h.id} className="chat__user fade__in">
                <div className="chat__form">
                  <div className="chat__content chat__content__right"><FaMusic />{content}</div>
                </div>
                <h3 className="user"><FaSmileO /></h3>
              </div>
            );
          } else {
            return (
              <div key={h.id} className="chat__user fade__in">
                <div className="chat__form">
                  <div className="chat__content chat__content__right">{h.content}</div>
                </div>
                <h3 className="user"><FaSmileO /></h3>
              </div>
            );
          }
        });
      }
    }
    return <div>{renderChat()}</div>
  }
}

export default connect(
  (state) => {
    return state;
  })(ChatHistory);
