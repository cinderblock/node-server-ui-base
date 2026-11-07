import { expect, test } from 'bun:test';
import { makeObjectSetter, makeObjectSetterRecursive } from './makeProtectedObject.js';

test('makeObjectSetter routes writes through setters', () => {
  const myObject = { num: 42, str: 'initialValue' };

  const protectedObject = makeObjectSetter(myObject, {
    num(x) {
      // Make sure positive
      myObject.num = Math.max(x, 0);
    },
    str(s) {
      // Always double the input
      myObject.str = s + s;
    },
  });

  protectedObject.num = -1;
  protectedObject.str = 'a';

  expect(myObject).toEqual({ num: 0, str: 'aa' });
  expect(protectedObject.num).toBe(0);
  // Keys are enumerable
  expect(Object.keys(protectedObject)).toEqual(['num', 'str']);
});

test('makeObjectSetterRecursive protects nested objects', () => {
  const myRecursiveObject = { num: 1, nested: { str: 'foo' } };

  const protectedRecursiveObject = makeObjectSetterRecursive(myRecursiveObject, {
    num(x) {
      myRecursiveObject.num = Math.max(x, 0);
    },
    nested: {
      str(s) {
        myRecursiveObject.nested.str = s + s;
      },
    },
  });

  protectedRecursiveObject.num = -1;
  protectedRecursiveObject.nested.str = 'a';

  expect(myRecursiveObject).toEqual({ num: 0, nested: { str: 'aa' } });
  expect(protectedRecursiveObject.nested.str).toBe('aa');
});
