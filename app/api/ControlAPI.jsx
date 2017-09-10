import axios from 'axios';

export var ControlAPI = (direction) => {
  return axios({
    method: 'get',
    url: '/' + direction,
    timeout: 10000,
  })
  .then((response) => {
    console.log(response.data);
  })
  .catch((error) => {
    console.log(error);
  });
}

export default ControlAPI;
