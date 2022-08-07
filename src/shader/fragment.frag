#version 430 core

/* Attributes */
in vec3 pixel;
layout (location = 0) out vec4 color;

/* Uniforms */
uniform uint frame_counter;
uniform uint width;
uniform uint height;

vec3 sphere_pos = vec3(0, 0, 3);
float sphere_r = 1;

bool sphereHit (vec3 p)
{
    return distance(p,vec3(0,0,3)) < 1;
}

float sdf_sphere(vec3 p, vec3 c, float r)
{
    return distance(p,c) - r;
}

vec4 raymarch (vec3 position, vec3 direction)
{
    for (int i = 1; i < 50; i++)
    {
        float dis = sdf_sphere(position,sphere_pos,sphere_r);
        if (dis > 100)
            break;
        if (dis < 0.001)
            return vec4(1/float(frame_counter),0,0,1);
        position += dis * direction;

        // if(dis > 0){
        //     position += direction * 0.2;
        // }
        // else{
        //     return vec4(1, 0, 0, 1);
        // }

        // if(sphereHit(position)){
        //     return vec4(0, float(1)/float(i), 0, 1);
        // }
        // else{
        //     position += direction * 0.2;
        // }
    }
    return vec4(1,1,1,1);
}

uint seed = uint(
    uint((pixel.x * 0.5 + 0.5) * width)  * uint(1973) + 
    uint((pixel.y * 0.5 + 0.5) * height) * uint(9277) + 
    uint(frame_counter) * uint(26699)) | uint(1);

uint wang_hash(inout uint seed) {
    seed = uint(seed ^ uint(61)) ^ uint(seed >> uint(16));
    seed *= uint(9);
    seed = seed ^ (seed >> 4);
    seed *= uint(0x27d4eb2d);
    seed = seed ^ (seed >> 15);
    return seed;
}

float rand() {
    return float(wang_hash(seed)) / 4294967296.0;
}

void main()
{
    vec3 start_postion = vec3(0,0,0);
    vec2 AA = vec2((rand()-0.5)/float(width), (rand()-0.5)/float(height));
    vec4 dir = vec4(pixel.xy, 1, 0.0);
    vec3 direction = normalize(dir.xyz);

    color = raymarch(start_postion,direction);
}