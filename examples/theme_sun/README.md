Script-mode example (theme "和太阳奔跑", doodles only, no images, ~30 s). script.json was authored by an agent from the theme.
  python bpmv.py script -p examples/theme_sun/project.json      # plan
  python bpmv.py build  -p examples/theme_sun/project.json
  python bpmv.py sample -p examples/theme_sun/project.json --seconds 12 --fps 30
Music: "none" + pen foley. Try "music": {"mode": "auto"} for the composed backing track.
