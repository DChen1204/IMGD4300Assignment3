//import { default as gulls } from 'https://charlieroberts.codeberg.page/gulls/gulls.js'
import { default as gulls } from '/gulls.js'
// import { default as Video } from './helpers/video.js'

// start seagulls, by default it will use the first <canvas> element it finds in your HTML page
const sg = await gulls.init()
//await Video.init()

// HTML elements
const waterSlider = document.querySelector('#turbulence-slider')
const waterToggle = document.querySelector('#water-toggle')
const fireToggle = document.querySelector('#fire-toggle')
const fireRedButton = document.querySelector('#btn-fire-red')
const fireGreenButton = document.querySelector('#btn-fire-green')
const fireBlueButton = document.querySelector('#btn-fire-blue')

// a simple vertex shader to make a quad
const quadVertexShader = gulls.constants.vertex

// Uniforms
const uniforms = `
  // Resolution
  @group(0) @binding(0) var<uniform> resolution: vec2f;

  // Time
  @group(0) @binding(1) var<uniform> time: f32;

  // Water Turbulence
  @group(0) @binding(2) var<uniform> turbulence: f32;

  // Water Effect Toggle
  @group(0) @binding(3) var<uniform> waterActive: f32;

  // Fire Effect Toggle
  @group(0) @binding(4) var<uniform> fireActive: f32;

  // Fire Color (0: Red, 1: Green, 2: Blue)
  @group(0) @binding(5) var<uniform> fireColor: f32;

`

// Noise functions
const noiseFunctions = `
  // 2D random from Simple Noise Chapter
  fn random(st: vec2f) -> f32 {
    return fract(sin(dot(st.xy, vec2f(12.9898,78.233))) * 43758.5453123);
  }

  // 2D noise from Simple Noise Chapter
  fn noise(st: vec2f) -> f32 {
    let i = floor(st);
    let f = fract(st);

    // Four corners in 2D of a tile
    let a = random(i);
    let b = random(i + vec2f(1.0, 0.0));
    let c = random(i + vec2f(0.0, 1.0));
    let d = random(i + vec2f(1.0, 1.0));

    // Smooth Interpolation
    let u = f * f * (3.0 - 2.0 * f);

    // Mix the four corners
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  // Turbulence Fractal Brownian Motion (fBM) from Fractal Brownian Motion Chapter
  fn fbm(st: vec2f) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = st;
    
    for (var i = 0; i < 5; i++) {
      value += amplitude * noise(pos);
      pos *= 2.0;
      amplitude *= 0.5;
    }
    
    return value;
  }

`

// Water fragment shader
const waterFragmentShader = `
  fn getWater(st: vec2f, time: f32, turbulence: f32) -> vec3f {
    
    var waterSt = st;
    // Aspect ratio correction
    waterSt.x *= resolution.x / resolution.y;

    // Part 1: Underwater current - Noise
    let flowSpeed = 1.0 + (turbulence * 0.8); 
    let flowStrength = 0.1 + (turbulence * 0.1); 
    let n = noise(waterSt * 3.0 + time * flowSpeed);
    let offset = vec2f(n, n) * flowStrength;
    var bgSt = waterSt + offset;

    // Part 2: Bubble Generation - generate bubbles based on Procedural Tiling
    var bubble = 0.0;
    
    // Assign this coordinate to a square
    let squareSize = 7.0 + turbulence * 10.0;
    let gridSt = waterSt * squareSize;
    let iPos = floor(gridSt); // Square Number
    let fPos = fract(gridSt); // Position within the square

    // Randomly decide if this square will have a bubble, influenced by turbulence
    let randValue = random(iPos);
    let threshold = 0.8 - turbulence * 0.4;

    // If above threshold, create a bubble
    if (randValue > threshold) {

      // Rising up animation
      let speed = 0.5 + turbulence * 0.8 + (randValue * 0.2);
      let yOffset = fract(time * speed + randValue);
      
      // Bubble positions and size
      let centerOffset = vec2f(random(iPos + 1.0), random(iPos + 2.0)) * 0.5;
      let bubbleCenter = centerOffset + 0.25;
      var bubblePos = vec2f(bubbleCenter.x, fract(bubbleCenter.y - yOffset));
      let bubbleSize = 0.03 + randValue * 0.05;

      // Bubble Rim Effect 
      let dist = distance(fPos, bubblePos);
      let rim = smoothstep(bubbleSize * 0.7, bubbleSize, dist);
      let outerFade = 1.0 - smoothstep(bubbleSize, bubbleSize + 0.05, dist);
      bubble = rim * outerFade;
    }

    // Part 3: Coloring
    // Water colors
    let deepBlue = vec3f(0.0, 0.8, 0.8);
    let surfaceBlue = vec3f(0.1, 0.1, 1.0);
    
    // Mix water colors based on depth
    let mixFactor = clamp(bgSt.y, 0.0, 1.0);
    var finalColor = mix(deepBlue, surfaceBlue, mixFactor);
    
    // lighting
    let lightPattern = noise(bgSt * 3.0 + time * 0.5);
    finalColor += vec3f(lightPattern * 0.05);
    
    // Bubble opacity
    finalColor += vec3f(bubble * 0.5);

    return finalColor;
  }

`

const fireFragmentShader = `
  fn getFire(st: vec2f, time: f32, colorMode: f32) -> vec3f {

    // Aspect ratio correction
    let aspect = resolution.x / resolution.y;
    // Reverse Y and center X
    var fireSt = vec2f(st.x - aspect * 0.35, 1.0 - st.y);

    // Fire Warping
    let warp = fbm(fireSt * 2.0 + vec2f(0.0, time * 2.0));
    fireSt.x += warp * 0.5;
    fireSt.y += warp * 0.25;

    // Flame shape
    let flameWidth = 0.5 - fireSt.y * 0.1;
    let dist = length(fireSt.x);
    var shape = smoothstep(flameWidth, flameWidth * 0.3, abs(fireSt.x));
    shape *= smoothstep(2.0, 0.5, fireSt.y);

    // Noise
    let noiseValue = fbm(vec2f(fireSt.x * 7.0, fireSt.y * 3.0 - time * 3.0));
    shape *= smoothstep(0.0, 0.8, shape * noiseValue);

    // Color grading
    var fireColor = vec3f(0.0);

    // Color modes
    if (colorMode < 0.5) {
      // Red and yellow flames
      let base = mix(vec3f(0.1, 0.0, 0.0), vec3f(1.0, 0.2, 0.0), st.y);
      fireColor = mix(base, vec3f(1.0, 0.9, 0.3), pow(shape, 2.0));
    
    } else if (colorMode < 1.5) {
      // Green flames
      let base = mix(vec3f(0.0, 0.05, 0.0), vec3f(0.1, 0.8, 0.1), st.y);
      fireColor = mix(base, vec3f(0.5, 1.0, 0.3), pow(shape, 2.0));
    
    } else {
      // Blue flames
      let base = mix(vec3f(0.1, 0.1, 0.1), vec3f(0.1, 0.3, 1.0), st.y);
      fireColor = mix(base, vec3f(0.6, 1.0, 1.0), pow(shape, 2.0));
    }

    // Final Color
    return fireColor * shape;

  }

`

const mainFragmentShader = `
  @fragment
  fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
    // Normalized pixel coordinates (from 0 to 1)
    var st = pos.xy / resolution; 

    // Get color from each element function
    let waterColor = getWater(st, time, turbulence);
    let fireColor = getFire(st, time, fireColor);
    
    // Black background
    var finalColor = vec3f(0.0);

    // Mix Elements
    finalColor = mix(finalColor, waterColor, waterActive);
    finalColor += fireColor * fireActive;

    return vec4f(finalColor, 1.0);
  }
`

// All shaders combined
const shader = quadVertexShader 
              + uniforms
              + noiseFunctions 
              + waterFragmentShader 
              + fireFragmentShader
              + mainFragmentShader


// Data to send to the GPU
const res_u = sg.uniform( [window.innerWidth, window.innerHeight] ) 
const time_u = sg.uniform( 0.0 ) 
const turb_u = sg.uniform( parseFloat(waterSlider.value) ) 
const waterActive_u = sg.uniform( waterToggle.checked ? 1.0 : 0.0 ) 
const fireActive_u = sg.uniform( fireToggle.checked ? 1.0 : 0.0 )
const fireColor_u = sg.uniform(0.0)

// UI Event Listeners
waterToggle.onchange = () => { waterActive_u.value = waterToggle.checked ? 1.0 : 0.0; };
waterSlider.onchange = () => { turb_u.value = parseFloat(waterSlider.value); };
fireRedButton.onclick = () => {fireColor_u.value = 0.0; };
fireGreenButton.onclick = () => {fireColor_u.value = 1.0; };
fireBlueButton.onclick = () => {fireColor_u.value = 2.0; };
fireToggle.onchange = () => { fireActive_u.value = fireToggle.checked ? 1.0 : 0.0; };

// create a render 
const render = await sg.render({ 
  shader,
  data:[
    res_u,
    time_u,
    turb_u,
    waterActive_u,
    fireActive_u,
    fireColor_u
  ],
  onframe() {
    time_u.value += 0.015 
  }
})

sg.run( render )

