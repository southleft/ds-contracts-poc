/** Evaluate before loading source code in a fresh, isolated browser realm.
 * The returned assertion authenticates only the model's native environment.
 * It does not authenticate source functions, module state, props or content.
 * Keep this self-contained: it is sent to the browser as source, not bundled
 * with the component code whose behavior is being observed. */
export const reactHelperIntrinsicGuard = String.raw`(() => {
  const realm = globalThis;
  const keys = Reflect.ownKeys, descriptors = Object.getOwnPropertyDescriptors;
  const descriptor = Object.getOwnPropertyDescriptor, prototype = Object.getPrototypeOf;
  const same = Object.is, apply = Reflect.apply, ErrorConstructor = Error;
  const weakHas = WeakSet.prototype.has, weakAdd = WeakSet.prototype.add;
  const seen = new WeakSet(), pending = [], baseline = [], globals = [];
  const names = ['globalThis', 'Object', 'Array', 'Set', 'Function', 'String',
    'Number', 'Boolean', 'Symbol', 'Map', 'WeakMap', 'WeakSet', 'Reflect', 'Error', 'JSON'];
  function add(value) {
    if (value === null || typeof value !== 'object' && typeof value !== 'function' ||
        apply(weakHas, seen, [value])) return;
    apply(weakAdd, seen, [value]);
    pending[pending.length] = value;
  }
  for (let i = 0; i < names.length; i++) {
    const name = names[i], value = descriptor(realm, name);
    if (!value || !descriptor(value, 'value')) throw new ErrorConstructor('helper-native-bootstrap-invalid');
    globals[globals.length] = { name, descriptor: value };
    // Window itself contains application state and is not a native invariant.
    if (name !== 'globalThis') add(value.value);
  }
  // Iterator prototypes are not reachable through constructor properties.
  // They govern array spread/for-of and Set construction in the source model.
  add(prototype([][Symbol.iterator]()));
  add(prototype(''[Symbol.iterator]()));
  add(prototype(new Set()[Symbol.iterator]()));
  add(prototype(new Map()[Symbol.iterator]()));
  for (let i = 0; i < pending.length; i++) {
    const target = pending[i], ds = descriptors(target), ks = keys(ds), p = prototype(target);
    baseline[baseline.length] = { target, descriptors: ds, keys: ks, prototype: p };
    add(p);
    for (let j = 0; j < ks.length; j++) {
      const d = ds[ks[j]];
      // Include method objects themselves: fn.call can be shadowed without
      // changing either fn's identity or Function.prototype.call.
      add(d.value); add(d.get); add(d.set);
    }
  }
  const fields = ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'];
  function sameDescriptor(a, b) {
    if (!a || !b) return false;
    for (let i = 0; i < fields.length; i++) {
      const left = descriptor(a, fields[i]), right = descriptor(b, fields[i]);
      if (!!left !== !!right || left && !same(left.value, right.value)) return false;
    }
    return true;
  }
  return function assertHelperIntrinsics() {
    // Compare descriptors on the captured realm; do not read a replaced
    // binding or invoke its accessor/proxy to discover what it contains.
    for (let i = 0; i < globals.length; i++) {
      const g = globals[i];
      if (!sameDescriptor(g.descriptor, descriptor(realm, g.name)))
        throw new ErrorConstructor('helper-native-global-changed:' + g.name);
    }
    for (let i = 0; i < baseline.length; i++) {
      const b = baseline[i], ds = descriptors(b.target), ks = keys(ds);
      if (prototype(b.target) !== b.prototype || ks.length !== b.keys.length)
        throw new ErrorConstructor('helper-native-intrinsic-changed');
      for (let j = 0; j < ks.length; j++)
        if (ks[j] !== b.keys[j] || !sameDescriptor(b.descriptors[ks[j]], ds[ks[j]]))
          throw new ErrorConstructor('helper-native-intrinsic-changed');
    }
  };
})()`;
