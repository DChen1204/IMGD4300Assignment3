//import { default as gulls } from 'https://charlieroberts.codeberg.page/gulls/gulls.js'
import { default as gulls } from '/gulls.js'
// import { default as Video } from './helpers/video.js'

// start seagulls, by default it will use the first <canvas> element it finds in your HTML page
const sg = await gulls.init()
//await Video.init()

// HTML elements
const slider = document.querySelector('#turbulence-slider')
const waterToggle = document.querySelector('#water-toggle')

// a simple vertex shader to make a quad
const quadVertexShader = gulls.constants.vertex

// Water fragment shader
const waterFragmentShader = `
  // Resolution
  @group(0) @binding(0) var<uniform> resolution: vec2f;

  // Time
  @group(0) @binding(1) var<uniform> time: f32;

  // Water Turbulence
  @group(0) @binding(2) var<uniform> turbulence: f32;

  // Water Toggle
  @group(0) @binding(3) var<uniform> waterActive: f32;

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

  @fragment
  fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
    // Normalized pixel coordinates (from 0 to 1)
    var st = pos.xy / resolution;
    // Aspect ratio correction
    st.x *= resolution.x / resolution.y;

    // Part 1: Underwater current
    let flowSpeed = 1.0 + (turbulence * 0.8); 
    let flowStrength = 0.1 + (turbulence * 0.1); 
    // Noise
    let n = noise(st * 3.0 + time * flowSpeed);
    let offset = vec2f(n, n) * flowStrength;
    var bgSt = st + offset;

    // Part 2: Bubbles
    // Generate bubbles based on Procedural Tiles
    // It divides the screen into squares,
    // randomly decide which squares have bubbles,
    // animates it rising up,
    // draw the bubbles as a ring. 
    let squareSize = 7.0 + turbulence * 10.0;
    let gridSt = st * squareSize;
    let iPos = floor(gridSt);
    let fPos = fract(gridSt);
    let randValue = random(iPos);
    let threshold = 0.8 - turbulence * 0.4;
    var bubble = 0.0;
    if (randValue > threshold) {
      let centerOffset = vec2f(random(iPos + 1.0), random(iPos + 2.0)) * 0.5;
      let bubbleCenter = centerOffset + 0.25;

      // Animate rising up
      let speed = 0.5 + turbulence * 0.8 + (randValue * 0.2);
      let yOffset = fract(time * speed + randValue);

      // Bubble aesthetics
      var bubblePos = vec2f(bubbleCenter.x, fract(bubbleCenter.y - yOffset));
      let bubbleSize = 0.03 + randValue * 0.05;
      let dist = distance(fPos, bubblePos);
      let rim = smoothstep(bubbleSize * 0.7, bubbleSize, dist);
      let outerFade = 1.0 - smoothstep(bubbleSize, bubbleSize + 0.05, dist);
      bubble = rim * outerFade;
    }

    // Part 3: Coloring
    let deepBlue = vec3f(0.0, 0.8, 0.8);
    let surfaceBlue = vec3f(0.1, 0.1, 1.0);
    // mix Color
    let mixFactor = clamp(bgSt.y, 0.0, 1.0);
    var finalColor = mix(deepBlue, surfaceBlue, mixFactor);
    // light pattern
    let lightPattern = noise(bgSt * 3.0 + time * 0.5);
    finalColor += vec3f(lightPattern * 0.05);
    // bubbles
    finalColor += vec3f(bubble * 0.5);

    // Toggle
    finalColor *= waterActive;

    return vec4f(finalColor, 1.0);
  }

`

// our vertex + fragment shader together
const shader = quadVertexShader + waterFragmentShader

// Data to send to the GPU
const res_u = sg.uniform( [window.innerWidth, window.innerHeight] ) 
const time_u = sg.uniform( 0.0 ) 
const turb_u = sg.uniform( parseFloat(slider.value) ) 
const waterActive_u = sg.uniform( waterToggle.checked ? 1.0 : 0.0 ) 

// create a render 
const render = await sg.render({ 
  shader,
  data:[
    res_u,
    time_u,
    turb_u,
    waterActive_u
  ],
  onframe() {
    time_u.value += 0.015 
    turb_u.value = parseFloat(slider.value) 
    waterActive_u.value = waterToggle.checked ? 1.0 : 0.0
  }
})

sg.run( render )

