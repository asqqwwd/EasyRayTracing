#include <iostream>
#include <algorithm>
#include <vector>
#include <string>
#include <typeinfo>
#include <cassert>
#include <initializer_list>
#include <memory>
#include <cstdlib>
#include <string.h>



#include "settings.h"
#include "shader.hpp"
#include "utils/hdrloader.h"

#include <typeinfo>

using namespace std;

Shader shader;
uint32_t frame_counter = 0;

GLuint hdr_map;

void display(void)
{
    shader.use();
    glActiveTexture(GL_TEXTURE0);  // TEXTURE0 is actived as default
    glBindTexture(GL_TEXTURE_2D, hdr_map);
    glUniform1i(glGetUniformLocation(shader.get_program(), "hdr_map"), 0);
    // glBindTexture(GL_TEXTURE_2D, 0);

    glUniform1ui(glGetUniformLocation(shader.get_program(), "frame_counter"), ++frame_counter);
    shader.unuse();

    shader.draw();

    glutSwapBuffers(); // swap double buffer
}

void window_init(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB); // double buffer
    glutInitWindowSize(Settings::WIDTH, Settings::HEIGHT);
    glutInitWindowPosition(0, 0);
    glutCreateWindow("EzRT");

    glewExperimental = GL_TRUE;
    glewInit();

    // Define the viewport dimensions
    glViewport(0, 0, Settings::WIDTH, Settings::HEIGHT);
}


int main(int argc, char** argv)
{
    window_init(argc, argv);

    shader = Shader("../../src/shader/vertex.vert", "../../src/shader/fragment.frag");
    shader.init_buffer();

    HDRLoaderResult hdr_res;
    if (!HDRLoader::load("../../texture/circus_arena_4k.hdr", hdr_res)) {
        std::cout << "Cannot open hdr" << std::endl;
        exit(-1);
    }
    hdr_map = shader.generate_texture_RGBA32F(hdr_res.width, hdr_res.height);
    std::cout << hdr_res.width << " " << hdr_res.height << std::endl;
    glBindTexture(GL_TEXTURE_2D, hdr_map);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB32F, hdr_res.width, hdr_res.height, 0, GL_RGB, GL_FLOAT, hdr_res.cols);  // RGBA will crash!
    glBindTexture(GL_TEXTURE_2D, 0);

    /* Deliver uniform, glUseProgram() is necessary */
    shader.use();

   

    glUniform1ui(glGetUniformLocation(shader.get_program(), "width"), Settings::WIDTH);
    glUniform1ui(glGetUniformLocation(shader.get_program(), "height"), Settings::HEIGHT);
    shader.unuse();


    // glGenVertexArrays(1, &VAO);
    // glGenBuffers(1, &VBO);
    // // Bind the Vertex Array Object first, then bind and set vertex buffer(s) and attribute pointer(s).
    // glBindVertexArray(VAO);

    // glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid*)0);
    // glEnableVertexAttribArray(0);

    // glBindBuffer(GL_ARRAY_BUFFER, 0); // Note that this is allowed, the call to glVertexAttribPointer registered VBO as the currently bound vertex buffer object so afterwards we can safely unbind

    // glBindVertexArray(0); // Unbind VAO (it's always a good thing to unbind any buffer/array to prevent strange bugs)

    // GLint nrAttributes;
    // glGetIntegerv(GL_MAX_VERTEX_ATTRIBS, &nrAttributes);
    // std::cout << "Maximum nr of vertex attributes supported: " << nrAttributes << std::endl;

    glutDisplayFunc(display);
    glutIdleFunc(display); // force flush when idle
    glutMainLoop(); // main loop

    // Properly de-allocate all resources once they've outlived their purpose

    std::cout << "Exit" << std::endl;

    return 0;
}