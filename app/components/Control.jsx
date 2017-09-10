import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import uuid from 'uuid';

import FaMinusCircle from 'react-icons/lib/fa/minus-circle';
import FaPlusCircle from 'react-icons/lib/fa/plus-circle';
import FaAngleDoubleUp from 'react-icons/lib/fa/angle-double-up';
import FaAngleDoubleDown from 'react-icons/lib/fa/angle-double-down';
import FaAngleDoubleRight from 'react-icons/lib/fa/angle-double-right';
import FaAngleDoubleLeft from 'react-icons/lib/fa/angle-double-left';

import * as actions from 'actions';
import VisionAPI from 'VisionAPI';
import ControlAPI from 'ControlAPI';
import stringSimilarity from 'string-similarity';

class Control extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      analyze: false,
      description: '',
      first: true
    };
  }
  handleAnalyze() {
    this.setState({analyze: !this.state.analyze});
  }
  handleZoomOut() {
    var {dispatch, zoomValue} = this.props;
    if (zoomValue < 200) {
      zoomValue = zoomValue + 10;
      dispatch(actions.setZoomValue(zoomValue));
    }
  }
  handleZoomIn() {
    var {dispatch, zoomValue} = this.props;
    if (zoomValue > 50) {
      zoomValue = zoomValue - 10;
      dispatch(actions.setZoomValue(zoomValue));
    }
  }
  forward() {
    ControlAPI('forward');
  }
  turnLeft() {
    ControlAPI('left');
  }
  turnRight() {
    ControlAPI('right');
  }
  backward() {
    ControlAPI('backward');
  }
  stopCar() {
    ControlAPI('stop');
  }
  camTurnLeft() {
    ControlAPI('camleft');
  }
  camTurnRight() {
    ControlAPI('camright');
  }
  analyzeImage() {
    var {dispatch, visionKey} = this.props;
    if(this.state.analyze === true) {
      var video = document.getElementById('video');

      var rect = video.getBoundingClientRect();
      var baseTop = rect.top + window.scrollX;
      var baseLeft = rect.left + window.scrollY;

      var canvas = document.createElement("canvas");
      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
      canvas.getContext('2d')
            .drawImage(video, 0, 0, canvas.width, canvas.height);

      var dataURL = canvas.toDataURL();
      VisionAPI(dataURL, visionKey, (res) => {
        var description = res.description.captions[0].text;
        var old = this.state.description;
        if (old)
          var matches = stringSimilarity.compareTwoStrings(description, old);
        else
          var matches = 1;
        console.log(matches);
        if (matches < 0.4 || (this.state.first === true)) {
          this.setState({first: false});
          this.setState({description});
          dispatch(actions.addHistory({
            type: 'droid',
            content: description,
            id: uuid(),
            time: moment().unix()
          }));
        }

        var faces = [];
        res.faces.map((face) => {
          faces.push({
            id: uuid(),
            age: face.age,
            gender: face.gender,
            left: face.faceRectangle.left　+ baseLeft,
            top: face.faceRectangle.top +　baseTop - 10
          })
        });
        dispatch(actions.setFaces(faces));
      });
    } else {
      dispatch(actions.setFaces([]));
    }
  }
  componentDidMount() {
    setInterval(() => this.analyzeImage(), 3000);
  }
  render() {
    var {zoomValue} = this.props;
    return (
      <div className="fade__in">
        <div className="center__div row">
          <div className="control__left columns">
            <label>Bot</label>
            <h3 className="control">
              <FaAngleDoubleUp className="direction" onMouseDown={this.forward.bind(this)} onMouseUp={this.stopCar.bind(this)} />
            </h3>
            <h3 className="control">
              <FaAngleDoubleLeft className="direction"  onMouseDown={this.turnLeft.bind(this)} onMouseUp={this.stopCar.bind(this)}/>
              <FaAngleDoubleUp className="placeholder" />
              <FaAngleDoubleRight className="direction" onMouseDown={this.turnRight.bind(this)} onMouseUp={this.stopCar.bind(this)}/>
            </h3>
            <h3 className="control">
              <FaAngleDoubleDown className="direction"  onMouseDown={this.backward.bind(this)} onMouseUp={this.stopCar.bind(this)}/>
            </h3>
          </div>
          <div className="control__right columns">
            <label>Camera</label>
            <div>
              <h3 className="control">
                <FaAngleDoubleLeft className="direction"  onMouseDown={this.camTurnLeft.bind(this)} />
                <FaAngleDoubleUp className="placeholder" />
                <FaAngleDoubleRight className="direction" onMouseDown={this.camTurnRight.bind(this)} />
              </h3>
            </div>
            <div className="zoom__div">
              <label className="zoom">
                <FaMinusCircle className="zoom__button" onClick={this.handleZoomIn.bind(this)} />
                <span className="zoom__value">{zoomValue}</span>
                <FaPlusCircle className="zoom__button" onClick={this.handleZoomOut.bind(this)} />
              </label>
            </div>
            <div className="analyze__div">
              <label className="analyze">
                <input type="checkbox" checked={this.state.analyze} onClick={this.handleAnalyze.bind(this)}/>
                <span>Analyze</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  (state) => {
    return state;
  })(Control);
