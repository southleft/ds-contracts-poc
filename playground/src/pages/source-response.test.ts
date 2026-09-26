import test from 'node:test';
import assert from 'node:assert/strict';
import {readSourceResponse} from './source-response';

test('an empty timeout reports uncertain outcome instead of a JSON parser error',async()=>{
  await assert.rejects(readSourceResponse(new Response(null,{status:408})),
    {message:'The local app could not confirm this request (HTTP 408). Check the current status before trying again.'});
});
test('non-JSON server errors do not expose response contents',async()=>{
  await assert.rejects(readSourceResponse(new Response('<html>private internal traceback</html>',{status:502})),
    {message:'The local app could not confirm this request (HTTP 502). Check the current status before trying again.'});
});
test('structured refusals retain their specific reason and successful data is unchanged',async()=>{
  for(const [status,body] of [[409,{error:'Update refused',reason:'native-update-input-changed'}],
    [200,{pending:false,operations:[{phase:'update-verified'}]}]] as const)
    assert.deepEqual(await readSourceResponse(Response.json(body,{status})),body);
  await assert.rejects(readSourceResponse(new Response('{',{status:200})),/incomplete or invalid response/);
});
