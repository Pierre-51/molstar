/**
 * Copyright (c) 2017 molio contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import Iterator, * as I from '../collections/iterator'
import IntPair from '../collections/int-pair'
import * as Sort from '../collections/sort'

describe('basic iterators', () => {
    function check<T>(name: string, iter: Iterator<T>, expected: T[]) {
        it(name, () => {
            expect(I.toArray(iter)).toEqual(expected);
        });
    }

    check('empty', I.EmptyIterator, []);
    check('singleton', I.SingletonIterator(10), [10]);
    check('singleton reset', I.SingletonIterator(10).reset(13), [13]);
    check('array', I.ArrayIterator([1, 2, 3]), [1, 2, 3]);
    check('array reset', I.ArrayIterator([1, 2, 3]).reset([4]), [4]);
    check('range', I.RangeIterator({ min: 0, max: 3 }), [0, 1, 2]);
    check('range reset', I.RangeIterator().reset({ min: 1, max: 2 }), [1]);
});

describe('int pair', () => {
    it('works', () => {
        const p = IntPair.zero();
        for (let i = 0; i < 10; i++) {
            for (let j = -10; j < 5; j++) {
                const t = IntPair.set(i, j);
                IntPair.get(t, p);
                expect(p.fst).toBe(i);
                expect(p.snd).toBe(j);
            }
        }
    })
})

function shuffle<T>(data: T, len: number, clone: (s: T) => T, swap: Sort.Swapper = Sort.arraySwap) {
    const a = clone(data);
    for (let i = len - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        swap(a, i, j);
    }
    return a;
}

function shuffleArray(data: any[]) {
    return shuffle(data, data.length, t => [...t]);
}

describe('qsort-array asc', () => {
    const data0 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const data1 = [1, 1, 2, 2, 3, 3, 4, 4, 4, 6, 6, 6];

    function test(name: string, data: any[], randomize: boolean) {
        it(name, () => {
            // [ 3, 1, 6, 4, 4, 6, 4, 2, 6, 1, 2, 3 ];
            if (randomize) {
                for (let i = 0; i < 10; i++) {
                    expect(Sort.sortArray(shuffleArray(data))).toEqual(data);
                }
            } else {
                expect(Sort.sortArray([...data])).toEqual(data);
            }
        });
    }
    test('uniq', data0, false);
    test('uniq shuffle', data0, true);
    test('rep', data1, false);
    test('rep shuffle', data1, true);
})

describe('qsort-array generic', () => {
    const data0 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const data1 = [1, 1, 2, 2, 3, 3, 4, 4, 4, 6, 6, 6];

    function test(name: string, data: any[], randomize: boolean) {
        it(name, () => {
            // [ 3, 1, 6, 4, 4, 6, 4, 2, 6, 1, 2, 3 ];
            if (randomize) {
                for (let i = 0; i < 10; i++) {
                    expect(Sort.sort(shuffleArray(data), data.length, Sort.arrayLess, Sort.arraySwap)).toEqual(data);
                }
            } else {
                expect(Sort.sort([...data], data.length, Sort.arrayLess, Sort.arraySwap)).toEqual(data);
            }
        });
    }
    test('uniq', data0, false);
    test('uniq shuffle', data0, true);
    test('rep', data1, false);
    test('rep shuffle', data1, true);
})

describe('qsort-dual array', () => {
    const len = 3;
    const data = { xs: [0, 1, 2], ys: ['x', 'y', 'z'] };

    const cmp: Sort.Comparer<typeof data> = (data, i, j) => data.xs[i] - data.xs[j];
    const swap: Sort.Swapper<typeof data> = (data, i, j) => { Sort.arraySwap(data.xs, i, j); Sort.arraySwap(data.ys, i, j); }
    const clone = (d: typeof data) => ({ xs: [...d.xs], ys: [...d.ys] })
 
    function test(name: string, src: typeof data, randomize: boolean) {
        it(name, () => {
            // [ 3, 1, 6, 4, 4, 6, 4, 2, 6, 1, 2, 3 ];
            if (randomize) {
                for (let i = 0; i < 10; i++) {
                    expect(Sort.sort(shuffle(src, len, clone, swap), len, cmp, swap)).toEqual(data);
                }
            } else {
                expect(Sort.sort(clone(src), len, cmp, swap)).toEqual(data);
            }
        });
    }
    test('sorted', data, false);
    test('shuffled', data, true);
})