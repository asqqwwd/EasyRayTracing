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

#include <typeinfo>

using namespace std;

Shader shader;


void display(void)
{
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

    shader.create_program("../../src/shader/vertex.vert", "../../src/shader/fragment.frag", 1);
    shader.create_program("../../src/shader/vertex.vert", "../../src/shader/mix.frag", 2);
    shader.init_buffer();

    glutDisplayFunc(display);
    glutIdleFunc(display); // force flush when idle
    glutMainLoop(); // main loop

    std::cout << "Exit" << std::endl;

    return 0;
}