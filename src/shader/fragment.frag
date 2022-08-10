#version 430 core

/* Attributes */
in vec3 pixel;
// layout (location = 0) out vec4 color;
out vec4 color;

/* Uniforms */
uniform uint frame_counter;
uniform uint width;
uniform uint height;

uniform sampler2D hdr_map;
uniform sampler2D last_frame;

/* Define */
#define PI 3.1415926
#define DIST_FUNC map
#define RAYMARCH_MAX_STEP 30
#define RAYMARCH_MAX_DIS 100
#define RAYMARCH_MIN_DIS 0.001

/* Tmp */
vec3 sphere_pos=vec3(0,.6,3);
vec3 sphere_pos2=vec3(0,-.6,3);
float sphere_r=1;
float sphere_r2=1;
vec3 light_pos=vec3(1.5,2.5,1.5);
vec3 camera_pos = vec3(0,1.5,1.5);
vec3 camera_gaze = vec3(0,0,0);


/* SDF object */
float dot2( in vec2 v ) { return dot(v,v); }
float dot2( in vec3 v ) { return dot(v,v); }
float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

float sdPlane( vec3 p )
{
	return p.y;
}

float sdSphere( vec3 p, float s )
{
    return length(p)-s;
}

float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdBoxFrame( vec3 p, vec3 b, float e )
{
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;

  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}
float sdEllipsoid( in vec3 p, in vec3 r ) // approximated
{
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
}

float sdTorus( vec3 p, vec2 t )
{
    return length( vec2(length(p.xz)-t.x,p.y) )-t.y;
}

float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
{
    p.x = abs(p.x);
    float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
}

float sdHexPrism( vec3 p, vec2 h )
{
    vec3 q = abs(p);

    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(
       length(p.xy - vec2(clamp(p.x, -k.z*h.x, k.z*h.x), h.x))*sign(p.y - h.x),
       p.z-h.y );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdOctogonPrism( in vec3 p, in float r, float h )
{
  const vec3 k = vec3(-0.9238795325,   // sqrt(2+sqrt(2))/2 
                       0.3826834323,   // sqrt(2-sqrt(2))/2
                       0.4142135623 ); // sqrt(2)-1 
  // reflections
  p = abs(p);
  p.xy -= 2.0*min(dot(vec2( k.x,k.y),p.xy),0.0)*vec2( k.x,k.y);
  p.xy -= 2.0*min(dot(vec2(-k.x,k.y),p.xy),0.0)*vec2(-k.x,k.y);
  // polygon side
  p.xy -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
  vec2 d = vec2( length(p.xy)*sign(p.y), p.z-h );
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
	vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r;
}

float sdRoundCone( in vec3 p, in float r1, float r2, float h )
{
    vec2 q = vec2( length(p.xz), p.y );
    
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(q,vec2(-b,a));
    
    if( k < 0.0 ) return length(q) - r1;
    if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
        
    return dot(q, vec2(a,b) ) - r1;
}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2)
{
    // sampling independent computations (only depend on shape)
    vec3  ba = b - a;
    float l2 = dot(ba,ba);
    float rr = r1 - r2;
    float a2 = l2 - rr*rr;
    float il2 = 1.0/l2;
    
    // sampling dependant computations
    vec3 pa = p - a;
    float y = dot(pa,ba);
    float z = y - l2;
    float x2 = dot2( pa*l2 - ba*y );
    float y2 = y*y*l2;
    float z2 = z*z*l2;

    // single square root!
    float k = sign(rr)*rr*rr*x2;
    if( sign(z)*a2*z2 > k ) return  sqrt(x2 + z2)        *il2 - r2;
    if( sign(y)*a2*y2 < k ) return  sqrt(x2 + y2)        *il2 - r1;
                            return (sqrt(x2*a2*il2)+y*rr)*il2 - r1;
}

float sdTriPrism( vec3 p, vec2 h )
{
    const float k = sqrt(3.0);
    h.x *= 0.5*k;
    p.xy /= h.x;
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x+k*p.y>0.0 ) p.xy=vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0, 0.0 );
    float d1 = length(p.xy)*sign(-p.y)*h.x;
    float d2 = abs(p.z)-h.y;
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
}

// vertical
float sdCylinder( vec3 p, vec2 h )
{
    vec2 d = abs(vec2(length(p.xz),p.y)) - h;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

// arbitrary orientation
float sdCylinder(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a;
    vec3 ba = b - a;
    float baba = dot(ba,ba);
    float paba = dot(pa,ba);

    float x = length(pa*baba-ba*paba) - r*baba;
    float y = abs(paba-baba*0.5)-baba*0.5;
    float x2 = x*x;
    float y2 = y*y*baba;
    float d = (max(x,y)<0.0)?-min(x2,y2):(((x>0.0)?x2:0.0)+((y>0.0)?y2:0.0));
    return sign(d)*sqrt(abs(d))/baba;
}

// vertical
float sdCone( in vec3 p, in vec2 c, float h )
{
    vec2 q = h*vec2(c.x,-c.y)/c.y;
    vec2 w = vec2( length(p.xz), p.y );
    
	vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
    float k = sign( q.y );
    float d = min(dot( a, a ),dot(b, b));
    float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
	return sqrt(d)*sign(s);
}

float sdCappedCone( in vec3 p, in float h, in float r1, in float r2 )
{
    vec2 q = vec2( length(p.xz), p.y );
    
    vec2 k1 = vec2(r2,h);
    vec2 k2 = vec2(r2-r1,2.0*h);
    vec2 ca = vec2(q.x-min(q.x,(q.y < 0.0)?r1:r2), abs(q.y)-h);
    vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot2(k2), 0.0, 1.0 );
    float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
    return s*sqrt( min(dot2(ca),dot2(cb)) );
}

float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb)
{
    float rba  = rb-ra;
    float baba = dot(b-a,b-a);
    float papa = dot(p-a,p-a);
    float paba = dot(p-a,b-a)/baba;

    float x = sqrt( papa - paba*paba*baba );

    float cax = max(0.0,x-((paba<0.5)?ra:rb));
    float cay = abs(paba-0.5)-0.5;

    float k = rba*rba + baba;
    float f = clamp( (rba*(x-ra)+paba*baba)/k, 0.0, 1.0 );

    float cbx = x-ra - f*rba;
    float cby = paba - f;
    
    float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
    
    return s*sqrt( min(cax*cax + cay*cay*baba,
                       cbx*cbx + cby*cby*baba) );
}

// c is the sin/cos of the desired cone angle
float sdSolidAngle(vec3 pos, vec2 c, float ra)
{
    vec2 p = vec2( length(pos.xz), pos.y );
    float l = length(p) - ra;
	float m = length(p - c*clamp(dot(p,c),0.0,ra) );
    return max(l,m*sign(c.y*p.x-c.x*p.y));
}

float sdOctahedron(vec3 p, float s)
{
    p = abs(p);
    float m = p.x + p.y + p.z - s;

    // exact distance
    #if 0
    vec3 o = min(3.0*p - m, 0.0);
    o = max(6.0*p - m*2.0 - o*3.0 + (o.x+o.y+o.z), 0.0);
    return length(p - s*o/(o.x+o.y+o.z));
    #endif
    
    // exact distance
    #if 1
 	vec3 q;
         if( 3.0*p.x < m ) q = p.xyz;
    else if( 3.0*p.y < m ) q = p.yzx;
    else if( 3.0*p.z < m ) q = p.zxy;
    else return m*0.57735027;
    float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
    return length(vec3(q.x,q.y-s+k,q.z-k)); 
    #endif
    
    // bound, not exact
    #if 0
	return m*0.57735027;
    #endif
}

float sdPyramid( in vec3 p, in float h )
{
    float m2 = h*h + 0.25;
    
    // symmetry
    p.xz = abs(p.xz);
    p.xz = (p.z>p.x) ? p.zx : p.xz;
    p.xz -= 0.5;
	
    // project into face plane (2D)
    vec3 q = vec3( p.z, h*p.y - 0.5*p.x, h*p.x + 0.5*p.y);
   
    float s = max(-q.x,0.0);
    float t = clamp( (q.y-0.5*p.z)/(m2+0.25), 0.0, 1.0 );
    
    float a = m2*(q.x+s)*(q.x+s) + q.y*q.y;
	float b = m2*(q.x+0.5*t)*(q.x+0.5*t) + (q.y-m2*t)*(q.y-m2*t);
    
    float d2 = min(q.y,-q.x*m2-q.y*0.5) > 0.0 ? 0.0 : min(a,b);
    
    // recover 3D and scale, and add sign
    return sqrt( (d2+q.z*q.z)/m2 ) * sign(max(q.z,-p.y));;
}

// la,lb=semi axis, h=height, ra=corner
float sdRhombus(vec3 p, float la, float lb, float h, float ra)
{
    p = abs(p);
    vec2 b = vec2(la,lb);
    float f = clamp( (ndot(b,b-2.0*p.xz))/dot(b,b), -1.0, 1.0 );
	vec2 q = vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra, p.y-h);
    return min(max(q.x,q.y),0.0) + length(max(q,0.0));
}

float sdHorseshoe( in vec3 p, in vec2 c, in float r, in float le, vec2 w )
{
    p.x = abs(p.x);
    float l = length(p.xy);
    p.xy = mat2(-c.x, c.y, 
              c.y, c.x)*p.xy;
    p.xy = vec2((p.y>0.0 || p.x>0.0)?p.x:l*sign(-c.x),
                (p.x>0.0)?p.y:l );
    p.xy = vec2(p.x,abs(p.y-r))-vec2(le,0.0);
    
    vec2 q = vec2(length(max(p.xy,0.0)) + min(0.0,max(p.x,p.y)),p.z);
    vec2 d = abs(q) - w;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdU( in vec3 p, in float r, in float le, vec2 w )
{
    p.x = (p.y>0.0) ? abs(p.x) : length(p.xy);
    p.x = abs(p.x-r);
    p.y = p.y - le;
    float k = max(p.x,p.y);
    vec2 q = vec2( (k<0.0) ? -k : length(max(p.xy,0.0)), abs(p.z) ) - w;
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
}

vec2 sample_spherical_map(vec3 v)
{
    vec2 uv=vec2(atan(v.z,v.x),asin(v.y));// get yaw and pitch angle from dir vector
    uv/=vec2(2.*PI,PI);
    uv+=.5;
    uv.y=1.-uv.y;
    return uv;
}

vec2 opU( vec2 d1, vec2 d2 )
{
	return (d1.x<d2.x) ? d1 : d2;
}

/* Mix function */
float map( in vec3 pos )
{
    vec2 res = vec2( 1e10, 0.0 );

    // {
    //   res = opU( res, vec2( sdSphere(    pos-vec3(-2.0,0.25, 0.0), 0.25 ), 26.9 ) );
	//   res = opU( res, vec2( sdRhombus(   (pos-vec3(-2.0,0.25, 1.0)).xzy, 0.15, 0.25, 0.04, 0.08 ),17.0 ) );
    // }

    {
        res = opU(res, vec2(sdBox(pos-vec3(0,0,-1),vec3(3, 0.01, 3)),26.9));
    }

    // bounding box
    if( sdBox( pos-vec3(0.0,0.3,-1.0),vec3(0.35,0.3,2.5) )<res.x )
    {
    // more primitives
    res = opU( res, vec2( sdBoxFrame(    pos-vec3( 0.0,0.25, 0.0), vec3(0.3,0.25,0.2), 0.025 ), 16.9 ) );
	res = opU( res, vec2( sdTorus(      (pos-vec3( 0.0,0.30, 1.0)).xzy, vec2(0.25,0.05) ), 25.0 ) );
	res = opU( res, vec2( sdCone(        pos-vec3( 0.0,0.45,-1.0), vec2(0.6,0.8),0.45 ), 55.0 ) );
    res = opU( res, vec2( sdCappedCone(  pos-vec3( 0.0,0.25,-2.0), 0.25, 0.25, 0.1 ), 13.67 ) );
    res = opU( res, vec2( sdSolidAngle(  pos-vec3( 0.0,0.00,-3.0), vec2(3,4)/5.0, 0.4 ), 49.13 ) );
    }

    // // bounding box
    // if( sdBox( pos-vec3(1.0,0.3,-1.0),vec3(0.35,0.3,2.5) )<res.x )
    // {
    // // more primitives
	// res = opU( res, vec2( sdCappedTorus((pos-vec3( 1.0,0.30, 1.0))*vec3(1,-1,1), vec2(0.866025,-0.5), 0.25, 0.05), 8.5) );
    // res = opU( res, vec2( sdBox(         pos-vec3( 1.0,0.25, 0.0), vec3(0.3,0.25,0.1) ), 3.0 ) );
    // res = opU( res, vec2( sdCapsule(     pos-vec3( 1.0,0.00,-1.0),vec3(-0.1,0.1,-0.1), vec3(0.2,0.4,0.2), 0.1  ), 31.9 ) );
	// res = opU( res, vec2( sdCylinder(    pos-vec3( 1.0,0.25,-2.0), vec2(0.15,0.25) ), 8.0 ) );
    // res = opU( res, vec2( sdHexPrism(    pos-vec3( 1.0,0.2,-3.0), vec2(0.2,0.05) ), 18.4 ) );
    // }

    // // bounding box
    // if( sdBox( pos-vec3(-1.0,0.35,-1.0),vec3(0.35,0.35,2.5))<res.x )
    // {
    // // more primitives
	// res = opU( res, vec2( sdPyramid(    pos-vec3(-1.0,-0.6,-3.0), 1.0 ), 13.56 ) );
	// res = opU( res, vec2( sdOctahedron( pos-vec3(-1.0,0.15,-2.0), 0.35 ), 23.56 ) );
    // res = opU( res, vec2( sdTriPrism(   pos-vec3(-1.0,0.15,-1.0), vec2(0.3,0.05) ),43.5 ) );
    // res = opU( res, vec2( sdEllipsoid(  pos-vec3(-1.0,0.25, 0.0), vec3(0.2, 0.25, 0.05) ), 43.17 ) );
    // res = opU( res, vec2( sdHorseshoe(  pos-vec3(-1.0,0.25, 1.0), vec2(cos(1.3),sin(1.3)), 0.2, 0.3, vec2(0.03,0.08) ), 11.5 ) );
    // }

    // // bounding box
    // if( sdBox( pos-vec3(2.0,0.3,-1.0),vec3(0.35,0.3,2.5) )<res.x )
    // {
    // // more primitives
    // res = opU( res, vec2( sdOctogonPrism(pos-vec3( 2.0,0.2,-3.0), 0.2, 0.05), 51.8 ) );
    // res = opU( res, vec2( sdCylinder(    pos-vec3( 2.0,0.15,-2.0), vec3(0.1,-0.1,0.0), vec3(-0.2,0.35,0.1), 0.08), 31.2 ) );
	// res = opU( res, vec2( sdCappedCone(  pos-vec3( 2.0,0.10,-1.0), vec3(0.1,0.0,0.0), vec3(-0.2,0.40,0.1), 0.15, 0.05), 46.1 ) );
    // res = opU( res, vec2( sdRoundCone(   pos-vec3( 2.0,0.15, 0.0), vec3(0.1,0.0,0.0), vec3(-0.1,0.35,0.1), 0.15, 0.05), 51.7 ) );
    // res = opU( res, vec2( sdRoundCone(   pos-vec3( 2.0,0.20, 1.0), 0.2, 0.1, 0.3 ), 37.0 ) );
    // }
    
    return res.x;
}


vec3 sample_hdr(vec3 v)
{
    vec2 uv=sample_spherical_map(normalize(v));
    vec3 color=texture(hdr_map,uv).rgb;// texture2D is deprecated
    // vec3 color=texture2D(hdr_map,vec2(.8,.8)).rgb;
    // color = min(color, vec3(1));
    // color=color/(color+vec3(1,1,1));
    return color;
}

vec3 get_normal(vec3 p)
{
    float d=DIST_FUNC(p);
    vec2 e=vec2(.01,0);
    
    vec3 n=d-vec3(DIST_FUNC(p-e.xyy),DIST_FUNC(p-e.yxy),DIST_FUNC(p-e.yyx));
    return normalize(n);
}

vec3 lambert(vec3 p)
{
    light_pos.xz+=vec2(sin(float(frame_counter)/100/PI),cos(float(frame_counter)/100/PI));
    vec3 l=normalize(light_pos-p);
    vec3 n=get_normal(p);
    
    vec3 dif=clamp(dot(n,l),0.,1.)*vec3(.3,.5,0);
    vec3 ambient=vec3(.1,.1,.1);
    
    return dif+ambient;
}



uint seed=uint(uint((pixel.x*.5+.5)*width)*uint(1973)+uint((pixel.y*.5+.5)*height)*uint(9277)+uint(frame_counter)*uint(26699))|uint(1);

uint wang_hash(inout uint seed){
    seed=uint(seed^uint(61))^uint(seed>>uint(16));
    seed*=uint(9);
    seed=seed^(seed>>4);
    seed*=uint(0x27d4eb2d);
    seed=seed^(seed>>15);
    return seed;
}

float rand()
{
    return float(wang_hash(seed))/4294967296.;
}

mat4 get_RT_view(vec3 pos,vec3 lookdir)
{
    mat4 T_model = mat4(1);  // identity matrix
    T_model[0][3] = pos[0];
    T_model[1][3] = pos[1];
    T_model[2][3] = pos[2];
    mat4 T_view = mat4(T_model);
    T_view[0][3] *= -1;
    T_view[1][3] *= -1;
    T_view[2][3] *= -1;

    mat4 R_model = mat4(1);  // identity matrix
    vec3 w = normalize(lookdir);
    vec3 v = normalize(vec3(-w[2], 0, w[0]));
    vec3 u = normalize(cross(v,w));
    for(int i=0;i<3;++i){
        R_model[i][0] = v[i];
        R_model[i][1] = u[i];
        R_model[i][2] = w[i];
    }
    mat4 R_view = transpose(R_model);

    return transpose(T_model) * transpose(R_model);
}

vec3 sample_hemisphere() {
    float z = rand();
    float r = max(0, sqrt(1.0 - z*z));
    float phi = 2.0 * PI * rand();
    return vec3(r * cos(phi), r * sin(phi), z);
}

vec3 project_hemisphere2normal(vec3 v, vec3 N) {
    vec3 helper = vec3(1, 0, 0);
    if(abs(N.x)>0.999) helper = vec3(0, 0, 1);
    vec3 tangent = normalize(cross(N, helper));
    vec3 bitangent = normalize(cross(N, tangent));
    return v.x * tangent + v.y * bitangent + v.z * N;
}

vec3 raymarch_hit(vec3 pos,vec3 dir,inout bool is_hit)
{
    for(int k=1;k<=RAYMARCH_MAX_STEP;k++)
    {
        float dis=DIST_FUNC(pos);
        if(dis>RAYMARCH_MAX_DIS){
            break;
        }
        if(dis<RAYMARCH_MIN_DIS){
            is_hit=true;
            return pos;
            // return vec4(lambert(pos),1);
        }
        pos+=dis*dir;
    }
    is_hit=false;
    return vec3(0,0,0);
    // return vec4(sample_hdr(dir),1);
}

vec3 raytracing(vec3 pos, vec3 dir)
{
    vec3 ret=vec3(0,0,0);

    bool is_hit = false;
    vec3 hit_pos = pos;
    vec3 wi=dir;
    vec3 Li=vec3(1, 1, 1);
    vec3 Lo;
    for(int bounce=0;bounce<3;++bounce){
        vec3 wo = project_hemisphere2normal(sample_hemisphere(),get_normal(hit_pos));

        vec3 hit_pos=raymarch_hit(hit_pos,wi,is_hit);
        float pdf = 1.0 / (2.0 * PI);                                  
        float cosine_i = max(0, dot(wi, get_normal(hit_pos))); 
        if(!is_hit){
            ret += Li*sample_hdr(dir)/PI*cosine_i/pdf;
            return ret;
        }

        // vec3 f_r = BaseColor/PI;           
        Lo=Li*vec3(0.8, 0.6, 0) / PI*cosine_i/pdf;

        wi=wo;
        Li=Lo;
        ret+=Lo;
    }
    return ret;
}


void main()
{
    vec3 start_postion=camera_pos;
    vec2 AA=vec2((rand()-.5)/float(width),(rand()-.5)/float(height));
    vec4 dir=normalize(get_RT_view(camera_pos,camera_gaze-camera_pos)*vec4(pixel.xy+AA,1,0));
    
    // vec3 cur_color = raytracing(start_postion,dir.xyz);
    vec3 cur_color = vec3(0,0,0);
    if(rand()>0.95){
        cur_color = vec3(1,0,0);
    }

    if(frame_counter==0){
        color = vec4(cur_color,1);
    }
    else{
        vec3 last_color = texture(last_frame, pixel.xy*0.5+0.5).rgb;
        color = vec4(last_color,1);
    }

    // // color = vec4(mix(last_color, cur_color, 1.0/float(frame_counter+1)),1);
    // vec3 sum = cur_color+last_color;
    // sum = clamp(sum,vec3(0,0,0 ) ,vec3(1,1,1));
    // color = vec4(cur_color,1);
    // color = vec4(cur_color,1);
    // color = vec4(0.8,0.2,0,1.0);
}