let audioCtx, analyser;
let visualiser = null;
// Set up the interval meter.
// 5: number of samples to measure over
// 200: millisecond expected length of pulse (to avoid counting several times for same sound)
//      setting this too high will mean that legit pulses will be ignored
let intervalMeter = new IntervalMeter(5, 200);
//let intervalMeter2 = new IntervalMeter(5, 1000);

let floatX = 0;


if (document.readyState != 'loading') {
  onDocumentReady();
} else {
  document.addEventListener('DOMContentLoaded', onDocumentReady);
}

// Main initialisation, called when document is loaded and ready.
function onDocumentReady() {
  visualiser = new Visualiser(document.getElementById('visualiser'));
  visualiser.setExpanded(false); // Collapse at startup

  // Initalise microphone
  navigator.getUserMedia(
    { audio: true },
    onMicSuccess, // call this when ready
    error => { console.error('Could not init microphone', error); });

  setInterval(updateDisplay, 300);
}

// Microphone successfully initalised, we now have access to audio data
function onMicSuccess(stream) {
  audioCtx = new AudioContext();

  audioCtx.addEventListener('statechange', () => {
    console.log('Audio context state: ' + audioCtx.state);
  });

  analyser = audioCtx.createAnalyser();

  // fftSize must be a power of 2. Higher values slower, more detailed
  // Range is 32-32768
  analyser.fftSize = 1024;

  // smoothingTimeConstant ranges from 0.0 to 1.0
  // 0 = no averaging. Fast response, jittery
  // 1 = maximum averaging. Slow response, smooth
  analyser.smoothingTimeConstant = 0.5;

  // Low and high shelf filters. Gain is set to 0 so they have no effect
  // could be useful for excluding background noise.
  const lowcut = audioCtx.createBiquadFilter();
  lowcut.type = "lowshelf";
  lowcut.frequency.value = 3000;
  lowcut.gain.value = 0;

  const highcut = audioCtx.createBiquadFilter();
  highcut.type = "highshelf";
  highcut.frequency.value = 15000;
  highcut.gain.value = 0;

  // Microphone -> filters -> analyser
  const micSource = audioCtx.createMediaStreamSource(stream);
  micSource.connect(lowcut);
  lowcut.connect(highcut);
  highcut.connect(analyser);

  // Start loop
  window.requestAnimationFrame(analyse);
}

function analyse() {
  const bins = analyser.frequencyBinCount;

  // Get frequency and amplitude data
  const freq = new Float32Array(bins);
  const wave = new Float32Array(bins);
  analyser.getFloatFrequencyData(freq);
  analyser.getFloatTimeDomainData(wave);

  // In testing, with FFT size of 32, bucket #19 correspnds with metronome
  // ...but probably not your sound.
  const magicBucket = 144;


  // Determine pulse if frequency threshold is exceeded.
  // -60 was determined empirically, you'll need to find your own threshold
  let hit = (freq[magicBucket] > -80);

  //Want the balloon to stray slowly back to left when sound has receeded.
  /*
  if(db.avg < 1){
    image.style.paddingLeft = newCalc - 1 + "%";
  } else {
    image.style.paddingLeft = newCalc + "%";
  }
  */


  //We want the balloon to move horizontally accordingly to the frequency.
  let db = freq[magicBucket];

  db = db/120;

  db = 1 - Math.abs(db);

  if(db > 1) {
    db = 1
  } else if(db < 0) {
    db = 0
  }

  var widthContainer = document.getElementById("container").offsetWidth;

  //Making the object increase in floating behaviour (to the left) slower (feels less like we're controlling the output with our sounds, it feels more like we're affecting it)
  floatX = floatX + (db/30);
  //Decoupling the output of the object from the input, making the balloon float back on its own accord
  floatX = floatX * 0.99;
  
  //clamping the floating to stay between 0 and 1
  if(floatX > 1){
    floatX = 1
  } else if(floatX < 0) {
    floatX = 0
  }

  //Making the object float relatively to the width of the container
  var newCalc = (widthContainer - 100) * floatX;

  //Changed from "px" to "%" because the balloon reacts more "lively" or "energized" now.
  image.style.paddingLeft = newCalc + "%";


 /* This code sort of works to get it moving horizontally but I'm not happy with it because it's not relative to the frequency really... It only goes to the extreme right if -85 is hit.

 if(freq[magicBucket] > -85) {
    image.style.paddingLeft = 270 + "px";
} else {
    image.style.paddingLeft = 0 + "px";
}*/

//Print out the frequency of bin 18 that we're using.
document.getElementById('frequency18').innerText = Math.round(freq[magicBucket]) + ' frequency';

  // An alternative approach is to check for a peak, regardless of freq
  //let hit = thresholdPeak(wave, 0.004);


  if (hit) {
    // Use the IntevalMeter (provided by util.js)
    // to track the time between pulses.

    // Returns TRUE if pulse was recorded, or FALSE if seems to be part of an already noted pulse
    let pulsed = intervalMeter.pulse();

    if (pulsed) {
      // Debug
      // let avgMs = intervalMeter.calculate();
      // let avgBpm = 1.0 / (avgMs / 1000.0) * 60.0;
      // console.log('level: ' + freq[magicBucket] +
      //   '\tms: ' + avgMs +
      //   '\tbpm: ' + avgBpm);
      document.getElementById('hit').classList.add('hit');
    }
  } else {
    document.getElementById('hit').classList.remove('hit');
  }

  // Optional rendering of data
  visualiser.renderWave(wave, true);
  visualiser.renderFreq(freq);

  // Run again
  window.requestAnimationFrame(analyse);
}

// Sets background colour and prints out interval info
function updateDisplay() {
  // Calculate interval and derive BPM (if interval is above 0)
  const currentIntervalMs = intervalMeter.calculate();
  const currentBpm = currentIntervalMs ? parseInt(1.0 / (currentIntervalMs / 1000.0) * 60.0) : 0;

  // Use 300ms as an arbitrary limit (ie. fastest)
  let relative = 300 / currentIntervalMs;

  // Clamp value beteen 0.0->1.0
  if (relative > 1.0) relative = 1; if (relative < 0) relative = 0;

  // Make some hue and lightness values from this percentage
  const h = relative * 360;
  const l = relative * 80;

  // Update text readout
  document.getElementById('intervalMs').innerText = parseInt(currentIntervalMs) + ' ms.';
  document.getElementById('intervalBpm').innerText = currentBpm + ' bpm.';
  

  // Set colour
  document.body.style.backgroundColor = 'hsl(' + h + ', 100%, ' + l + '%)';

  //If bpm = 100 = this happens. Done.
  // next step: keep bpm for five seconds?, if you fail = reset something
  // another experiment: make an image float through clapping higher bpm, make it float down when you stop/go slower.
  // to get it more accurate - figure out the frequency of a clap, or if we should go with a tap on the computer.

  //We wanted something to show when BPM hits 100, so we decided to go with an image of a ball just to try it out:
  /*
  if(currentBpm == 100) {
    document.getElementById("image").style.visibility = "visible"
  } else {
    document.getElementById("image").style.visibility = "hidden"
  }*/

  /*This makes the balloon shrink if it's put in the correct position..?
  let pixelVal = 20+40 * wave[magicBucket];
  balloon.style.width = pixelVal + "px";
  console.log(pixelVal);
  */



  //Want to make the ball move up and down within the container accordingly to the BPM

  var heightContainer = document.getElementById("container").offsetHeight
  
  var image = document.getElementById("image")

  var calc = heightContainer/300 * currentBpm

  //We logged the height and the calc to see if these were working as expected.
  //console.log(heightContainer)

  //console.log(calc);

  //Constraining the balloon to stay within the container by making it float up to the top if it reaches the bottom.
  if(currentBpm > 270) {
    image.style.paddingTop = 400 + "px";
  } else {
    image.style.paddingTop = calc + "px";
  }  

}

// Returns TRUE if the threshold value is hit between the given frequency range
// Note that FFT size & smoothing has an averaging effect
function thresholdFrequency(lowFreq, highFreq, freqData, threshold) {
  const samples = sampleData(lowFreq, highFreq, freqData);
  let max = Number.MIN_SAFE_INTEGER;
  for (var i = 0; i < samples.length; i++) {
    if (samples[i] > threshold) return true;
    max = Math.max(max, samples[i]);
  }

  // For debugging it can be useful to see maximum value within range
  console.log('Freq max: ' + max);
  return false;
}

// Returns TRUE if the data hits a peak threshold at any point
// Higher FFT sizes are needed to detect shorter pulses.
function thresholdPeak(waveData, threshold) {
  let max = Number.MIN_SAFE_INTEGER;
  for (var i = 0; i < waveData.length; i++) {
    // Need to use Math.abs to swap negatives into positive
    if (Math.abs(waveData[i]) > threshold) return true;
    max = Math.max(max, Math.abs(waveData[i]));
  }
  // For debugging it can be useful to see maximum value within range
  //console.log('Peak max: ' + max * 10000);
  return false;
}

// Returns TRUE if the average amplitude is above threshold across the whole snapshot
// Smaller FFT sizes will have a similar averaging effect
function thresholdSustained(waveData, threshold) {
  let total = 0;
  for (var i = 0; i < waveData.length; i++) {
    // Use Math.abs to swap negatives into positive
    total += Math.abs(waveData[i]);
  }
  const avg = total / waveData.length;

  // For debugging it can be useful to see computed average values
  // console.log('Sustained avg: ' + avg);
  return avg >= threshold;
}

function sampleData(lowFreq, highFreq, freqData) {
  // getIndexForFrequency is a function from util.js
  // it gives us the array index for a given freq
  const lowIndex = getIndexForFrequency(lowFreq, analyser);
  const highIndex = getIndexForFrequency(highFreq, analyser);

  // Grab a 'slice' of the array between these indexes
  const samples = freqData.slice(lowIndex, highIndex);
  return samples;
}