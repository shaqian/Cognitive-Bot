import * as redux from 'redux';
import thunk from 'redux-thunk';

import {
  chatHistoryReducer,
  languagesReducer,
  languageReducer,
  zoomReducer,
  videosReducer,
  facesReducer,
  visionKeyReducer,
} from 'reducers';

export var configure = (initialState = {}) => {
  var reducer = redux.combineReducers({
    chatHistory: chatHistoryReducer,
    languages: languagesReducer,
    language: languageReducer,
    zoomValue: zoomReducer,
    videos: videosReducer,
    faces: facesReducer,
    visionKey: visionKeyReducer
  });
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || redux.compose;
  var store = redux.createStore(reducer, initialState, composeEnhancers(
    redux.applyMiddleware(thunk)
  ));
  return store;
};
