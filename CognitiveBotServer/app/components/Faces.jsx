import React from 'react';
import { connect } from 'react-redux';

class Faces extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    var {faces} = this.props;
    var renderFaces = () => {
      if (faces.length > 0) {
        return faces.map((face) => {
          return (
            <div key={face.id} className="face__div" style={{
              top: face.top + "px",
              left: face.left + "px"
            }}>
            {
              face.gender === 'Male' ?
              <div className="male">♂<span className="age">&nbsp;{face.age}</span></div>
              : <div className="female">♀<span className="age">&nbsp;{face.age}</span></div>
            }
            </div>
          )
        });
      }
    }
    return <div>{renderFaces()}</div>
  }
}

export default connect(
  (state) => {
    return state;
  })(Faces);
