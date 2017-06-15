function gray(imageSrc) {
  var imageDst = {
    data: [],
    height: imageSrc.height,
    width: imageSrc.width
  };
  for (var i = 0; i < imageSrc.data.length; i += 4)
    imageDst.data.push((imageSrc.data[i] * 299 + imageSrc.data[i+1] * 587 + imageSrc.data[i+2] * 114 + 500) / 1000 & 0xff);

  return imageDst;
}

var colorImage = {
  height: 10,
  width: 1,
  data: [227, 219, 4, 255, 227, 220, 4, 255, 227, 219, 4, 255, 227, 220, 4, 255, 227, 219, 4, 255, 227, 220, 4, 255, 227, 219, 4, 255, 227, 220, 4, 255, 227, 219, 4, 255, 0, 0, 0, 0]
};

var grayImage = gray(colorImage);

console.log(grayImage.data);
