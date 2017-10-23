import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewPropTypes,
  Text,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';

import * as actions from '../actions';
import AudioInput from './AudioInput';

class CustomActions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      modalVisible: false,
    };
    this.onActionsPress = this.onActionsPress.bind(this);
  }

  onActionsPress() {
    this.props.showAudioInput(!this.props.audioInput.show);
  }

  renderIcon() {
    const { show } = this.props.audioInput;
    return (
      <View
        style={[styles.wrapper, this.props.wrapperStyle]}
      >
        <Text style={[styles.iconText, this.props.iconTextStyle, {
            transform: [{ rotate: show? '0deg': '90deg' }]
          }]}>
          {
            show ?
            <MaterialCommunityIcons name={'keyboard-variant'} size={22} />
            : <Feather name={'wifi'} size={18} />
          }

        </Text>
      </View>
    );
  }

  render() {
    return (
      <TouchableOpacity
        style={[styles.container, this.props.containerStyle]}
        onPress={this.onActionsPress.bind(this)}
      >
        {this.renderIcon()}
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    marginLeft: 8,
    marginBottom: 8,
  },
  wrapper: {
    borderRadius: 14,
    borderColor: '#b2b2b2',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center'
  },
  iconText: {
    color: '#b2b2b2',
    backgroundColor: 'transparent',
    textAlign: 'center',
  }
});

CustomActions.contextTypes = {
  actionSheet: PropTypes.func,
};

CustomActions.defaultProps = {
  onSend: () => {},
  options: {},
  icon: null,
  containerStyle: {},
  wrapperStyle: {},
  iconTextStyle: {},
};

CustomActions.propTypes = {
  onSend: PropTypes.func,
  options: PropTypes.object,
  icon: PropTypes.func,
  containerStyle: ViewPropTypes.style,
  wrapperStyle: ViewPropTypes.style,
  iconTextStyle: Text.propTypes.style,
};

const mapStateToProps = state => {
  return {
    audioInput: state.audioInput
  };
};

export default connect(mapStateToProps, actions)(CustomActions);
