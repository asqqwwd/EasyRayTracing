#version 430 core

/* Attributes */
in vec3 pixel;
layout (location = 0) out vec4 color;

/* Uniforms */
uniform uint frame_counter;
uniform uint width;
uniform uint height;

uniform sampler2D hdr_map;

/* Define */
#define PI 3.1415926


/* Tmp */
vec3 sphere_pos=vec3(0,.5,3);
float sphere_r=1;

vec2 sample_spherical_map(vec3 v){
    vec2 uv=vec2(atan(v.z,v.x),asin(v.y));// get yaw and pitch angle from dir vector
    uv/=vec2(2.*PI,PI);
    uv+=.5;
    uv.y=1.-uv.y;
    return uv;
}

vec3 sample_hdr(vec3 v){
    vec2 uv=sample_spherical_map(normalize(v));
    vec3 color=texture(hdr_map,uv).rgb;// texture2D is deprecated
    // vec3 color=texture2D(hdr_map,vec2(.8,.8)).rgb;
    // color = min(color, vec3(1));
    // color=color/(color+vec3(1,1,1));
    return color;
}

float sdf_sphere(vec3 p,vec3 c,float r)
{
    return distance(p,c)-r;
}

vec4 raymarch(vec3 pos,vec3 dir)
{
    for(int i=1;i<=50;i++)
    {
        float dis=sdf_sphere(pos,sphere_pos,sphere_r);
        if(dis>100){
            break;
        }
        if(dis<.001){
            return vec4(0,1,0,1);
        }
        pos+=dis*dir;
    }
    return vec4(sample_hdr(dir),1);
    // return vec4(1,1,1,1);
}

uint seed=uint(
    uint((pixel.x*.5+.5)*width)*uint(1973)+
    uint((pixel.y*.5+.5)*height)*uint(9277)+
    uint(frame_counter)*uint(26699))|uint(1);
    
    uint wang_hash(inout uint seed){
        seed=uint(seed^uint(61))^uint(seed>>uint(16));
        seed*=uint(9);
        seed=seed^(seed>>4);
        seed*=uint(0x27d4eb2d);
        seed=seed^(seed>>15);
        return seed;
    }
    
    float rand(){
        return float(wang_hash(seed))/4294967296.;
    }
    
    void main()
    {
        vec3 start_postion=vec3(0,0,0);
        vec2 AA=vec2((rand()-.5)/float(width),(rand()-.5)/float(height));
        vec3 dir=normalize(vec3(pixel.xy,1));
        
        color=raymarch(start_postion,dir);
    }