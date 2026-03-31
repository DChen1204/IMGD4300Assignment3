//import { default as gulls } from 'https://charlieroberts.codeberg.page/gulls/gulls.js'
import { default as gulls } from './gulls.js'
import { default as Video } from './helpers/video.js'

// start seagulls, by default it will use the first <canvas> element it finds in your HTML page
const sg = await gulls.init()
await Video.init()


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

  // Mouse 
  @group(0) @binding(6) var<uniform> mouse: vec2f;

  // Earth Effect Toggle
  @group(0) @binding(7) var<uniform> earthActive: f32;

  // Electro Effect Toggle
  @group(0) @binding(8) var<uniform> electroActive: f32;

  // Electro Intensity
  @group(0) @binding(9) var<uniform> electroIntensity: f32;

  // Video
  @group(0) @binding(10) var<uniform> videoActive: f32;
  @group(0) @binding(11) var videoSampler: sampler;
  @group(1) @binding(0) var videoTexture: texture_external;

`

// Noise functions from the textbook
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

  // Cellcular noise formula 
  fn random2(st: vec2f) -> vec2f {
    return fract(sin(vec2f(
      dot(st, vec2f(127.1, 311.7)),
      dot(st, vec2f(269.5, 183.3))
      )) * 43758.5453);
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

    // Noise for holes in the middle of the flame
    let noiseValue = fbm(vec2f(fireSt.x * 7.0, fireSt.y * 3.0 - time * 3.0));
    shape *= smoothstep(0.0, 0.8, shape * noiseValue);

    // Color
    var fireColor = vec3f(0.0);
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

const earthFragmentShader = `
  fn getEarth(st: vec2f, mousePos: vec2f) -> vec3f {
    
    // Aspect ratio correction
    let aspect = resolution.x / resolution.y;
    var earthSt = vec2f(st.x * aspect, st.y);
    var earthMousePos = vec2f(mousePos.x * aspect, mousePos.y);

    // Tile the space 
    let scale = 5.0; 
    var i_st = floor(earthSt * scale); 
    var f_st = fract(earthSt * scale); 
    
    // Minimum distance 
    var mDist = 10.0; 
   
    // Iterate through neighboring tiles 
    for (var y = -1; y <= 1; y++) { 
      for (var x = -1; x <= 1; x++) { 
        let neighbor = vec2f(f32(x), f32(y)); 
        let point = random2(i_st + neighbor); 
        let diff = neighbor + point - f_st; 
        let dist = length(diff); 
        mDist = min(mDist, dist); 
      } 
    } 
       
    // Mouse Interaction 
    let mouseDist = distance(earthSt * scale, earthMousePos * scale); 
    mDist = min (mDist, mouseDist); 
    
    // Earth Colors 
    let dirtColor = vec3f(0.4, 0.25, 0.1);
    let crackColor = vec3f(0.1, 0.05, 0.0); 
    let crackMask = smoothstep(0.10, 0.70, mDist); 
    var color = mix(dirtColor, crackColor, crackMask); 
    color *= 0.8 + 0.2 * noise(earthSt * 20.0); 
       
    // Mouse glow 
    let mouseGlow = smoothstep(0.5, 0.0, mouseDist); 
    color += mouseGlow * vec3f(0.2, 0.1, 0.0); 
    
    return color;

  }

`

const electroFragmentShader = `

  // Return the distance to an electro line 
  fn getBoltDist(p: vec2f, origin: vec2f, angle: f32, time: f32) -> f32 {

    // Vector from mouse to pixel
    let v = p - origin;

    // Project onto the ray's direction 
    let dir = vec2f(cos(angle), sin(angle));
    let proj = dot(v, dir);
    if (proj < 0.0) {
      return 1000.0;
    }

    // Perpendicular offset 
    let perp = vec2f(-dir.y, dir.x);
    let offset = dot(v, perp);

    // Add noise for jaggedness
    let wiggleFreq = 10.0;
    let wiggleAmp = 0.15;
    let noiseVal = noise(vec2f(proj * wiggleFreq + time * 10.0, angle));
    let displacedCenter = noiseVal * wiggleAmp * proj;

    // Final distance of the pixel from the electro line
    return abs(offset - displacedCenter);
  }

  fn getElectro(st: vec2f, mousePos: vec2f, time: f32, intensity: f32) -> vec3f {
  
    // Return if mouse is not held down
    if (intensity < 0.01) {
      return vec3f(0.0);
    }

    // Aspect ratio correction
    let aspect = resolution.x / resolution.y;
    var electroSt = vec2f(st.x * aspect, st.y);
    var electroMousePos = vec2f(mousePos.x * aspect, mousePos.y);

    var totalElectro = 0.0;
    let numBolts = 12;

    // Generate bolts
    for (var i = 0; i < numBolts; i++) {

      // Bolt Angle
      let baseAngle = f32(i) * 6.28318 / f32(numBolts);
      let angle = baseAngle + time * 0.5;

      // Distance from pixel to bolt
      let dist = getBoltDist(electroSt, electroMousePos, angle, time);

      // Add glow 
      let core = smoothstep(0.03, 0.0, dist);
      let glow = smoothstep(0.15, 0.0, dist);

      totalElectro += core * 2.0 + glow;
    }
      
    // Fade out over distance
    let distFromMouse = distance(electroSt, electroMousePos);
    let fade = smoothstep(1.5, 0.0, distFromMouse);
    totalElectro *= fade;

    // Colors
    let coreColor = vec3f(1.0, 1.0, 1.0);
    let glowColor = vec3f(1.0, 0.9, 0.3);
    let outerColor = vec3f(0.3, 0.5, 1.0);
    var color = mix(glowColor, coreColor, smoothstep(0.5, 1.0, totalElectro));
    color = mix(outerColor, color, smoothstep(0.0, 0.5, totalElectro));

    return color * totalElectro;

  }

`

const mainFragmentShader = `
  @fragment
  fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
    // Normalized pixel coordinates (from 0 to 1)
    var st = pos.xy / resolution; 

    // Video Background
    var videoColor = textureSampleBaseClampToEdge(videoTexture, videoSampler, st).rgb;
    videoColor *= 0.3;

    // Get color from each element function
    let waterColor = getWater(st, time, turbulence);
    let fireColor = getFire(st, time, fireColor);
    let earthColor = getEarth(st, mouse);
    let electroColor = getElectro(st, mouse, time, electroIntensity);
    
    // Video background
    var finalColor = mix(vec3f(0.0), videoColor, videoActive);

    // Mix Elements
    finalColor += earthColor * earthActive;
    finalColor += waterColor * waterActive;
    finalColor += fireColor * fireActive;
    finalColor += electroColor * electroActive;

    return vec4f(finalColor, 1.0);
  }
`

// All shaders combined
const shader = quadVertexShader 
              + uniforms
              + noiseFunctions 
              + waterFragmentShader 
              + fireFragmentShader
              + earthFragmentShader
              + electroFragmentShader
              + mainFragmentShader


// HTML elements
const waterSlider = document.querySelector('#turbulence-slider')
const waterToggle = document.querySelector('#water-toggle')
const fireToggle = document.querySelector('#fire-toggle')
const fireRedButton = document.querySelector('#btn-fire-red')
const fireGreenButton = document.querySelector('#btn-fire-green')
const fireBlueButton = document.querySelector('#btn-fire-blue')
const earthToggle = document.querySelector('#earth-toggle')
const electroToggle = document.querySelector('#electro-toggle')
const videoToggle = document.querySelector('#video-toggle')

// Data to send to the GPU
const res_u = sg.uniform( [window.innerWidth, window.innerHeight] ) 
const time_u = sg.uniform( 0.0 ) 
const turb_u = sg.uniform( parseFloat(waterSlider.value) ) 
const waterActive_u = sg.uniform( waterToggle.checked ? 1.0 : 0.0 ) 
const fireActive_u = sg.uniform( fireToggle.checked ? 1.0 : 0.0 )
const fireColor_u = sg.uniform(0.0)
const mouse_u = sg.uniform( [0.0, 0.0] )
const earthActive_u = sg.uniform( earthToggle.checked ? 1.0 : 0.0 )
const electroActive_u = sg.uniform( electroToggle.checked ? 1.0 : 0.0 )
const electroIntensity_u = sg.uniform(0.0)
const videoActive_u = sg.uniform( videoToggle.checked ? 1.0 : 0.0 )

// UI Event Listeners
waterToggle.onchange = () => { waterActive_u.value = waterToggle.checked ? 1.0 : 0.0; };
waterSlider.onchange = () => { turb_u.value = parseFloat(waterSlider.value); };
fireRedButton.onclick = () => {fireColor_u.value = 0.0; };
fireGreenButton.onclick = () => {fireColor_u.value = 1.0; };
fireBlueButton.onclick = () => {fireColor_u.value = 2.0; };
fireToggle.onchange = () => { fireActive_u.value = fireToggle.checked ? 1.0 : 0.0; };
window.addEventListener('mousemove', (e) => {
  mouse_u.value = [e.clientX / window.innerWidth, e.clientY / window.innerHeight];
});
earthToggle.onchange = () => { earthActive_u.value = earthToggle.checked ? 1.0 : 0.0; };
electroToggle.onchange = () => { electroActive_u.value = electroToggle.checked ? 1.0 : 0.0; };
window.addEventListener('mousedown', () => { electroIntensity_u.value = 1.0; });
window.addEventListener('mouseup', () => { electroIntensity_u.value = 0.0; });
videoToggle.onchange = () => { videoActive_u.value = videoToggle.checked ? 1.0 : 0.0; };

// create a render 
const render = await sg.render({ 
  shader,
  data:[
    res_u,
    time_u,
    turb_u,
    waterActive_u,
    fireActive_u,
    fireColor_u,
    mouse_u,
    earthActive_u,
    electroActive_u,
    electroIntensity_u,
    videoActive_u,
    sg.sampler(),
    sg.video(Video.element)
  ],
  onframe() {
    time_u.value += 0.015 
  }
})

sg.run( render )

