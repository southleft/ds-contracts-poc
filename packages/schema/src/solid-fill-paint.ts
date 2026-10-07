import {z} from 'zod';
/** One resolved native paint, separate from node blending and child ink.
 * The input is exact float32 data. No alpha epsilon, CSS rounding, inferred
 * variable binding, or claim about a component's unobserved API. */
const nativeUnit = z.number().finite().min(0).max(1)
  .refine(value => Math.fround(value) === value, 'solid-fill-coordinate-not-native-float32');
export const SolidFillCompositionSchema = z.strictObject({
  color: z.strictObject({r:nativeUnit,g:nativeUnit,b:nativeUnit}),
  opacity: nativeUnit,
  blendMode: z.enum(['NORMAL','MULTIPLY']),
});
export type SolidFillComposition = z.infer<typeof SolidFillCompositionSchema>;

