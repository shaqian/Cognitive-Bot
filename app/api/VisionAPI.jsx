import axios from 'axios';

const b64toBlob = (b64Data, mine='') => {
  var sliceSize = 1024;
  const byteChars = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    var slice = byteChars.slice(offset, offset + sliceSize);
    var byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, {type: mine});
}

export var VisionAPI = (image, key, cb) => {
  var blob = b64toBlob(image.replace(/^data:image\/(png|jpg);base64,/, ''));
  var formData = new FormData();
  formData.append('picture', blob);
  return axios({
    method: 'post',
    url: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Description%2CFaces&language=en',
    timeout: 10000,
    headers: {
      'Content-Type':'application/octet-stream',
      'Ocp-Apim-Subscription-Key': key
    },
    data: formData
  })
  .then((response) => {
    cb(response.data);
  })
  .catch((error) => {
    console.log(error);
  });
}

export default VisionAPI;
