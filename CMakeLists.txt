cmake_minimum_required(VERSION 3.10)

project(MainSolution)

set (Project_Name EzRT)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_BUILD_TYPE "Release")
# SET(CMAKE_BUILD_TYPE "Debug")
set (Is_Include_OpenCV false)
set (Is_Include_FreeGlut true)
set (Is_Include_Glew true)
set (Is_Include_Glm true)

file(GLOB_RECURSE SRC src/*.cpp src/*.h src/*.hpp)
add_executable(${Project_Name} ${SRC})

if (Is_Include_OpenCV)
    set(OpenCV_DIR "D:/ZH/opencv4.5.2/build")
    find_package(OpenCV REQUIRED)  
    include_directories(${OpenCV_INCLUDE_DIRS})
    link_directories(${OpenCV_LIBRARY_DIRS}) 
    target_link_libraries(${Project_Name} ${OpenCV_LIBS})
endif()

if(Is_Include_FreeGlut)
    target_include_directories(${Project_Name} PRIVATE "D:/ZH/freeglut-3.2.2/include")
    target_link_libraries(${Project_Name} "D:/ZH/freeglut-3.2.2/build/lib/Release/freeglut.lib")  # g++ -l
    target_link_libraries(${Project_Name} "D:/ZH/freeglut-3.2.2/build/lib/Debug/freeglutd.lib")  # g++ -l
    # Add freeglut.dll to PATH, no recursive dir!
endif()

if(Is_Include_Glew)
    target_include_directories(${Project_Name} PRIVATE "D:/ZH/glew-2.1.0/include")
    target_link_libraries(${Project_Name} "D:/ZH/glew-2.1.0/lib/Release/x64/glew32.lib")  # g++ -l
    # Add glew32.dll to PATH, no recursive dir!
endif()

if(Is_Include_Glm)
    target_include_directories(${Project_Name} PRIVATE "D:/ZH/glm")
endif()

message("***** "  ${PROJECT_NAME}  " ***** "  ${SRC}  " *****")