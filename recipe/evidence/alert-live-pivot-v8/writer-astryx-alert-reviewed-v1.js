const PLAN={"pageName":"Recipe Pivot / Alert / 4c13ca24-9b4bd337-b8dd06ed-alert-v8","runIdentity":"4c13ca24-9b4bd337-b8dd06ed-alert-v8","sources":[{"adapterIdentity":"astryx-alert-reviewed-v1","displayName":"Astryx","sourceName":"Astryx Banner","recipeHash":"4c13ca24d271870e9e6c9b50f754ad42f0be0e390c4feb1fb10aabfa0e0b8145","envelopeHash":"e967daf8a43cf19f2f41b5b130fd103e55cef3b36464155590200b3856660990","variables":[{"identity":"astryx.alert.states-error-boxBorder","name":"token/color/id-6173747279782e616c6572742e7374617465732d6572726f722d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"astryx.alert.states-error-boxFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d6572726f722d626f7846696c6c","type":"COLOR","value":"#e3193b33"},{"identity":"astryx.alert.states-error-iconFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d6572726f722d69636f6e46696c6c","type":"COLOR","value":"#e3193bff"},{"identity":"astryx.alert.states-error-title","name":"token/color/id-6173747279782e616c6572742e7374617465732d6572726f722d7469746c65","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.alert.states-info-boxBorder","name":"token/color/id-6173747279782e616c6572742e7374617465732d696e666f2d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"astryx.alert.states-info-boxFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d696e666f2d626f7846696c6c","type":"COLOR","value":"#0082fb33"},{"identity":"astryx.alert.states-info-iconFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d696e666f2d69636f6e46696c6c","type":"COLOR","value":"#0064e0ff"},{"identity":"astryx.alert.states-info-title","name":"token/color/id-6173747279782e616c6572742e7374617465732d696e666f2d7469746c65","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.alert.states-success-boxBorder","name":"token/color/id-6173747279782e616c6572742e7374617465732d737563636573732d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"astryx.alert.states-success-boxFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d737563636573732d626f7846696c6c","type":"COLOR","value":"#0b991f33"},{"identity":"astryx.alert.states-success-iconFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d737563636573732d69636f6e46696c6c","type":"COLOR","value":"#0d8626ff"},{"identity":"astryx.alert.states-success-title","name":"token/color/id-6173747279782e616c6572742e7374617465732d737563636573732d7469746c65","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.alert.states-warning-boxBorder","name":"token/color/id-6173747279782e616c6572742e7374617465732d7761726e696e672d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"astryx.alert.states-warning-boxFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d7761726e696e672d626f7846696c6c","type":"COLOR","value":"#e2a40033"},{"identity":"astryx.alert.states-warning-iconFill","name":"token/color/id-6173747279782e616c6572742e7374617465732d7761726e696e672d69636f6e46696c6c","type":"COLOR","value":"#e9af08ff"},{"identity":"astryx.alert.states-warning-title","name":"token/color/id-6173747279782e616c6572742e7374617465732d7761726e696e672d7469746c65","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.alert.box-borderWidth","name":"token/float/id-6173747279782e616c6572742e626f782d626f726465725769647468","type":"FLOAT","value":0},{"identity":"astryx.alert.box-gap","name":"token/float/id-6173747279782e616c6572742e626f782d676170","type":"FLOAT","value":8},{"identity":"astryx.alert.box-height","name":"token/float/id-6173747279782e616c6572742e626f782d686569676874","type":"FLOAT","value":44},{"identity":"astryx.alert.box-paddingX","name":"token/float/id-6173747279782e616c6572742e626f782d70616464696e6758","type":"FLOAT","value":16},{"identity":"astryx.alert.box-paddingY","name":"token/float/id-6173747279782e616c6572742e626f782d70616464696e6759","type":"FLOAT","value":12},{"identity":"astryx.alert.box-radius","name":"token/float/id-6173747279782e616c6572742e626f782d726164697573","type":"FLOAT","value":12},{"identity":"astryx.alert.icon-size","name":"token/float/id-6173747279782e616c6572742e69636f6e2d73697a65","type":"FLOAT","value":20},{"identity":"astryx.alert.titleFontSize","name":"token/float/id-6173747279782e616c6572742e7469746c65466f6e7453697a65","type":"FLOAT","value":14},{"identity":"astryx.alert.titleLineHeight","name":"token/float/id-6173747279782e616c6572742e7469746c654c696e65486569676874","type":"FLOAT","value":20}],"comparedIrFacts":93,"alertSet":{"label":"Astryx Banner","role":"alert/set","bindings":[],"kind":"component-set","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":16,"padding":{"top":16,"right":16,"bottom":16,"left":16},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[],"variantAxes":[{"name":"Status","values":["info","success","warning","error"]}],"children":[{"label":"Status=info","role":"alert/variant/info","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-info-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"astryx.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"astryx.alert.states-info-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":12,"right":16,"bottom":12,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":44}},"fills":[{"kind":"solid","color":"#0082fb33"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":12,"topRight":12,"bottomRight":12,"bottomLeft":12},"variantProperties":{"Status":"info"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"astryx.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-info-iconFill"}],"kind":"vector","assetRef":"M 7.5 0 C 3.3578 0 0 3.3578 0 7.5 C 0 11.6422 3.3578 15 7.5 15 C 11.6422 15 15 11.6422 15 7.5 C 15 3.3578 11.6422 0 7.5 0 Z M 7.5 3.3333 C 7.0398 3.3333 6.6667 3.7064 6.6667 4.1667 C 6.6667 4.6269 7.0398 5 7.5 5 C 7.9603 5 8.3333 4.6269 8.3333 4.1667 C 8.3333 3.7064 7.9603 3.3333 7.5 3.3333 Z M 6.875 6.4583 C 6.875 6.1132 7.1548 5.8333 7.5 5.8333 C 7.8452 5.8333 8.125 6.1132 8.125 6.4583 L 8.125 11.0417 C 8.125 11.3868 7.8452 11.6667 7.5 11.6667 C 7.1548 11.6667 6.875 11.3868 6.875 11.0417 L 6.875 6.4583 Z","width":{"mode":"fixed","value":15},"height":{"mode":"fixed","value":15},"fills":[{"kind":"solid","color":"#0064e0ff"}],"windingRule":"evenodd"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-info-title"}],"kind":"text","characters":"A new software update is available.","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"@astryxdesign/core/src/Banner/Banner.tsx title --text-label-size 14, --font-weight-semibold 600, --text-label-leading 1.4286","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold 600; Figma cannot load a CSS stack; first named host font available is SF Pro Semibold"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=success","role":"alert/variant/success","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-success-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"astryx.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"astryx.alert.states-success-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":12,"right":16,"bottom":12,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":44}},"fills":[{"kind":"solid","color":"#0b991f33"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":12,"topRight":12,"bottomRight":12,"bottomLeft":12},"variantProperties":{"Status":"success"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"astryx.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-success-iconFill"}],"kind":"vector","assetRef":"M 7.5 0 C 3.3578 0 0 3.3578 0 7.5 C 0 11.6422 3.3578 15 7.5 15 C 11.6422 15 15 11.6422 15 7.5 C 15 3.3578 11.6422 0 7.5 0 Z M 10.8833 5.4667 C 11.1134 5.2089 11.0911 4.8134 10.8333 4.5833 C 10.5756 4.3533 10.1801 4.3756 9.95 4.6333 L 6.6667 8.3 L 5.05 6.6833 C 4.8038 6.4538 4.42 6.4607 4.182 6.6987 C 3.944 6.9367 3.9372 7.3204 4.1667 7.5667 L 6.25 9.65 C 6.3715 9.7717 6.5377 9.838 6.7096 9.8333 C 6.8814 9.8285 7.0438 9.7532 7.1583 9.625 L 10.8833 5.4583 Z","width":{"mode":"fixed","value":15},"height":{"mode":"fixed","value":15},"fills":[{"kind":"solid","color":"#0d8626ff"}],"windingRule":"evenodd"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-success-title"}],"kind":"text","characters":"A new software update is available.","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"@astryxdesign/core/src/Banner/Banner.tsx title --text-label-size 14, --font-weight-semibold 600, --text-label-leading 1.4286","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold 600; Figma cannot load a CSS stack; first named host font available is SF Pro Semibold"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=warning","role":"alert/variant/warning","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-warning-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"astryx.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"astryx.alert.states-warning-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":12,"right":16,"bottom":12,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":44}},"fills":[{"kind":"solid","color":"#e2a40033"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":12,"topRight":12,"bottomRight":12,"bottomLeft":12},"variantProperties":{"Status":"warning"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"astryx.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-warning-iconFill"}],"kind":"vector","assetRef":"M 7.1255 0.8023 L 0.2755 13.4606 C 0 13.9706 0.0093 14.5871 0.2999 15.0886 C 0.5907 15.5901 1.121 15.9045 1.7005 15.9189 L 15.4005 15.9189 C 15.98 15.9045 16.5103 15.5901 16.8011 15.0886 C 17.0918 14.5871 17.101 13.9706 16.8255 13.4606 L 9.9755 0.8023 C 9.6733 0.3042 9.1331 0 8.5505 0 C 7.9679 0 7.4277 0.3042 7.1255 0.8023 Z M 8.5505 5.0856 C 8.8957 5.0856 9.1755 5.3654 9.1755 5.7106 L 9.1755 9.4606 C 9.1755 9.8058 8.8957 10.0856 8.5505 10.0856 C 8.2053 10.0856 7.9255 9.8058 7.9255 9.4606 L 7.9255 5.7106 C 7.9255 5.3654 8.2053 5.0856 8.5505 5.0856 Z M 8.5505 12.5856 C 9.0108 12.5856 9.3838 12.2125 9.3838 11.7523 C 9.3838 11.292 9.0108 10.9189 8.5505 10.9189 C 8.0903 10.9189 7.7172 11.292 7.7172 11.7523 C 7.7172 12.2125 8.0903 12.5856 8.5505 12.5856 Z","width":{"mode":"fixed","value":16.9506},"height":{"mode":"fixed","value":15.9189},"fills":[{"kind":"solid","color":"#e9af08ff"}],"windingRule":"evenodd"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-warning-title"}],"kind":"text","characters":"A new software update is available.","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"@astryxdesign/core/src/Banner/Banner.tsx title --text-label-size 14, --font-weight-semibold 600, --text-label-leading 1.4286","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold 600; Figma cannot load a CSS stack; first named host font available is SF Pro Semibold"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=error","role":"alert/variant/error","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-error-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"astryx.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"astryx.alert.states-error-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":12,"right":16,"bottom":12,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":44}},"fills":[{"kind":"solid","color":"#e3193b33"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":12,"topRight":12,"bottomRight":12,"bottomLeft":12},"variantProperties":{"Status":"error"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"astryx.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"astryx.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-error-iconFill"}],"kind":"vector","assetRef":"M 7.5 0 C 3.3578 0 0 3.3578 0 7.5 C 0 11.6422 3.3578 15 7.5 15 C 11.6422 15 15 11.6422 15 7.5 C 15 3.3578 11.6422 0 7.5 0 Z M 5.4417 4.5583 C 5.1954 4.3288 4.8117 4.3357 4.5737 4.5737 C 4.3357 4.8117 4.3288 5.1954 4.5583 5.4417 L 6.6167 7.5 L 4.5583 9.5583 C 4.3911 9.7142 4.3223 9.9488 4.3788 10.1703 C 4.4354 10.3917 4.6083 10.5646 4.8298 10.6212 C 5.0512 10.6777 5.2858 10.6089 5.4417 10.4417 L 7.5 8.3833 L 9.5583 10.4417 C 9.7142 10.6089 9.9488 10.6777 10.1703 10.6212 C 10.3917 10.5646 10.5646 10.3917 10.6212 10.1703 C 10.6777 9.9488 10.6089 9.7142 10.4417 9.5583 L 8.3833 7.5 L 10.4417 5.4417 C 10.6712 5.1954 10.6643 4.8117 10.4263 4.5737 C 10.1883 4.3357 9.8046 4.3288 9.5583 4.5583 L 7.5 6.6167 L 5.4417 4.5583 Z","width":{"mode":"fixed","value":15},"height":{"mode":"fixed","value":15},"fills":[{"kind":"solid","color":"#e3193bff"}],"windingRule":"evenodd"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.alert.states-error-title"}],"kind":"text","characters":"A new software update is available.","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"@astryxdesign/core/src/Banner/Banner.tsx title --text-label-size 14, --font-weight-semibold 600, --text-label-leading 1.4286","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold 600; Figma cannot load a CSS stack; first named host font available is SF Pro Semibold"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}]}}]};
const NS="ds.contracts.alert.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/alert/"+PLAN.runIdentity;
void "ALERT-WRITER-SHARED-RUNTIME";
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("ALERT-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("ALERT-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("ALERT-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("ALERT-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("ALERT-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("ALERT-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("ALERT-SWITCH-IDENTITY-REUSE");
if(NS==="ds.contracts.textarea.recipe.v1")throw new Error("ALERT-TEXTAREA-IDENTITY-REUSE");
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh",EXPECTED_FILE_NAME="Scratch Project";
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "ALERT-MUST-NOT-WRITE-ALERT-V7-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V6-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V5-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V4-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V3-PAGE";
void "ALERT-MUST-NOT-WRITE-INPUT-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V1-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V2-PAGE";
void "ALERT-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "ALERT-MUST-NOT-WRITE-COMBOBOX-V42-PAGE";
void "ALERT-MUST-NOT-WRITE-BUTTON-PAGE";
void "ALERT-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE";
void "ALERT-MUST-NOT-WRITE-TABLE-PAGE";
void "ALERT-MUST-NOT-WRITE-CALENDAR-PAGE";
void "ALERT-MUST-NOT-WRITE-CHECKBOX-PAGE";
void "ALERT-MUST-NOT-WRITE-RADIO-PAGE";
void "ALERT-MUST-NOT-WRITE-SWITCH-PAGE";
void "ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE";
if(figma.currentPage&&figma.currentPage.id==="218:87424")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V7-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:85931")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V6-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:84449")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V5-PAGE");
if(figma.currentPage&&figma.currentPage.id==="212:80840")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V4-PAGE");
if(figma.currentPage&&figma.currentPage.id==="209:79728")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V3-PAGE");
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("ALERT-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75801")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V1-PAGE");
if(figma.currentPage&&figma.currentPage.id==="208:79595")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V2-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("ALERT-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:70641")throw new Error("ALERT-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:69150")throw new Error("ALERT-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("ALERT-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("ALERT-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="181:64873")throw new Error("ALERT-MUST-NOT-WRITE-CALENDAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:74742")throw new Error("ALERT-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75031")throw new Error("ALERT-MUST-NOT-WRITE-RADIO-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75302")throw new Error("ALERT-MUST-NOT-WRITE-SWITCH-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75495")throw new Error("ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("ALERT-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("ALERT-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
if(page.id==="218:87424")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V7-PAGE");
if(page.id==="218:85931")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V6-PAGE");
if(page.id==="218:84449")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V5-PAGE");
if(page.id==="212:80840")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V4-PAGE");
if(page.id==="209:79728")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V3-PAGE");
if(page.id==="115:295378")throw new Error("ALERT-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="183:75801")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V1-PAGE");
if(page.id==="208:79595")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V2-PAGE");
if(page.id==="163:35981")throw new Error("ALERT-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="183:70641")throw new Error("ALERT-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(page.id==="183:69150")throw new Error("ALERT-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="85:6781")throw new Error("ALERT-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("ALERT-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="181:64873")throw new Error("ALERT-MUST-NOT-WRITE-CALENDAR-PAGE");
if(page.id==="183:74742")throw new Error("ALERT-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(page.id==="183:75031")throw new Error("ALERT-MUST-NOT-WRITE-RADIO-PAGE");
if(page.id==="183:75302")throw new Error("ALERT-MUST-NOT-WRITE-SWITCH-PAGE");
if(page.id==="183:75495")throw new Error("ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE");
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
// A font STYLE name is compared without case or spacing: foundries spell the
// same face "SemiBold", "Semibold" and "Semi Bold", and a fixture read from a
// CSS font-weight cannot know which spelling this machine's file uses.
const sameStyle=(a,b)=>String(a).toLowerCase().replace(/[s_-]/g,"")===String(b).toLowerCase().replace(/[s_-]/g,"");
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&sameStyle(font.fontName.style,candidate.style))).find(Boolean);
  if(!found)throw new Error("ALERT-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&sameStyle(found.fontName.style,spec.requestedStyle)?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||!sameStyle(found.fontName.style,spec.resolvedStyle)||resolution!==spec.resolution)throw new Error("ALERT-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("ALERT-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("ALERT-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Alert / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("ALERT-VARIABLE-COLLECTION-COLLISION:"+collectionName);
  const collection=figma.variables.createVariableCollection(collectionName);
  setSharedData(collection,"collectionOwner",PAGE_OWNER+"/variable-collection");
  setSharedData(collection,"runIdentity",PLAN.runIdentity);
  setSharedData(collection,"adapterIdentity",source.adapterIdentity);
  collection.renameMode(collection.modes[0].modeId,"Default");
  collection.hiddenFromPublishing=true;
  setSharedData(section,"variableCollectionId",collection.id);
  const modeId=collection.modes[0].modeId,variables=new Map();
  for(const planned of source.variables){
    const variable=figma.variables.createVariable(planned.name,collection,planned.type);
    variable.scopes=["ALL_SCOPES"];
    variable.setValueForMode(modeId,planned.type==="COLOR"?rgba(planned.value):planned.value);
    variable.setVariableCodeSyntax("WEB","var(--"+planned.identity.replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase()+")");
    variables.set(planned.type+":"+planned.identity,variable);
  }
  const boundPaint=(hex,binding)=>{
    const base=paint(hex);
    if(!binding)return base;
    const variable=variables.get("COLOR:"+binding.variable);
    if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
    return figma.variables.setBoundVariableForPaint(base,"color",variable);
  };
  const bindFloat=(node,field,binding)=>{
    if(!binding)return;
    const variable=variables.get("FLOAT:"+binding.variable);
    if(!variable)throw new Error("MISSING-FLOAT-VARIABLE:"+binding.variable);
    node.setBoundVariable(field,variable);
  };
  const bindingFor=(ir,field)=>(ir.bindings||[]).find(binding=>binding.field===field);
  const tag=(node,ir,ownershipKey)=>{
    setSharedData(node,"runIdentity",PLAN.runIdentity);
    setSharedData(node,"adapterIdentity",source.adapterIdentity);
    setSharedData(node,"recipeHash",source.recipeHash);
    setSharedData(node,"envelopeHash",source.envelopeHash);
    setSharedData(node,"ownershipKey",ownershipKey);
  };
  const applyPaints=(node,ir)=>{
    if(ir.fills)node.fills=ir.fills.map((entry,index)=>boundPaint(entry.color,bindingFor(ir,"fills."+index+".color")));
    if(ir.strokes){
      node.strokes=ir.strokes.map((entry,index)=>boundPaint(entry.paint.color,bindingFor(ir,"strokes."+index+".paint.color")));
      if(ir.strokes[0]){
        node.strokeWeight=ir.strokes[0].weight;node.strokeAlign=ir.strokes[0].align.toUpperCase();
        if(ir.strokes[0].dashPattern)node.dashPattern=ir.strokes[0].dashPattern;
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }else if(ir.kind==="vector"){node.strokes=[];}
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    void "ALERT-WRITER-EFFECTS";
    if(ir.effects){
      // A CSS box-shadow never paints under its own box. Figma's
      // showShadowBehindNode=true paints it there — visible through a
      // translucent fill (shadcn's unchecked checkbox) — but Figma renders a
      // knocked-out shadow (false) markedly DARKER than Chromium outside the
      // node (MUI switch thumb tail, measured: 73/76/84/88 vs real 27/37/44/54;
      // behind=true gave 45/51/71/80). So: behind the node only when the node
      // is fully opaque, where the two agree; knocked out only where it would
      // otherwise bleed through.
      const opaque=Array.isArray(ir.fills)&&ir.fills.length>0&&ir.fills.every(f=>rgba(f.color).a===1)&&(ir.opacity===undefined||ir.opacity===1);
      node.effects=ir.effects.map((effect,index)=>{
        const base=effect.kind==="drop-shadow"||effect.kind==="inner-shadow"?{type:effect.kind==="drop-shadow"?"DROP_SHADOW":"INNER_SHADOW",color:rgba(effect.color),offset:{x:effect.offsetX,y:effect.offsetY},radius:effect.blur,spread:effect.spread,showShadowBehindNode:opaque,visible:true,blendMode:"NORMAL"}:{type:effect.kind==="layer-blur"?"LAYER_BLUR":"BACKGROUND_BLUR",radius:effect.blur,visible:true};
        const binding=bindingFor(ir,"effects."+index+".color");
        if(!binding||!("color" in base))return base;
        const variable=variables.get("COLOR:"+binding.variable);
        if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
        return figma.variables.setBoundVariableForEffect(base,"color",variable);
      });
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const constraintValue=value=>({left:"MIN",right:"MAX",top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"})[value];
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    void "ALERT-WRITER-CLIPS-ONLY-WHEN-SAID";
    // Figma's frame default is clipsContent=true; CSS's overflow default is
    // visible. A frame clips only when the IR says so — otherwise a box's own
    // shadow is cut off at a hit area the same size as the box (shadcn) —
    // EXCEPT that Figma renders a frame's own drop shadow like Chromium only
    // when that frame clips (MUI switch thumb tail, measured against the real
    // render 27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a
    // row longer). So a shadowed frame clips unless the IR says otherwise.
    const shadowed=Array.isArray(ir.effects)&&ir.effects.some(e=>e.kind==="drop-shadow");
    node.clipsContent=ir.clipsContent===undefined?shadowed:ir.clipsContent;
    void "ALERT-WRITER-LAYOUT-MIN-WIDTH";
    if(layout.minWidth!==undefined){node.minWidth=layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(layout.minHeight!==undefined){node.minHeight=layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    if(layout.positioning==="absolute"){
      if(!layout.offset||!layout.constraints)throw new Error("ALERT-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);
      node.layoutPositioning="ABSOLUTE";
      node.constraints={horizontal:constraintValue(layout.constraints.horizontal),vertical:constraintValue(layout.constraints.vertical)};
    }
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
  };
  const isAbsolute=ir=>!!(ir.layout&&ir.layout.positioning==="absolute");
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    void "ALERT-WRITER-ABSOLUTE-CHILD-IS-FIXED-SIZED";
    if(isAbsolute(ir)){node.layoutSizingHorizontal="FIXED";node.layoutSizingVertical="FIXED";}
    else{
      if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
      else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
      else node.layoutSizingHorizontal="FIXED";
      if(height.mode==="fill")node.layoutSizingVertical="FILL";
      else if(height.mode==="hug")node.layoutSizingVertical="HUG";
      else node.layoutSizingVertical="FIXED";
    }
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applySetLayout=(set,ir)=>{applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  void "ALERT-WRITER-FIRST-SEGMENT-BIND";
  void "ALERT-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES";
  const placeAbsolute=(parentNode,parentIr)=>{
    for(const childIr of parentIr.children||[]){
      if(!isAbsolute(childIr))continue;
      const child=parentNode.children.find(c=>firstSegment(c.name)===childIr.role);
      if(!child)throw new Error("ALERT-ABSOLUTE-CHILD-MISSING:"+childIr.role);
      const off=childIr.layout.offset,c=childIr.layout.constraints;
      if(c.horizontal==="stretch"){child.x=off.x;child.resizeWithoutConstraints(Math.max(1,parentNode.width-2*off.x),child.height);}
      else if(c.horizontal==="right")child.x=parentNode.width-child.width+off.x;
      else if(c.horizontal==="center")child.x=(parentNode.width-child.width)/2+off.x;
      else child.x=off.x;
      if(c.vertical==="stretch"){child.y=off.y;child.resizeWithoutConstraints(child.width,Math.max(1,parentNode.height-2*off.y));}
      else if(c.vertical==="bottom")child.y=parentNode.height-child.height-off.y;
      else if(c.vertical==="center")child.y=(parentNode.height-child.height)/2+off.y;
      else child.y=off.y;
    }
  };
  void "ALERT-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
  const renderChildren=async(node,ir,ownershipKey)=>{
    const hugKids=[],fillKids=[];
    for(const [childIndex,child] of ir.children.entries()){
      const width=child.layout?child.layout.width:child.width;
      ((width&&width.mode==="fill"&&!isAbsolute(child))?fillKids:hugKids).push([childIndex,child]);
    }
    for(const [childIndex,child] of hugKids)await render(child,node,ownershipKey+"/children/"+childIndex);
    if(fillKids.length>0)applySizing(node,ir);
    for(const [childIndex,child] of fillKids)await render(child,node,ownershipKey+"/children/"+childIndex);
  };
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("ALERT-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      void "ALERT-WRITER-LETTER-SPACING";
      if(ir.type.letterSpacing)label.letterSpacing=ir.type.letterSpacing.unit==="px"?{unit:"PIXELS",value:ir.type.letterSpacing.value}:{unit:"PERCENT",value:ir.type.letterSpacing.value};
      if(ir.type.textCase==="upper")label.textCase="UPPER";else if(ir.type.textCase==="lower")label.textCase="LOWER";else if(ir.type.textCase==="title")label.textCase="TITLE";
      if(ir.type.textDecoration==="underline")label.textDecoration="UNDERLINE";else if(ir.type.textDecoration==="strikethrough")label.textDecoration="STRIKETHROUGH";
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "ALERT-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "ALERT-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
      if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
        const chain=ir.type.fontProvenance.fallbackChain||[];
        const resolvedFamily=ir.type.fontProvenance.resolvedFamily;
        const resolvedStyle=ir.type.fontProvenance.resolvedStyle;
        let painted=false;
        for(const candidate of chain){
          if(candidate.family===resolvedFamily&&candidate.style===resolvedStyle)continue;
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&entry.fontName.style===candidate.style);
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("ALERT-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="vector"){
      void "ALERT-WRITER-VECTOR-PATH";
      const vector=figma.createVector();
      vector.vectorPaths=[{windingRule:ir.windingRule==="evenodd"?"EVENODD":"NONZERO",data:ir.assetRef}];
      vector.effects=[];
      if(ir.strokeCap&&ir.strokeCap!=="none")vector.strokeCap=ir.strokeCap.toUpperCase();
      if(ir.strokeJoin)vector.strokeJoin=ir.strokeJoin.toUpperCase();
      if(ir.rotation)vector.rotation=ir.rotation;
      void "ALERT-WRITER-GLYPH-BOUNDS-GUARD";
      const wantW=ir.width.mode==="fixed"?ir.width.value:vector.width,wantH=ir.height.mode==="fixed"?ir.height.value:vector.height;
      if(Math.abs(vector.width-wantW)>0.05||Math.abs(vector.height-wantH)>0.05)throw new Error("ALERT-GLYPH-BOUNDS-MISMATCH:"+ir.role+":"+vector.width.toFixed(3)+"x"+vector.height.toFixed(3)+" vs "+wantW+"x"+wantH);
      node=vector;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "ALERT-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "ALERT-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("ALERT-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);await renderChildren(node,ir,ownershipKey);applySizing(node,ir);placeAbsolute(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));
      void "ALERT-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL";
      if(ir.type.lineHeight.unit!=="percent")bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      bindFloat(node,"letterSpacing",bindingFor(ir,"type.letterSpacing.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("ALERT-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintSet=async(setIr)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;
      component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");
      component.description="recipe-role:"+(ir.role||"");
      tag(component,ir,"alert/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      await renderChildren(component,ir,"alert/children/"+componentIndex);
      applySizing(component,ir);placeAbsolute(component,ir);
      if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("ALERT-FAKE-LAYOUT:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    void "ALERT-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
    set.name=setIr.role+" :: "+(setIr.label||source.sourceName);
    set.description="Experimental alert@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey","alert");
    return set;
  };
  const minted=await mintSet(source.alertSet);
  minted.x=80;minted.y=96;
  section.resizeWithoutConstraints(minted.width+160,minted.y+minted.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,setId:minted.id,collectionId:collection.id,variableCount:variables.size,variantCount:minted.children.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
