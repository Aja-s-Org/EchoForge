{
  "targets": [
    {
      "target_name": "voice_cloning_addon",
      "sources": [
        "src/cpp/addon.cc",
        "src/cpp/voice_cloner.cc",
        "src/cpp/audio_processor.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "../../third_party/f5-tts/src"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"],
            "OTHER_LDFLAGS": [
              "-lsndfile",
              "-lportaudio"
            ]
          },
          "link_settings": {
            "libraries": [
              "-lsndfile",
              "-lportaudio"
            ]
          }
        }],
        ["OS=='win'", {
          "defines": [
            "_HAS_EXCEPTIONS=1"
          ]
        }],
        ["OS=='linux'", {
          "cflags": ["-std=c++17"],
          "cflags_cc": ["-std=c++17"],
          "link_settings": {
            "libraries": [
              "-lsndfile",
              "-lportaudio"
            ]
          }
        }]
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}