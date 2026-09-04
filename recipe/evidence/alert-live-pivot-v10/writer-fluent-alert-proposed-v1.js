const PLAN={"pageName":"Recipe Pivot / Alert / 4c13ca24-9b4bd337-b8dd06ed-eb151709-83c23591-3cc66b45-b7744674-alert-v10","runIdentity":"4c13ca24-9b4bd337-b8dd06ed-eb151709-83c23591-3cc66b45-b7744674-alert-v10","sources":[{"adapterIdentity":"fluent-alert-proposed-v1","displayName":"Fluent (proposed)","sourceName":"Fluent (proposed) Alert","recipeHash":"b77446740369abe2f8aefffae61ac37e7cce9f7bf3e7de4b51d17bee57f6b974","envelopeHash":"4399da6aad0299208e230fb63585911bb2737e92680215527e4a5e577bca864d","variables":[{"identity":"fluent.alert.states-error-boxBorder","name":"token/color/id-666c75656e742e616c6572742e7374617465732d6572726f722d626f78426f72646572","type":"COLOR","value":"#eeacb2ff"},{"identity":"fluent.alert.states-error-boxFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d6572726f722d626f7846696c6c","type":"COLOR","value":"#fdf3f4ff"},{"identity":"fluent.alert.states-error-iconFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d6572726f722d69636f6e46696c6c","type":"COLOR","value":"#b10e1cff"},{"identity":"fluent.alert.states-error-title","name":"token/color/id-666c75656e742e616c6572742e7374617465732d6572726f722d7469746c65","type":"COLOR","value":"#242424ff"},{"identity":"fluent.alert.states-info-boxBorder","name":"token/color/id-666c75656e742e616c6572742e7374617465732d696e666f2d626f78426f72646572","type":"COLOR","value":"#d1d1d1ff"},{"identity":"fluent.alert.states-info-boxFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d696e666f2d626f7846696c6c","type":"COLOR","value":"#f5f5f5ff"},{"identity":"fluent.alert.states-info-iconFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d696e666f2d69636f6e46696c6c","type":"COLOR","value":"#616161ff"},{"identity":"fluent.alert.states-info-title","name":"token/color/id-666c75656e742e616c6572742e7374617465732d696e666f2d7469746c65","type":"COLOR","value":"#242424ff"},{"identity":"fluent.alert.states-success-boxBorder","name":"token/color/id-666c75656e742e616c6572742e7374617465732d737563636573732d626f78426f72646572","type":"COLOR","value":"#9fd89fff"},{"identity":"fluent.alert.states-success-boxFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d737563636573732d626f7846696c6c","type":"COLOR","value":"#f1faf1ff"},{"identity":"fluent.alert.states-success-iconFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d737563636573732d69636f6e46696c6c","type":"COLOR","value":"#0e700eff"},{"identity":"fluent.alert.states-success-title","name":"token/color/id-666c75656e742e616c6572742e7374617465732d737563636573732d7469746c65","type":"COLOR","value":"#242424ff"},{"identity":"fluent.alert.states-warning-boxBorder","name":"token/color/id-666c75656e742e616c6572742e7374617465732d7761726e696e672d626f78426f72646572","type":"COLOR","value":"#fdcfb4ff"},{"identity":"fluent.alert.states-warning-boxFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d7761726e696e672d626f7846696c6c","type":"COLOR","value":"#fff9f5ff"},{"identity":"fluent.alert.states-warning-iconFill","name":"token/color/id-666c75656e742e616c6572742e7374617465732d7761726e696e672d69636f6e46696c6c","type":"COLOR","value":"#bc4b09ff"},{"identity":"fluent.alert.states-warning-title","name":"token/color/id-666c75656e742e616c6572742e7374617465732d7761726e696e672d7469746c65","type":"COLOR","value":"#242424ff"},{"identity":"fluent.alert.box-borderWidth","name":"token/float/id-666c75656e742e616c6572742e626f782d626f726465725769647468","type":"FLOAT","value":1},{"identity":"fluent.alert.box-gap","name":"token/float/id-666c75656e742e616c6572742e626f782d676170","type":"FLOAT","value":8},{"identity":"fluent.alert.box-height","name":"token/float/id-666c75656e742e616c6572742e626f782d686569676874","type":"FLOAT","value":36},{"identity":"fluent.alert.box-paddingX","name":"token/float/id-666c75656e742e616c6572742e626f782d70616464696e6758","type":"FLOAT","value":12},{"identity":"fluent.alert.box-paddingY","name":"token/float/id-666c75656e742e616c6572742e626f782d70616464696e6759","type":"FLOAT","value":0},{"identity":"fluent.alert.box-radius","name":"token/float/id-666c75656e742e616c6572742e626f782d726164697573","type":"FLOAT","value":4},{"identity":"fluent.alert.icon-size","name":"token/float/id-666c75656e742e616c6572742e69636f6e2d73697a65","type":"FLOAT","value":20},{"identity":"fluent.alert.titleFontSize","name":"token/float/id-666c75656e742e616c6572742e7469746c65466f6e7453697a65","type":"FLOAT","value":14},{"identity":"fluent.alert.titleLineHeight","name":"token/float/id-666c75656e742e616c6572742e7469746c654c696e65486569676874","type":"FLOAT","value":20}],"comparedIrFacts":93,"alertSet":{"label":"Fluent (proposed) Alert","role":"alert/set","bindings":[],"kind":"component-set","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":16,"padding":{"top":16,"right":16,"bottom":16,"left":16},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[],"variantAxes":[{"name":"Status","values":["info","success","warning","error"]}],"children":[{"label":"Status=info","role":"alert/variant/info","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"fluent.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-info-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"fluent.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"fluent.alert.states-info-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"fluent.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"fixed","value":36}},"fills":[{"kind":"solid","color":"#f5f5f5ff"}],"strokes":[{"weight":1,"align":"inside","paint":{"kind":"solid","color":"#d1d1d1ff"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"info"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"fluent.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-info-iconFill"}],"kind":"vector","assetRef":"M 16 8 C 16 3.5817 12.4183 0 8 0 C 3.5817 0 0 3.5817 0 8 C 0 12.4183 3.5817 16 8 16 C 12.4183 16 16 12.4183 16 8 Z M 7.5 6.91 C 7.5 6.6339 7.7239 6.41 8 6.41 C 8.2761 6.41 8.5 6.6339 8.5 6.91 L 8.5 11.6 C 8.5 11.8761 8.2761 12.1 8 12.1 C 7.7239 12.1 7.5 11.8761 7.5 11.6 L 7.5 6.9 Z M 7.25 4.74 C 7.25 4.3258 7.5858 3.99 8 3.99 C 8.4142 3.99 8.75 4.3258 8.75 4.74 C 8.75 5.1542 8.4142 5.49 8 5.49 C 7.5858 5.49 7.25 5.1542 7.25 4.74 Z","width":{"mode":"fixed","value":16},"height":{"mode":"fixed","value":16},"fills":[{"kind":"solid","color":"#616161ff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"fluent.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"fluent.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-info-title"}],"kind":"text","characters":"Descriptive title","type":{"fontFamily":"Roboto","fontStyle":"SemiBold","fontProvenance":{"requestedFamily":"Segoe UI","requestedStyle":"Semibold","requestSource":"extract/computed/out/fluent/messagebar/captured-truth.json title font-family/font-weight: \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto,  / Semibold; reviewed fallback: the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600","fallbackChain":[{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"SemiBold"}],"resolvedFamily":"Roboto","resolvedStyle":"SemiBold","resolution":"fallback","degradation":"the requested face Segoe UI Semibold is not on the minting machine; minted with Roboto SemiBold — the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#242424ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=success","role":"alert/variant/success","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"fluent.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-success-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"fluent.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"fluent.alert.states-success-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"fluent.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"fixed","value":36}},"fills":[{"kind":"solid","color":"#f1faf1ff"}],"strokes":[{"weight":1,"align":"inside","paint":{"kind":"solid","color":"#9fd89fff"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"success"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"fluent.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-success-iconFill"}],"kind":"vector","assetRef":"M 8 0 C 12.4183 0 16 3.5817 16 8 C 16 12.4183 12.4183 16 8 16 C 3.5817 16 0 12.4183 0 8 C 0 3.5817 3.5817 0 8 0 Z M 11.36 5.65 C 11.1895 5.4773 10.9196 5.4521 10.72 5.59 L 10.65 5.65 L 7 9.3 L 5.35 7.65 L 5.28 7.59 C 5.0809 7.4407 4.8024 7.4605 4.6264 7.6364 C 4.4505 7.8124 4.4307 8.0909 4.58 8.29 L 4.65 8.36 L 6.65 10.36 L 6.72 10.42 C 6.89 10.53 7.12 10.53 7.28 10.42 L 7.35 10.36 L 11.35 6.36 L 11.42 6.28 C 11.5524 6.0824 11.5273 5.819 11.36 5.65 Z","width":{"mode":"fixed","value":16},"height":{"mode":"fixed","value":16},"fills":[{"kind":"solid","color":"#0e700eff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"fluent.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"fluent.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-success-title"}],"kind":"text","characters":"Descriptive title","type":{"fontFamily":"Roboto","fontStyle":"SemiBold","fontProvenance":{"requestedFamily":"Segoe UI","requestedStyle":"Semibold","requestSource":"extract/computed/out/fluent/messagebar/captured-truth.json title font-family/font-weight: \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto,  / Semibold; reviewed fallback: the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600","fallbackChain":[{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"SemiBold"}],"resolvedFamily":"Roboto","resolvedStyle":"SemiBold","resolution":"fallback","degradation":"the requested face Segoe UI Semibold is not on the minting machine; minted with Roboto SemiBold — the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#242424ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=warning","role":"alert/variant/warning","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"fluent.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-warning-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"fluent.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"fluent.alert.states-warning-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"fluent.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"fixed","value":36}},"fills":[{"kind":"solid","color":"#fff9f5ff"}],"strokes":[{"weight":1,"align":"inside","paint":{"kind":"solid","color":"#fdcfb4ff"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"warning"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"fluent.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-warning-iconFill"}],"kind":"vector","assetRef":"M 6.0084 1.5567 C 6.5352 0.5967 7.5433 0 8.6384 0 C 9.7335 0 10.7416 0.5967 11.2684 1.5567 L 16.7684 11.5567 C 17.2768 12.4859 17.2576 13.6143 16.7178 14.5256 C 16.1779 15.4369 15.1976 15.9961 14.1384 15.9967 L 3.1384 15.9967 C 2.0792 15.9961 1.0989 15.4369 0.559 14.5256 C 0.0192 13.6143 0 12.4859 0.5084 11.5567 Z M 8.6384 10.7467 C 8.2242 10.7467 7.8884 11.0825 7.8884 11.4967 C 7.8884 11.9109 8.2242 12.2467 8.6384 12.2467 C 9.0526 12.2467 9.3884 11.9109 9.3884 11.4967 C 9.3884 11.0825 9.0526 10.7467 8.6384 10.7467 Z M 8.6384 4.4967 C 8.3623 4.4967 8.1384 4.7206 8.1384 4.9967 L 8.1384 8.9967 C 8.1384 9.2728 8.3623 9.4967 8.6384 9.4967 C 8.9145 9.4967 9.1384 9.2728 9.1384 8.9967 L 9.1384 4.9967 C 9.1384 4.7206 8.9145 4.4967 8.6384 4.4967 Z","width":{"mode":"fixed","value":16.9964},"height":{"mode":"fixed","value":15.9967},"fills":[{"kind":"solid","color":"#bc4b09ff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"fluent.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"fluent.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-warning-title"}],"kind":"text","characters":"Descriptive title","type":{"fontFamily":"Roboto","fontStyle":"SemiBold","fontProvenance":{"requestedFamily":"Segoe UI","requestedStyle":"Semibold","requestSource":"extract/computed/out/fluent/messagebar/captured-truth.json title font-family/font-weight: \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto,  / Semibold; reviewed fallback: the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600","fallbackChain":[{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"SemiBold"}],"resolvedFamily":"Roboto","resolvedStyle":"SemiBold","resolution":"fallback","degradation":"the requested face Segoe UI Semibold is not on the minting machine; minted with Roboto SemiBold — the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#242424ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=error","role":"alert/variant/error","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"fluent.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"fluent.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"fluent.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-error-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"fluent.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"fluent.alert.states-error-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"fluent.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"fluent.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":8,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"fixed","value":36}},"fills":[{"kind":"solid","color":"#fdf3f4ff"}],"strokes":[{"weight":1,"align":"inside","paint":{"kind":"solid","color":"#eeacb2ff"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"error"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"fluent.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"fluent.alert.icon-size"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":20},"height":{"mode":"fixed","value":20}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-error-iconFill"}],"kind":"vector","assetRef":"M 7.1698 1.1698 C 8.3411 0 10.2385 0 11.4098 1.1698 L 17.4098 7.1698 C 18.5796 8.3411 18.5796 10.2385 17.4098 11.4098 L 11.4098 17.4098 C 10.2385 18.5796 8.3411 18.5796 7.1698 17.4098 L 1.1698 11.4098 C 0 10.2385 0 8.3411 1.1698 7.1698 Z M 12.3898 6.1898 C 12.1954 5.9992 11.8842 5.9992 11.6898 6.1898 L 9.2898 8.5898 L 6.8898 6.1898 C 6.6907 6.0405 6.4122 6.0603 6.2362 6.2362 C 6.0603 6.4122 6.0405 6.6907 6.1898 6.8898 L 8.5898 9.2898 L 6.1898 11.6898 C 6.0405 11.8889 6.0603 12.1674 6.2362 12.3434 C 6.4122 12.5193 6.6907 12.5391 6.8898 12.3898 L 9.2898 9.9898 L 11.6898 12.3898 C 11.8889 12.5391 12.1674 12.5193 12.3434 12.3434 C 12.5193 12.1674 12.5391 11.8889 12.3898 11.6898 L 9.9898 9.2898 L 12.3898 6.8898 C 12.5804 6.6954 12.5804 6.3842 12.3898 6.1898 Z","width":{"mode":"fixed","value":17.9947},"height":{"mode":"fixed","value":17.9947},"fills":[{"kind":"solid","color":"#b10e1cff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"fluent.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"fluent.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"fluent.alert.states-error-title"}],"kind":"text","characters":"Descriptive title","type":{"fontFamily":"Roboto","fontStyle":"SemiBold","fontProvenance":{"requestedFamily":"Segoe UI","requestedStyle":"Semibold","requestSource":"extract/computed/out/fluent/messagebar/captured-truth.json title font-family/font-weight: \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto,  / Semibold; reviewed fallback: the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600","fallbackChain":[{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"SemiBold"}],"resolvedFamily":"Roboto","resolvedStyle":"SemiBold","resolution":"fallback","degradation":"the requested face Segoe UI Semibold is not on the minting machine; minted with Roboto SemiBold — the capture's stack is \"Segoe UI\", \"Segoe UI Web (West European)\", -apple-system, \"system-ui\", Roboto, \"Helvetica Neue\", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#242424ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}]}}]};
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
void "ALERT-MUST-NOT-WRITE-ALERT-V9-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V8-PAGE";
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
if(figma.currentPage&&figma.currentPage.id==="219:92824")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V9-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:90060")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V8-PAGE");
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
if(page.id==="219:92824")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V9-PAGE");
if(page.id==="218:90060")throw new Error("ALERT-MUST-NOT-WRITE-ALERT-V8-PAGE");
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
// NOTE the doubled backslash: this line lives inside the emitted program's
// template literal, and a single s reached the plugin as /[s_-]/ — a regex
// that strips the LETTER s, so a two-word "Semi Bold" never matched a
// CSS-weight "Semibold" (measured 2026-09-02 on the Chakra dialog title:
// FONT-UNAVAILABLE while the same lookup succeeded run directly in the file).
const sameStyle=(a,b)=>String(a).toLowerCase().replace(/[\s_-]/g,"")===String(b).toLowerCase().replace(/[\s_-]/g,"");
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
        // Per-side weights when the IR carries them (a source that draws one
        // edge — MUI's table cell bottom rule). Figma requires the uniform
        // strokeWeight first; these then override per side.
        if(ir.strokes[0].sideWeights){const sw=ir.strokes[0].sideWeights;for(const [side,prop] of [["top","strokeTopWeight"],["right","strokeRightWeight"],["bottom","strokeBottomWeight"],["left","strokeLeftWeight"]]){node[prop]=sw[side];bindFloat(node,prop,bindingFor(ir,"strokes.0.weight."+side));}}
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
          // the same spacing-and-case-blind style match as resolveFont (a two-word "Semi Bold" vs a CSS-weight "Semibold")
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&sameStyle(entry.fontName.style,candidate.style));
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
