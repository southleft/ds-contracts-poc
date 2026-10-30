/** Only signed diagonal unit reflections. The tolerance matches the existing
 * rigid filled-path capture tolerance for REST coefficient serialization.
 * The exact observed matrix is retained, never rounded to the signs. */
export function axisReflectedFilledPath(transform:unknown,declaredRadians?:unknown):transform is [[number,number,number],[number,number,number]] {
 if(!Array.isArray(transform)||transform.length!==2||transform.some(row=>!Array.isArray(row)||row.length!==3||row.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e6)))return false;
 const [[a,c],[b,d]]=transform as number[][],near=(x:number,y:number)=>Math.abs(x-y)<=1e-12;
 if(!near(Math.abs(a),1)||!near(Math.abs(d),1)||!near(b,0)||!near(c,0)||a*d-b*c>=0)return false;
 if(declaredRadians!==undefined&&(typeof declaredRadians!=='number'||!Number.isFinite(declaredRadians)||!near(Math.cos(declaredRadians),a)||!near(Math.sin(declaredRadians),b)))return false;
 return true;
}
