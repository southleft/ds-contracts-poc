const PLAN={"pageName":"Recipe Pivot / Alert / 4c13ca24-9b4bd337-b8dd06ed-alert-v3","runIdentity":"4c13ca24-9b4bd337-b8dd06ed-alert-v3","sources":[{"adapterIdentity":"mui-alert-reviewed-v1","displayName":"MUI","sourceName":"MUI Alert","recipeHash":"9b4bd3375d4bd4c846972da58119ee67e6897853a3e6db88d8dc776a1cfb672a","envelopeHash":"b1125ce84380e93ac1b6ed6519dc19c3fd8fd7204df4b2a8d9df8ecc11cd667b","variables":[{"identity":"mui.alert.states-error-boxBorder","name":"token/color/id-6d75692e616c6572742e7374617465732d6572726f722d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"mui.alert.states-error-boxFill","name":"token/color/id-6d75692e616c6572742e7374617465732d6572726f722d626f7846696c6c","type":"COLOR","value":"#fdededff"},{"identity":"mui.alert.states-error-iconFill","name":"token/color/id-6d75692e616c6572742e7374617465732d6572726f722d69636f6e46696c6c","type":"COLOR","value":"#d32f2fff"},{"identity":"mui.alert.states-error-title","name":"token/color/id-6d75692e616c6572742e7374617465732d6572726f722d7469746c65","type":"COLOR","value":"#5f2120ff"},{"identity":"mui.alert.states-info-boxBorder","name":"token/color/id-6d75692e616c6572742e7374617465732d696e666f2d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"mui.alert.states-info-boxFill","name":"token/color/id-6d75692e616c6572742e7374617465732d696e666f2d626f7846696c6c","type":"COLOR","value":"#e5f6fdff"},{"identity":"mui.alert.states-info-iconFill","name":"token/color/id-6d75692e616c6572742e7374617465732d696e666f2d69636f6e46696c6c","type":"COLOR","value":"#0288d1ff"},{"identity":"mui.alert.states-info-title","name":"token/color/id-6d75692e616c6572742e7374617465732d696e666f2d7469746c65","type":"COLOR","value":"#014361ff"},{"identity":"mui.alert.states-success-boxBorder","name":"token/color/id-6d75692e616c6572742e7374617465732d737563636573732d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"mui.alert.states-success-boxFill","name":"token/color/id-6d75692e616c6572742e7374617465732d737563636573732d626f7846696c6c","type":"COLOR","value":"#edf7edff"},{"identity":"mui.alert.states-success-iconFill","name":"token/color/id-6d75692e616c6572742e7374617465732d737563636573732d69636f6e46696c6c","type":"COLOR","value":"#2e7d32ff"},{"identity":"mui.alert.states-success-title","name":"token/color/id-6d75692e616c6572742e7374617465732d737563636573732d7469746c65","type":"COLOR","value":"#1e4620ff"},{"identity":"mui.alert.states-warning-boxBorder","name":"token/color/id-6d75692e616c6572742e7374617465732d7761726e696e672d626f78426f72646572","type":"COLOR","value":"#00000000"},{"identity":"mui.alert.states-warning-boxFill","name":"token/color/id-6d75692e616c6572742e7374617465732d7761726e696e672d626f7846696c6c","type":"COLOR","value":"#fff4e5ff"},{"identity":"mui.alert.states-warning-iconFill","name":"token/color/id-6d75692e616c6572742e7374617465732d7761726e696e672d69636f6e46696c6c","type":"COLOR","value":"#ed6c02ff"},{"identity":"mui.alert.states-warning-title","name":"token/color/id-6d75692e616c6572742e7374617465732d7761726e696e672d7469746c65","type":"COLOR","value":"#663c00ff"},{"identity":"mui.alert.box-borderWidth","name":"token/float/id-6d75692e616c6572742e626f782d626f726465725769647468","type":"FLOAT","value":0},{"identity":"mui.alert.box-gap","name":"token/float/id-6d75692e616c6572742e626f782d676170","type":"FLOAT","value":12},{"identity":"mui.alert.box-height","name":"token/float/id-6d75692e616c6572742e626f782d686569676874","type":"FLOAT","value":48},{"identity":"mui.alert.box-paddingX","name":"token/float/id-6d75692e616c6572742e626f782d70616464696e6758","type":"FLOAT","value":16},{"identity":"mui.alert.box-paddingY","name":"token/float/id-6d75692e616c6572742e626f782d70616464696e6759","type":"FLOAT","value":6},{"identity":"mui.alert.box-radius","name":"token/float/id-6d75692e616c6572742e626f782d726164697573","type":"FLOAT","value":4},{"identity":"mui.alert.icon-size","name":"token/float/id-6d75692e616c6572742e69636f6e2d73697a65","type":"FLOAT","value":22},{"identity":"mui.alert.titleFontSize","name":"token/float/id-6d75692e616c6572742e7469746c65466f6e7453697a65","type":"FLOAT","value":14},{"identity":"mui.alert.titleLineHeight","name":"token/float/id-6d75692e616c6572742e7469746c654c696e65486569676874","type":"FLOAT","value":20}],"comparedIrFacts":93,"alertSet":{"label":"MUI Alert","role":"alert/set","bindings":[],"kind":"component-set","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":16,"padding":{"top":16,"right":16,"bottom":16,"left":16},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[],"variantAxes":[{"name":"Status","values":["info","success","warning","error"]}],"children":[{"label":"Status=info","role":"alert/variant/info","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"mui.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-info-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"mui.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"mui.alert.states-info-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"mui.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":12,"padding":{"top":6,"right":16,"bottom":6,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":48}},"fills":[{"kind":"solid","color":"#e5f6fdff"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"info"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"mui.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.icon-size"}],"opacity":0.9,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":22},"height":{"mode":"fixed","value":22}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-info-iconFill"}],"kind":"vector","assetRef":"M 8.25 6.4167 L 10.0834 6.4167 L 10.0834 4.5834 L 8.25 4.5834 Z M 9.1667 16.5 C 5.1242 16.5 1.8334 13.2092 1.8334 9.1667 C 1.8334 5.1242 5.1242 1.8334 9.1667 1.8334 C 13.2092 1.8334 16.5 5.1242 16.5 9.1667 C 16.5 13.2092 13.2092 16.5 9.1667 16.5 Z M 9.1667 0 C 4.1041 0 0 4.1041 0 9.1667 C 0 14.2293 4.1041 18.3334 9.1667 18.3334 C 14.2293 18.3334 18.3334 14.2293 18.3334 9.1667 C 18.3334 4.1041 14.2293 0 9.1667 0 Z M 8.25 13.75 L 10.0834 13.75 L 10.0834 8.25 L 8.25 8.25 L 8.25 13.75 Z","width":{"mode":"fixed","value":18.3334},"height":{"mode":"fixed","value":18.3334},"fills":[{"kind":"solid","color":"#0288d1ff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-info-title"}],"kind":"text","characters":"This is an alert — check it out!","type":{"fontFamily":"Roboto","fontStyle":"Regular","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Regular","requestSource":"recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body2 fontFamily Roboto, fontWeightRegular 400, size 14, lineHeight 1.43","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#014361ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=success","role":"alert/variant/success","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"mui.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-success-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"mui.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"mui.alert.states-success-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"mui.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":12,"padding":{"top":6,"right":16,"bottom":6,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":48}},"fills":[{"kind":"solid","color":"#edf7edff"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"success"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"mui.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.icon-size"}],"opacity":0.9,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":22},"height":{"mode":"fixed","value":22}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-success-iconFill"}],"kind":"vector","assetRef":"M 16.5 9.1667 C 16.5 13.2168 13.2168 16.5 9.1667 16.5 C 5.1166 16.5 1.8334 13.2168 1.8334 9.1667 C 1.8334 5.1166 5.1166 1.8334 9.1667 1.8334 C 9.8634 1.8334 10.5417 1.9342 11.1834 2.1175 L 12.6225 0.6784 C 11.5592 0.2384 10.395 0 9.1667 0 C 4.1041 0 0 4.1041 0 9.1667 C 0 14.2293 4.1041 18.3334 9.1667 18.3334 C 14.2293 18.3334 18.3334 14.2293 18.3334 9.1667 Z M 5.4175 7.4067 L 4.125 8.7084 L 8.25 12.8334 L 17.4167 3.6667 L 16.1242 2.365 L 8.25 10.2392 L 5.4175 7.4067 Z","width":{"mode":"fixed","value":18.3334},"height":{"mode":"fixed","value":18.3334},"fills":[{"kind":"solid","color":"#2e7d32ff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-success-title"}],"kind":"text","characters":"This is an alert — check it out!","type":{"fontFamily":"Roboto","fontStyle":"Regular","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Regular","requestSource":"recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body2 fontFamily Roboto, fontWeightRegular 400, size 14, lineHeight 1.43","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#1e4620ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=warning","role":"alert/variant/warning","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"mui.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-warning-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"mui.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"mui.alert.states-warning-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"mui.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":12,"padding":{"top":6,"right":16,"bottom":6,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":48}},"fills":[{"kind":"solid","color":"#fff4e5ff"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"warning"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"mui.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.icon-size"}],"opacity":0.9,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":22},"height":{"mode":"fixed","value":22}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-warning-iconFill"}],"kind":"vector","assetRef":"M 10.0833 3.6575 L 16.9858 15.5834 L 3.1808 15.5834 L 10.0833 3.6575 Z M 10.0833 0 L 0 17.4167 L 20.1666 17.4167 L 10.0833 0 Z M 11 12.8334 L 9.1666 12.8334 L 9.1666 14.6667 L 11 14.6667 L 11 12.8334 Z M 11 7.3334 L 9.1666 7.3334 L 9.1666 11 L 11 11 L 11 7.3334 Z","width":{"mode":"fixed","value":20.166600000000003},"height":{"mode":"fixed","value":17.416700000000002},"fills":[{"kind":"solid","color":"#ed6c02ff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-warning-title"}],"kind":"text","characters":"This is an alert — check it out!","type":{"fontFamily":"Roboto","fontStyle":"Regular","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Regular","requestSource":"recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body2 fontFamily Roboto, fontWeightRegular 400, size 14, lineHeight 1.43","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#663c00ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]},{"label":"Status=error","role":"alert/variant/error","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.box-height"},{"field":"layout.itemSpacing","type":"FLOAT","variable":"mui.alert.box-gap"},{"field":"layout.padding.top","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"mui.alert.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"mui.alert.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-error-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"mui.alert.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"mui.alert.states-error-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"mui.alert.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"mui.alert.box-radius"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":12,"padding":{"top":6,"right":16,"bottom":6,"left":16},"width":{"mode":"hug"},"height":{"mode":"fixed","value":48}},"fills":[{"kind":"solid","color":"#fdededff"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#00000000"}}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Status":"error"},"children":[{"label":"alert/icon","role":"alert/icon","bindings":[{"field":"layout.width.value","type":"FLOAT","variable":"mui.alert.icon-size"},{"field":"layout.height.value","type":"FLOAT","variable":"mui.alert.icon-size"}],"opacity":0.9,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"center","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fixed","value":22},"height":{"mode":"fixed","value":22}},"fills":[],"children":[{"label":"alert/icon/glyph","role":"alert/icon/glyph","bindings":[{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-error-iconFill"}],"kind":"vector","assetRef":"M 8.25 11.9167 L 10.0834 11.9167 L 10.0834 13.75 L 8.25 13.75 Z M 8.25 4.5834 L 10.0834 4.5834 L 10.0834 10.0834 L 8.25 10.0834 Z M 9.1575 0 C 4.0975 0 0 4.1067 0 9.1667 C 0 14.2267 4.0975 18.3334 9.1575 18.3334 C 14.2267 18.3334 18.3334 14.2267 18.3334 9.1667 C 18.3334 4.1067 14.2267 0 9.1575 0 Z M 9.1667 16.5 C 5.115 16.5 1.8334 13.2184 1.8334 9.1667 C 1.8334 5.115 5.115 1.8334 9.1667 1.8334 C 13.2184 1.8334 16.5 5.115 16.5 9.1667 C 16.5 13.2184 13.2184 16.5 9.1667 16.5 Z","width":{"mode":"fixed","value":18.3334},"height":{"mode":"fixed","value":18.3334},"fills":[{"kind":"solid","color":"#d32f2fff"}],"windingRule":"nonzero"}]},{"label":"alert/title","role":"alert/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.alert.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.alert.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.alert.states-error-title"}],"kind":"text","characters":"This is an alert — check it out!","type":{"fontFamily":"Roboto","fontStyle":"Regular","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Regular","requestSource":"recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body2 fontFamily Roboto, fontWeightRegular 400, size 14, lineHeight 1.43","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#5f2120ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}]}}]};

const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = "ds.contracts.alert.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/alert/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("ALERT-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("ALERT-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("ALERT-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("ALERT-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("ALERT-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("ALERT-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("ALERT-SWITCH-IDENTITY-REUSE");
if(NS==="ds.contracts.textarea.recipe.v1")throw new Error("ALERT-TEXTAREA-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "ALERT-MUST-NOT-WRITE-INPUT-PAGE";
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
void "ALERT-MUST-NOT-WRITE-ALERT-V1-PAGE";
void "ALERT-MUST-NOT-WRITE-ALERT-V2-PAGE";
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
if(page.id==="115:295378")throw new Error("ALERT-MUST-NOT-WRITE-INPUT-PAGE");
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
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&font.fontName.style===candidate.style)).find(Boolean);
  if(!found)throw new Error("ALERT-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("ALERT-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
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
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }
    else if(ir.kind==="vector"){node.strokes=[];}
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
  };
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
    else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
    else node.layoutSizingHorizontal="FIXED";
    if(height.mode==="fill")node.layoutSizingVertical="FILL";
    else if(height.mode==="hug")node.layoutSizingVertical="HUG";
    else node.layoutSizingVertical="FIXED";
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
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("ALERT-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};
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
      if(ir.strokeCap)vector.strokeCap=ir.strokeCap.toUpperCase();
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
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
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
      for(const [childIndex,child] of ir.children.entries())await render(child,component,"alert/children/"+componentIndex+"/children/"+childIndex);
      applySizing(component,ir);
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
  const alertSet=await mintSet(source.alertSet);
  alertSet.x=80;alertSet.y=96;
  section.resizeWithoutConstraints(alertSet.width+160,alertSet.y+alertSet.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,setId:alertSet.id,collectionId:collection.id,variableCount:variables.size,variantCount:alertSet.children.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
