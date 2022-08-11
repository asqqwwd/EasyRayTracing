#pragma once

#include <GL/glew.h>
#include <GL/freeglut.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include "settings.h"
#include "utils/loader.h"
#include "utils/hdrloader.h"

using namespace glm;

class Shader
{
public:
    Shader() {

    }
    void create_program(const std::string& vertex_path, const std::string& fragment_path, size_t k) {
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

        if (k == 1) {
            program1_ = shader_program;
        }
        else if (k == 2) {
            program2_ = shader_program;
        }
        else {
            throw std::logic_error("Out of range");

        }
    }

    ~Shader() {
        glDeleteBuffers(1, &VBO);
        glDeleteVertexArrays(1, &VAO);
        glDeleteFramebuffers(1, &FBO);
    }

    void init_buffer() {
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
        glBindVertexArray(0); // Unbind VAO (it's always a good thing to unbind any buffer/array to prevent strange bugs)

        glGenFramebuffers(1, &FBO);
        glBindFramebuffer(GL_FRAMEBUFFER, FBO);
        frame_color_attach_ = generate_texture_RGBA32F(Settings::WIDTH, Settings::HEIGHT);
        glBindTexture(GL_TEXTURE_2D, frame_color_attach_);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, frame_color_attach_, 0);  // attach it to currently bound framebuffer object
        const GLenum buffers[]{ GL_COLOR_ATTACHMENT0 };
        // glDrawBuffers(1, buffers);
        glDrawBuffer(GL_COLOR_ATTACHMENT0);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
            std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
            exit(-1);
        }

        HDRLoaderResult hdr_res;
        if (!HDRLoader::load("../../texture/circus_arena_4k.hdr", hdr_res)) {
            std::cout << "Cannot open hdr" << std::endl;
            exit(-1);
        }
        hdr_map = generate_texture_RGBA32F(hdr_res.width, hdr_res.height);
        std::cout << hdr_res.width << " " << hdr_res.height << std::endl;
        glBindTexture(GL_TEXTURE_2D, hdr_map);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB32F, hdr_res.width, hdr_res.height, 0, GL_RGB, GL_FLOAT, hdr_res.cols);  // RGBA will crash!
    }


    void draw() {

        /* Pass 1 */
        use(1);

        glActiveTexture(GL_TEXTURE0);  // TEXTURE0 is actived as default
        glBindTexture(GL_TEXTURE_2D, hdr_map);
        glUniform1i(glGetUniformLocation(program1_, "hdr_map"), 0);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, frame_color_attach_);
        glUniform1i(glGetUniformLocation(program1_, "last_frame"), 1);

        glUniform1ui(glGetUniformLocation(program1_, "frame_counter"), frame_counter);
        glUniform1ui(glGetUniformLocation(program1_, "width"), Settings::WIDTH);
        glUniform1ui(glGetUniformLocation(program1_, "height"), Settings::HEIGHT);

        glBindFramebuffer(GL_FRAMEBUFFER, FBO);  // self-defined frame buffer, cannot be rendered to the viewport diretly
        // glViewport(0, 0, Settings::WIDTH, Settings::HEIGHT);
        // glClearColor(0.0, 0.0, 0.0, 1.0);
        // glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        unuse();


        /* Pass 2 */
        use(2);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, frame_color_attach_);  // Draw a quad that spans the entire screen with the new framebuffer's color buffer as its texture. 
        glUniform1i(glGetUniformLocation(program2_, "last_frame"), 0);
        // glBindTexture(GL_TEXTURE_2D, 0);  // import! cannot be implemented

        glBindFramebuffer(GL_FRAMEBUFFER, 0);  // default frame buffer
        // glViewport(0, 0, Settings::WIDTH, Settings::HEIGHT);
        // glClearColor(0.0, 0.0, 0.0, 1.0);
        // glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        unuse();

        ++frame_counter;
    }

    GLuint generate_texture_RGBA32F(size_t width, size_t height) {
        GLuint texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB32F, width, height, 0, GL_RGB, GL_FLOAT, NULL);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
    }

    GLuint get_program(size_t k) {
        if (k == 1) {
            return program1_;
        }
        else if (k == 2) {
            return program2_;
        }
        else {
            throw std::logic_error("Out of range");
            return 0;
        }
    }

    void use(size_t k) {
        if (k == 1) {
            glUseProgram(program1_);
        }
        else if (k == 2) {
            glUseProgram(program2_);
        }
        else {
            throw std::logic_error("Out of range");
        }
    }

    void unuse() {
        glUseProgram(0);
    }
private:
    GLuint VBO, VAO, FBO;

    GLuint program1_;
    GLuint program2_;
    GLuint frame_color_attach_;
    GLuint hdr_map;
    uint32_t frame_counter = 0;

};