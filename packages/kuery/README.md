Kuery
=====

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage)
* [API](#api)
  * [Constructor](#constructor)
  * [skip](#skip)
  * [limit](#limit)
  * [sort](#sort)
  * [find](#find)
  * [findOne](#findone)

# Purpose

Simple MongoDB like queries with lodash for in-memory filtering of documents.

# Installation

```shell
npm i kuery
```

# Usage

```js
import Kuery from 'kuery';

const collection = [
  { id: 1, name: 'Andreas', address: { street: 'Bellmansgatan' } },
  { id: 2, name: 'Sven' },
  { id: 3, name: 'Christian' },
  { id: 4, name: 'Emil' }
];

const idListKuery = new Kuery({ id: { $in: [3, 2] } });
const people = idListKuery.find(collection);
// Result: [{ id: 2, name: 'Sven' }, { id: 3, name: 'Christian' }]

const nestedPathKuery = new Kuery({ 'address.street': 'Bellmansgatan' });
const peopleOnMellmansgatan = nestedPathKuery.find(collection);
// Result: [{ id: 1, name: 'Andreas', address: { street: 'Bellmansgatan' }}]
```

# API

## Constructor

Creates a new Kuery constructor with query. Takes a filter query as argument to be executed against provided lists.

```js
const kuery = new Kuery({ id: { $in: [3, 2] } });
```

## Methods

## skip

Skips the provided amount of documents from the collection

```js
const kuery = new Kuery({ id: { $in: [1, 2] } });
kuery.skip(1);

const result = kuery.find([{ id: 1 }, { id: 2 }, { id: 3 }]);
// Result: [{ id: 2 }]
```

## limit

Limits the resulted documents to the provided amount

```js
const kuery = new Kuery({ id: { $in: [1, 2] } });
kuery.limit(1);

const result = kuery.find([{ id: 1 }, { id: 2 }, { id: 3 }]);
// Result: [{ id: 1 }]
```

## sort

Sorts the returned documents based on the provided key(s)

```js
const kuery = new Kuery({ id: { $in: [1, 2] } });
kuery.sort({ id: 0 });

const result = kuery.find([{ id: 1 }, { id: 2 }, { id: 3 }]);
// Result: [{ id: 2 }, { id: 1 }];
```

## find

Returns the documents matching the query in the provided collection

```js
const kuery = new Kuery({ id: { $in: [1, 2] } });
const result = kuery.find([{ id: 1 }, { id: 2 }, { id: 3 }]);
// Result: [{ id: 1 }, { id: 2 }]
```

## findOne

Returns the document matching the query in the provided collection. Throws an Error if not exactly one document is
found.

```js
const collection = [{ id: 1, name: 'Andreas' }, { id: 2, name: 'Andreas' }, { id: 3, name: 'Christian' }];

try {
  const kuery = new Kuery({ name: 'Christian' });
  const result = kuery.findOne([{ id: 1 }, { id: 2 }, { id: 3 }]);
  // Result: { id: 3, name: 'Christian' }  
} catch (err) {
  // No error
}

try {
  const kuery = new Kuery({ name: 'Andreas' });
  const result = kuery.findOne(collection);
} catch (err) {
  // err.message: 'findOne returned 2 results.'
}

try {
  const kuery = new Kuery({ name: 'Gustav' });
  const result = kuery.findOne(collection);
} catch (err) {
  // err.message: 'findOne returned 0 results.'
}
```
