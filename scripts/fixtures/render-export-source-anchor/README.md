# Native opaque-anchor regression fixture

Unmodified source data and PNG exports for node `319:49669`, file `O2cGPbn2YCsU5ngavc80M9`, version `2409981372695293840`.
Retained from private `source-export-overlap-one-case-probe-v1/runs/20261015T163047Z-98460c3f`, completed 2026-10-15. Both source metadata reads were byte-identical, as were both exports of each PNG mode. `source.json` is the complete selected subtree, including invisible descendants.

The old whole-overlap proof refuses: 1,173 cross-mode pixels differ. A geometry-selected opaque region can establish exact correspondence at the recorded (14, 0) offset. This fixture does not assert a unique offset or a product pass. Full render PNG scoring remains unchanged.

SHA256:
- source.json: 8c77c6561b83516ccb9200cbceb1fdb435468a5ed640e59cfaabfcbfbcb33ccc
- layout.png: 4327357f9462cf4ea680b85556a3fe8c618df5754c75467320d5b57c1768e704
- render.png: 7341c4921751e3f089749ad119b32d626a0329bbc0fcef002704a61b7ae9fb31

Both image requests: GET /v1/images/O2cGPbn2YCsU5ngavc80M9; ids=319:49669; format=png; scale=1; contents_only=true; version=2409981372695293840. Layout uses use_absolute_bounds=true, render uses false. No signed download URLs or credentials are retained.
