#pragma once

#include <GL/glew.h>
#include <GL/freeglut.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include "settings.h"
#include "utils/loader.h"

using namespace glm;

class Shader
{
public:
    Shader() {

    }
    Shader(const std::string& vertex_path, const std::string& fragment_path) {
        GLint success;
        GLchar info_log[512];

        /* Read shader text from file */
        std::string vsh_text = Utils::read_file(vertex_path);
        std::string fsh_text = Utils::read_file(fragment_path);
        const char* vsh_text_p = vsh_text.c_str();
        const char* fsh_text_p = fsh_text.c_str();

        /* Create and Compile two shaders */
        GLuint vert_shader = glCreateShader(GL_VERTEX_SHADER);
        glShaderSource(vert_shader, 1, (const GLchar**)&vsh_text_p, NULL);
        glCompileShader(vert_shader);
        glGetShaderiv(vert_shader, GL_COMPILE_STATUS, &success);   // check
        if (!success)
        {
            glGetShaderInfoLog(vert_shader, 512, NULL, info_log);
            std::cout << "Shader complie error\n" << info_log << std::endl;
            exit(-1);
        }

        GLuint frag_shader = glCreateShader(GL_FRAGMENT_SHADER);
        glShaderSource(frag_shader, 1, (const GLchar**)&fsh_text_p, NULL);
        glCompileShader(frag_shader);
        glGetShaderiv(frag_shader, GL_COMPILE_STATUS, &success);   // check
        if (!success)
        {
            glGetShaderInfoLog(frag_shader, 512, NULL, info_log);
            std::cout << "Shader complie error\n" << info_log << std::endl;
            exit(-1);
        }

        /* Link shaders to the program */
        GLuint shader_program = glCreateProgram();
        glAttachShader(shader_program, vert_shader);
        glAttachShader(shader_program, frag_shader);
        glLinkProgram(shader_program);
        glGetProgramiv(shader_program, GL_LINK_STATUS, &success);
        if (!success) {
            glGetProgramInfoLog(shader_program, 512, NULL, info_log);
            std::cout << "link program error\n" << info_log << std::endl;
        }

        /* Delete shaders */
        glDeleteShader(vert_shader);
        glDeleteShader(frag_shader);

        program_ = shader_program;

    }

    ~Shader() {
        glDeleteBuffers(1, &VBO);
        glDeleteVertexArrays(1, &VAO);
        glDeleteFramebuffers(1, &FBO);
    }

    void init_buffer() {
        glGenFramebuffers(1, &FBO);
        glBindFramebuffer(GL_FRAMEBUFFER, FBO);
        glGenVertexArrays(1, &VAO);
        glBindVertexArray(VAO);
        glGenBuffers(1, &VBO);
        glBindBuffer(GL_ARRAY_BUFFER, VBO);

        std::vector<vec3> square = { vec3(-1, -1, 0), vec3(1, -1, 0), vec3(-1, 1, 0), vec3(1, 1, 0), vec3(-1, 1, 0), vec3(1, -1, 0) };
        glBufferData(GL_ARRAY_BUFFER, sizeof(vec3) * square.size(), NULL, GL_STATIC_DRAW);  // create empty buffer in GPU
        glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vec3) * square.size(), &square[0]);  // padding buffer
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid*)0);  // how to parse the buffer
        glEnableVertexAttribArray(0);  // enable 0 vertex attributes (data in GPU buffer is visible to vertex shader), the supported num of input attributes is at least 16
        glBindBuffer(GL_ARRAY_BUFFER, 0); // Note that this is allowed, the call to glVertexAttribPointer registered VBO as the currently bound vertex buffer object so afterwards we can safely unbind

        frame_color_attach_ = _generate_color_attach_for_frame_buffer();
        glBindTexture(GL_TEXTURE_2D, frame_color_attach_);
        glBindTexture(GL_TEXTURE_2D, 0);

        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, frame_color_attach_, 0);  // attach it to currently bound framebuffer object
        const GLenum buffers[]{ GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
        glDrawBuffers(2, buffers);
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
            std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
            exit(-1);
        }


        glBindVertexArray(0); // Unbind VAO (it's always a good thing to unbind any buffer/array to prevent strange bugs)
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
    }


    void draw() {
        glUseProgram(program_);

        /* Pass 1 */
        glBindFramebuffer(GL_FRAMEBUFFER, FBO);  // self-defined frame buffer, cannot be rendered to the viewport diretly
        glViewport(0, 0, Settings::WIDTH, Settings::HEIGHT);
        glClearColor(0.0, 0.0, 0.0, 1.0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        /* Pass 2 */
        glBindFramebuffer(GL_FRAMEBUFFER, 0);  // default frame buffer
        glViewport(0, 0, Settings::WIDTH, Settings::HEIGHT);
        glClearColor(0.0, 0.0, 0.0, 1.0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        glBindVertexArray(VAO);
        glBindTexture(GL_TEXTURE_2D, frame_color_attach_);  // Draw a quad that spans the entire screen with the new framebuffer's color buffer as its texture. 
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);


        glUseProgram(0);
    }

    GLuint get_program(){
        return program_;
    }

    void use(){
        glUseProgram(program_);
    }

    void unuse(){
        glUseProgram(0);
    }
private:
    GLuint VBO, VAO, FBO;

    GLuint program_;
    GLuint frame_color_attach_;

    GLuint _generate_color_attach_for_frame_buffer() {
        GLuint texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, Settings::WIDTH, Settings::HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
    }
};