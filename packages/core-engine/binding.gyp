{
  "targets": [
    {
      "target_name": "voice_cloning_addon",
      "sources": [
        "src/cpp/addon.cc",
        "src/cpp/voice_cloner.cc",
        "src/cpp/audio_processor.cc",
        "src/cpp/f5_tts_wrapper.cc",
        "src/cpp/memory_pool.cc",
        "src/cpp/python_service_client.cc",
        "src/cpp/config_manager.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "src/cpp",
        "../../third_party/f5-tts/src"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17", "-stdlib=libc++"],
            "OTHER_LDFLAGS": [
              "-lsndfile",
              "-lportaudio",
              "-framework", "CoreAudio",
              "-framework", "AudioToolbox",
              "-framework", "AudioUnit"
            ]
          },
          "link_settings": {
            "libraries": [
              "-lsndfile",
              "-lportaudio"
            ]
          }
        }],
        ["OS=='linux'", {
          "cflags": ["-std=c++17"],
          "cflags_cc": ["-std=c++17"],
          "link_settings": {
            "libraries": [
              "-lsndfile",
              "-lportaudio",
              "-lasound",
              "-lpthread"
            ]
          }
        }],
        ["OS=='win'", {
          "defines": [
            "_HAS_EXCEPTIONS=1"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}