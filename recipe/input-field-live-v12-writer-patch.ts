export const V11_WRITER_PROGRAM_SHA256 =
  "a839d5bd2304fa18b449692676345486606bca6a79dd8bd84e8b9b307b9f7826";
export const V11_WRITER_PAYLOAD_SHA256 =
  "aedb679f27be7b8159f4822f5cfb61aeef7f85e7ea824af884f14ad2f3c5e1a2";

export const INPUT_LIVE_V12_POST_SETTLE_FILL_ANCHOR = "  set.x=80;set.y=128;";
export const INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER =
  "INPUT-TEXT-FILL-AFTER-SETTLE";

export const INPUT_LIVE_V12_POST_SETTLE_FILL_RESTORE = `  for(const component of set.children){
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="TEXT"&&(role==="input-field/content/placeholder"||role==="input-field/content/value")){
        descendant.textAutoResize="HEIGHT";
        descendant.layoutSizingHorizontal="FILL";
        if(descendant.width<=0||descendant.height<=0)throw new Error("${INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER}:"+role);
      }
      if(descendant.type==="FRAME"&&role==="input-field/content-row")descendant.layoutSizingHorizontal="FILL";
    }
  }
`;

export function patchInputLiveV12WriterPayload(payload: string): string {
  if (payload.includes(INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER)) {
    throw new TypeError("Input live v12 writer payload already carries post-settle fill restore");
  }
  const occurrences = payload.split(INPUT_LIVE_V12_POST_SETTLE_FILL_ANCHOR).length - 1;
  if (occurrences !== 1) {
    throw new TypeError(
      `Input live v12 writer payload missing unique post-settle fill anchor (${occurrences})`,
    );
  }
  return payload.replace(
    INPUT_LIVE_V12_POST_SETTLE_FILL_ANCHOR,
    `${INPUT_LIVE_V12_POST_SETTLE_FILL_RESTORE}${INPUT_LIVE_V12_POST_SETTLE_FILL_ANCHOR}`,
  );
}
