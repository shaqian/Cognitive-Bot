import axios from 'axios';

export var addHistory = (history) => {
  return {
    type: 'ADD_HISTORY',
    history
  };
};

export var clearHistory = (history) => {
  return {
    type: 'CLEAR_HISTORY'
  };
};

export var setLanguages = (languages) => {
  return {
    type: 'SET_LANGUAGES',
    languages
  };
};

export var setLanguage = (language) => {
  return {
    type: 'SET_LANGUAGE',
    language
  };
};

export var setZoomValue = (zoomValue) => {
  return {
    type: 'SET_ZOOMVALUE',
    zoomValue
  };
}

export var setVideos = (videos) => {
  return {
    type: 'SET_VIDEOS',
    videos
  };
}

export var setFaces = (faces) => {
  return {
    type: 'SET_FACES',
    faces
  }
}

export var setVisionKey = (key) => {
  return {
    type: 'SET_KEY',
    key
  }
}
