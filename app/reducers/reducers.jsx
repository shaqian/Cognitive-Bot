export var chatHistoryReducer = (state = [], action) => {
  switch (action.type) {
    case 'ADD_HISTORY':
      return [
        ...state,
        action.history
      ];
    case 'CLEAR_HISTORY':
      return [];
    default:
      return state;
  };
}

export var languagesReducer = (state = [], action) => {
  switch (action.type) {
    case 'SET_LANGUAGES':
      return action.languages;
    default:
      return state;
  }
}

export var languageReducer = (state = 'English', action) => {
  switch (action.type) {
    case 'SET_LANGUAGE':
      return action.language;
    default:
      return state;
  }
}

export var zoomReducer = (state = 100, action) => {
  switch (action.type) {
    case 'SET_ZOOMVALUE':
      return action.zoomValue;
    default:
      return state;
  }
}

export var videosReducer = (state = [], action) => {
  switch (action.type) {
    case 'SET_VIDEOS':
      return action.videos;
    default:
      return state;
  }
}

export var facesReducer = (state = [], action) => {
  switch (action.type) {
    case 'SET_FACES':
      return action.faces;
    default:
      return state;
  }
}

export var visionKeyReducer = (state = '', action) => {
  switch (action.type) {
    case 'SET_KEY':
      return action.key;
    default:
      return state;
  }
}
