#version 430 core

in vec3 pixel;
// layout (location = 0) out vec4 color;
out vec4 color;

uniform sampler2D last_frame;

void main() {
    color = vec4(texture(last_frame, pixel.xy*0.5+0.5).rgb, 1.0);
    // color = vec4(pixel.xy*0.5+0.5,0,1.0);
}
