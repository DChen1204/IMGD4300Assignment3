//import { default as gulls } from 'https://charlieroberts.codeberg.page/gulls/gulls.js'
import { default as gulls } from '/gulls.js'

// start seagulls, by default it will use the first <canvas> element it
// finds in your HTML page
const sg   = await gulls.init()

// a simple vertex shader to make a quad
const quadVertexShader = gulls.constants.vertex

// our fragment shader, just returns blue
const fragmentShader = `
@fragment
fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
  return vec4(0., 0., 1., 1. );
}
`

// our vertex + fragment shader together
const shader = quadVertexShader + fragmentShader

// create a render pass
const renderPass = await sg.render({ shader })

// run our render pass
sg.run( renderPass )