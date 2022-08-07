#pragma once

#include <string>
#include <iostream>
#include <fstream>

namespace Utils {
    std::string read_file(const std::string& filepath) {
        std::string res, line;
        std::ifstream fin(filepath);
        if (!fin.is_open())
        {
            std::cout << "Open " << filepath << " fail!" << std::endl;
            exit(-1);
        }
        while (std::getline(fin, line))
        {
            res += line + '\n';
        }
        fin.close();
        return res;
    }
}
