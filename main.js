//import { default as gulls } from 'https://charlieroberts.codeberg.page/gulls/gulls.js'
import { default as gulls } from '/gulls.js'
import { default as Video } from './helpers/video.js'

// start seagulls, by default it will use the first <canvas> element it
// finds in your HTML page
const sg = await gulls.init()
await Video.init()

// a simple vertex shader to make a quad
const quadVertexShader = gulls.constants.vertex

// our fragment shader, just returns blue
const fragmentShader = `
// the sampler / texture for live video appear
// after all uniforms, storage buffers, and the
// sampler / texture for feedback.

//@group(0) @binding(0) var<uniform> resolution: vec2f;
//@group(0) @binding(1) var backSampler:    sampler;
//@group(0) @binding(2) var backBuffer:     texture_2d<f32>;
//@group(0) @binding(3) var videoSampler:   sampler;

// NOTE THAT THERE IS A DIFFERENT GROUP NUMBER FOR THE
// VIDEO TEXTURE BELOW. This lets gulls easily rebind
// the texture for each frame, without having to rebind
// the other variables in group 0. Given the new group,
// the binding index resets to 0.
//@group(1) @binding(0) var videoBuffer:    texture_external;

@fragment
fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
   //let p = pos.xy / resolution;

  // WebGPU requires us to use a different function to sample
  // from live video / video files
  //let video = textureSampleBaseClampToEdge( videoBuffer, videoSampler, p );

  // read the previous frame of video
 // let fb = textureSample( backBuffer, backSampler, p );

  // combine the circle and the feedback
 // let out = video * .05 + fb * .975;

  // return vec4f( out.rgb, 1. );
  return vec4f( 1.,0.,0. , 1. );
}
`

// our vertex + fragment shader together
const shader = quadVertexShader + fragmentShader

// create a render 
const render = await sg.render({ shader })

sg.run( render )

