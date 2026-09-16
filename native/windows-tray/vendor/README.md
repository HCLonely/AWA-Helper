Third-party sources are vendored so AWA-Manager can bootstrap without Node.js,
PowerShell, tar.exe or extra DLLs on the target computer.

- nlohmann/json 3.11.3: https://github.com/nlohmann/json/tree/v3.11.3
  (`single_include/nlohmann/json.hpp`, MIT license in `json.LICENSE`).
- miniz 3.0.2: https://github.com/richgel999/miniz/tree/3.0.2
  (`miniz_tinfl.c` and its headers, MIT license in `miniz.LICENSE`). Only the
  inflater is compiled. `miniz_export.h` supplies the static-build export macro.

Upstream source files are unmodified. License texts are included in Windows releases.
